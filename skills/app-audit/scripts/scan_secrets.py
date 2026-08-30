#!/usr/bin/env python3
"""READ-ONLY scanner for likely committed secrets.

Walks a target directory and reports credential-shaped literals with their
file:line and a REDACTED preview. Never prints a full secret value: the middle
of every match is masked. Never writes, never opens a network connection.

Detected: cloud keys (AWS, Google), payment keys (Stripe), private key blocks,
platform tokens (GitHub, Slack, npm, SendGrid), AI provider keys, JWTs, and
generic api_key / token / password / secret assignments whose literal has high
Shannon entropy (or, for passwords, is simply a non-placeholder literal).

Exit codes: 0 = nothing found, 3 = findings, 2 = usage / unreadable target.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys

DEFAULT_SKIP_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    ".next",
    "out",
    ".nuxt",
    ".output",
    ".svelte-kit",
    ".turbo",
    ".parcel-cache",
    ".cache",
    "coverage",
    "__pycache__",
    ".venv",
    "venv",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
    "vendor",
    "target",
    "Pods",
    "DerivedData",
    ".gradle",
    ".idea",
    ".terraform",
}

SKIP_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".tiff", ".svgz",
    ".pdf", ".zip", ".gz", ".tgz", ".bz2", ".xz", ".7z", ".rar", ".jar", ".war",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".mp3", ".mp4", ".mov", ".avi", ".webm", ".wav", ".flac",
    ".so", ".dylib", ".dll", ".exe", ".bin", ".class", ".pyc", ".o", ".a",
    ".db", ".sqlite", ".sqlite3", ".mo",
}

# (rule id, severity, compiled regex, capture group used for the match text)
RULES: list[tuple[str, str, re.Pattern[str], int]] = [
    (
        "private_key_block",
        "CRITICAL",
        re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----"),
        0,
    ),
    (
        "aws_access_key_id",
        "HIGH",
        re.compile(r"\b((?:AKIA|ASIA|ABIA|ACCA|AGPA|AIDA|AIPA|ANPA|ANVA|APKA|AROA)[A-Z0-9]{16})\b"),
        1,
    ),
    (
        "aws_secret_access_key",
        "CRITICAL",
        re.compile(
            r"(?i)aws[_-]?secret[_-]?access[_-]?key\W{0,4}([A-Za-z0-9/+=]{40})\b"
        ),
        1,
    ),
    ("stripe_live_secret_key", "CRITICAL", re.compile(r"\b(sk_live_[0-9a-zA-Z]{10,})"), 1),
    ("stripe_live_restricted_key", "CRITICAL", re.compile(r"\b(rk_live_[0-9a-zA-Z]{10,})"), 1),
    ("stripe_test_secret_key", "MEDIUM", re.compile(r"\b(sk_test_[0-9a-zA-Z]{10,})"), 1),
    ("stripe_test_restricted_key", "LOW", re.compile(r"\b(rk_test_[0-9a-zA-Z]{10,})"), 1),
    ("stripe_webhook_secret", "HIGH", re.compile(r"\b(whsec_[0-9a-zA-Z]{16,})"), 1),
    ("github_token", "HIGH", re.compile(r"\b(gh[pousr]_[A-Za-z0-9]{20,})"), 1),
    ("slack_token", "HIGH", re.compile(r"\b(xox[abprse]-[A-Za-z0-9-]{10,})"), 1),
    ("google_api_key", "HIGH", re.compile(r"\b(AIza[0-9A-Za-z_\-]{35})\b"), 1),
    ("npm_token", "HIGH", re.compile(r"\b(npm_[A-Za-z0-9]{30,})"), 1),
    ("sendgrid_api_key", "HIGH", re.compile(r"\b(SG\.[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{16,})"), 1),
    ("anthropic_api_key", "CRITICAL", re.compile(r"\b(sk-ant-[A-Za-z0-9_\-]{20,})"), 1),
    ("openai_api_key", "CRITICAL", re.compile(r"\b(sk-(?:proj-)?[A-Za-z0-9]{20,})"), 1),
    (
        "json_web_token",
        "HIGH",
        re.compile(r"\b(eyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{8,})"),
        1,
    ),
]

GENERIC_QUOTED = re.compile(
    r"(?i)(?P<key>[A-Za-z0-9_\-\.]*"
    r"(?:api[_-]?key|apikey|secret|token|password|passwd|pwd|"
    r"access[_-]?key|client[_-]?secret|auth[_-]?token|private[_-]?key|credential)"
    r"[A-Za-z0-9_\-]*)[ \t]*[:=][ \t]*(?P<q>[\"'`])(?P<val>[^\"'`\n]{8,})(?P=q)"
)

# Horizontal whitespace only: \s would let an empty "KEY=" swallow the next line.
GENERIC_BARE = re.compile(
    r"(?m)^[ \t]*(?:export[ \t]+)?(?P<key>[A-Za-z0-9_]*"
    r"(?:API_KEY|APIKEY|SECRET|TOKEN|PASSWORD|PASSWD|ACCESS_KEY|PRIVATE_KEY|CREDENTIAL)"
    r"[A-Za-z0-9_]*)[ \t]*=[ \t]*(?P<val>[^\s#\"'`]{8,})[ \t]*(?:#.*)?$"
)

PASSWORDISH = re.compile(r"(?i)(password|passwd|pwd)")

PLACEHOLDER_MARKERS = (
    "example", "changeme", "change_me", "change-me", "your_", "your-", "yourkey",
    "placeholder", "dummy", "redacted", "todo", "insert_", "replace_", "sample",
    "xxxx", "****", "....", "<", ">", "${", "{{", "process.env", "os.environ",
    "os.getenv", "import.meta.env", "secrets.", "vault:", "null", "none",
    "undefined", "notasecret", "n/a",
)


def shannon_entropy(text: str) -> float:
    if not text:
        return 0.0
    counts: dict[str, int] = {}
    for char in text:
        counts[char] = counts.get(char, 0) + 1
    length = len(text)
    return -sum((c / length) * math.log2(c / length) for c in counts.values())


def looks_like_placeholder(value: str) -> bool:
    lowered = value.lower()
    if any(marker in lowered for marker in PLACEHOLDER_MARKERS):
        return True
    if len(set(value)) <= 2:
        return True
    if re.fullmatch(r"[a-z]+([ _-][a-z]+)*", lowered):
        return True  # plain words, no entropy
    if re.fullmatch(r"https?://\S+", lowered):
        return True
    if re.fullmatch(r"[\d.]+", value):
        return True  # version numbers / ports
    return False


def redact(value: str, limit: int = 64) -> str:
    """Mask the middle of a matched literal. Never returns the full value."""
    text = value if len(value) <= limit else value[:limit]
    if len(text) <= 6:
        return "*" * len(text)
    keep_head = 4
    keep_tail = 2
    hidden = len(text) - keep_head - keep_tail
    return f"{text[:keep_head]}{'*' * min(hidden, 24)}{text[-keep_tail:]}"


def is_probably_text(path: str, max_bytes: int) -> bool:
    ext = os.path.splitext(path)[1].lower()
    if ext in SKIP_EXTENSIONS:
        return False
    try:
        size = os.path.getsize(path)
    except OSError:
        return False
    if size > max_bytes:
        return False
    try:
        with open(path, "rb") as handle:
            chunk = handle.read(8192)
    except OSError:
        return False
    return b"\x00" not in chunk


def iter_files(root: str, skip_dirs: set[str], max_bytes: int):
    if os.path.isfile(root):
        if is_probably_text(root, max_bytes):
            yield root
        return
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in skip_dirs)
        for name in sorted(filenames):
            full = os.path.join(dirpath, name)
            if os.path.islink(full):
                continue
            if is_probably_text(full, max_bytes):
                yield full


def scan_text(text: str, min_entropy: float) -> list[dict]:
    hits: list[dict] = []
    seen: set[tuple[int, int]] = set()
    line_starts = [0]
    for index, char in enumerate(text):
        if char == "\n":
            line_starts.append(index + 1)

    def line_of(offset: int) -> int:
        low, high = 0, len(line_starts) - 1
        while low < high:
            mid = (low + high + 1) // 2
            if line_starts[mid] <= offset:
                low = mid
            else:
                high = mid - 1
        return low + 1

    for rule_id, severity, pattern, group in RULES:
        for match in pattern.finditer(text):
            span = match.span(group)
            if span in seen:
                continue
            seen.add(span)
            value = match.group(group)
            hits.append(
                {
                    "rule": rule_id,
                    "severity": severity,
                    "line": line_of(span[0]),
                    "redacted": (
                        "-----BEGIN PRIVATE KEY----- (key block)"
                        if rule_id == "private_key_block"
                        else redact(value)
                    ),
                    "key_name": None,
                    "entropy": round(shannon_entropy(value), 2),
                    "length": len(value),
                }
            )

    for pattern, rule_id in ((GENERIC_QUOTED, "generic_secret_assignment"),
                             (GENERIC_BARE, "generic_env_assignment")):
        for match in pattern.finditer(text):
            span = match.span("val")
            if any(span[0] >= s and span[1] <= e for s, e in seen):
                continue
            value = match.group("val")
            key = match.group("key")
            if looks_like_placeholder(value):
                continue
            entropy = shannon_entropy(value)
            passwordish = bool(PASSWORDISH.search(key))
            if passwordish:
                if len(value) < 8:
                    continue
                severity = "HIGH"
            else:
                if len(value) < 12 or entropy < min_entropy:
                    continue
                severity = "MEDIUM"
            seen.add(span)
            hits.append(
                {
                    "rule": rule_id,
                    "severity": severity,
                    "line": line_of(span[0]),
                    "redacted": redact(value),
                    "key_name": key,
                    "entropy": round(entropy, 2),
                    "length": len(value),
                }
            )

    hits.sort(key=lambda h: (h["line"], h["rule"]))
    return hits


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="scan_secrets.py",
        description="READ-ONLY scan for likely committed secrets (values are always redacted).",
        epilog="exit 0 = clean, 3 = findings, 2 = usage error",
    )
    parser.add_argument("target", help="directory or file to scan")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    parser.add_argument(
        "--min-entropy",
        type=float,
        default=3.0,
        help="Shannon entropy threshold for generic key/token literals (default 3.0)",
    )
    parser.add_argument(
        "--max-bytes",
        type=int,
        default=2_000_000,
        help="skip files larger than this many bytes (default 2000000)",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        metavar="DIRNAME",
        help="additional directory name to skip (repeatable)",
    )
    parser.add_argument(
        "--exit-zero",
        action="store_true",
        help="always exit 0, even when findings exist",
    )

    if not argv:
        parser.print_usage(sys.stderr)
        print("error: a target directory or file is required", file=sys.stderr)
        return 2
    args = parser.parse_args(argv)

    root = os.path.abspath(args.target)
    if not os.path.exists(root):
        print(f"error: target does not exist: {root}", file=sys.stderr)
        return 2

    skip_dirs = set(DEFAULT_SKIP_DIRS) | set(args.exclude)
    findings: list[dict] = []
    files_scanned = 0

    for path in iter_files(root, skip_dirs, args.max_bytes):
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as handle:
                text = handle.read()
        except OSError:
            continue
        files_scanned += 1
        rel = os.path.relpath(path, root) if os.path.isdir(root) else os.path.basename(path)
        for hit in scan_text(text, args.min_entropy):
            hit["file"] = rel
            hit["absolute_path"] = path
            findings.append(hit)

    order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    findings.sort(key=lambda f: (order.get(f["severity"], 9), f["file"], f["line"]))

    if args.json:
        print(
            json.dumps(
                {
                    "scanner": "scan_secrets",
                    "target": root,
                    "files_scanned": files_scanned,
                    "findings_count": len(findings),
                    "findings": findings,
                    "note": "all matched values are redacted; never store raw values",
                },
                indent=2,
            )
        )
    else:
        print(f"secret scan: {root}  ({files_scanned} text files scanned)")
        if not findings:
            print("OK: no likely committed secrets found")
        else:
            print(f"\nPOSSIBLE SECRETS: {len(findings)}")
            for hit in findings:
                key = f" key={hit['key_name']}" if hit.get("key_name") else ""
                print(
                    f"  {hit['file']}:{hit['line']}: [{hit['severity']} {hit['rule']}]"
                    f"{key} {hit['redacted']}"
                )
            print("\n(values are redacted — confirm in-place, never copy secrets into reports)")

    if args.exit_zero:
        return 0
    return 3 if findings else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
