#!/usr/bin/env bash
# agent-skills installer: lists the catalog, installs the skills you pick.
#
# From a clone:  ./install.sh [options] [skill ...]
# Without git:   curl -fsSL https://raw.githubusercontent.com/mhshaon98/agent-skills/main/install.sh | bash -s -- [options] [skill ...]
#
# Options:
#   --list        print the catalog and exit
#   --all         install every skill written for the target agent
#   --codex       install for Codex CLI, into ${CODEX_HOME:-~/.codex}/skills
#   --project     install into ./.claude/skills (this project only)
#   --dest DIR    install into DIR
#   --force       replace same-name skills; the old copy is moved to <skills dir>-backup/
#   -h, --help    show this help
# With no skill names and no --all, a numbered menu is shown (needs a terminal).
# Requirements: bash 3.2+, curl or wget (only when not run from a clone), and
# python3 or node to read skills.json.
set -euo pipefail

RAW_BASE="${AGENT_SKILLS_RAW_BASE:-https://raw.githubusercontent.com/mhshaon98/agent-skills/main/}"
case "$RAW_BASE" in */) ;; *) RAW_BASE="$RAW_BASE/" ;; esac

die()  { echo "error: $*" >&2; exit 1; }
warn() { echo "  !! $*" >&2; }
usage() {
  cat <<'EOF'
Usage: install.sh [--list] [--all] [--codex] [--project] [--dest DIR] [--force] [skill ...]
  --list        print the catalog and exit
  --all         install every skill written for the target agent
  --codex       install for Codex CLI, into ${CODEX_HOME:-~/.codex}/skills
  --project     install into ./.claude/skills (this project only)
  --dest DIR    install into DIR
  --force       replace same-name skills; the old copy is moved to <skills dir>-backup/
With no skill names and no --all, a numbered menu is shown.
EOF
}

# ---- arguments ---------------------------------------------------------------
TARGET=claude
DEST=""
ALL=0
LIST=0
FORCE=0
PICKS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --list)    LIST=1 ;;
    --all)     ALL=1 ;;
    --codex)   TARGET=codex ;;
    --project) DEST="$PWD/.claude/skills" ;;
    --dest)    [ $# -ge 2 ] || die "--dest needs a directory"; DEST="$2"; shift ;;
    --dest=*)  DEST="${1#--dest=}" ;;
    --force)   FORCE=1 ;;
    -h|--help) usage; exit 0 ;;
    -*)        die "unknown option: $1 (see --help)" ;;
    *)         PICKS+=("$1") ;;
  esac
  shift
done
if [ -z "$DEST" ]; then
  if [ "$TARGET" = codex ]; then DEST="${CODEX_HOME:-$HOME/.codex}/skills"; else DEST="$HOME/.claude/skills"; fi
fi
DEST="${DEST%/}"
BACKUP="${DEST}-backup"

# ---- where the skills come from: a local clone, or raw files over HTTPS --------
SRC_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  d="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -f "$d/skills.json" ] && [ -d "$d/skills" ]; then SRC_DIR="$d"; fi
fi

TMP="$(mktemp -d 2>/dev/null || mktemp -d -t agentskills)"
trap 'rm -rf "$TMP"' EXIT

fetch() { die "curl or wget is required to download skills"; }
if [ -z "$SRC_DIR" ]; then
  if command -v curl >/dev/null 2>&1; then
    fetch() { curl -fsSL --globoff -o "$2" "$1"; }
  elif command -v wget >/dev/null 2>&1; then
    fetch() { wget -q -O "$2" "$1"; }
  fi
fi

# ---- JSON reader: python3 (or a Python 3 "python") or node ---------------------
PY_HELPER='
import json, sys
from urllib.parse import quote
d = json.load(open(sys.argv[1], encoding="utf-8"))
sk = d["skills"] if isinstance(d, dict) else d
out = []
if sys.argv[2] == "list":
    for s in sk:
        t = s.get("targets") or ["claude", "codex"]
        out.append("\x1f".join([s["name"], s.get("category", ""), ",".join(t),
                                s.get("version", ""), " ".join(s.get("description", "").split())]))
else:
    for s in sk:
        if s["name"] == sys.argv[3]:
            for p in s.get("files") or [s.get("path", "skills/" + s["name"]) + "/SKILL.md"]:
                out.append(quote(p, safe="/") + "\x1f" + p)
sys.stdout.buffer.write(("\n".join(out) + ("\n" if out else "")).encode("utf-8"))
'
NODE_HELPER='
const fs = require("fs"); const a = process.argv.slice(1);
const d = JSON.parse(fs.readFileSync(a[0], "utf8")); const sk = Array.isArray(d) ? d : d.skills;
const out = [];
if (a[1] === "list") {
  for (const s of sk) {
    const t = s.targets || ["claude", "codex"];
    out.push([s.name, s.category || "", t.join(","), s.version || "",
              (s.description || "").split(/\s+/).join(" ").trim()].join("\x1f"));
  }
} else {
  for (const s of sk) if (s.name === a[2])
    for (const p of (s.files || [(s.path || "skills/" + s.name) + "/SKILL.md"]))
      out.push(p.split("/").map(encodeURIComponent).join("/") + "\x1f" + p);
}
process.stdout.write(out.join("\n") + (out.length ? "\n" : ""));
'
JSON_TOOL=""
for py in python3 python; do
  if command -v "$py" >/dev/null 2>&1 && "$py" -c 'import sys; sys.exit(sys.version_info[0] < 3)' >/dev/null 2>&1; then
    JSON_TOOL="$py"; break
  fi
done
if [ -z "$JSON_TOOL" ] && command -v node >/dev/null 2>&1; then JSON_TOOL=node; fi
[ -n "$JSON_TOOL" ] || die "python3 or node is required to read skills.json"
query() {
  if [ "$JSON_TOOL" = node ]; then node -e "$NODE_HELPER" "$CATALOG" "$@"
  else "$JSON_TOOL" -c "$PY_HELPER" "$CATALOG" "$@"; fi
}

# ---- load the catalog ------------------------------------------------------------
if [ -n "$SRC_DIR" ]; then
  CATALOG="$SRC_DIR/skills.json"
else
  CATALOG="$TMP/skills.json"
  fetch "${RAW_BASE}skills.json" "$CATALOG" || die "could not download ${RAW_BASE}skills.json"
fi
query list > "$TMP/list" || die "could not parse skills.json"

NAMES=(); CATS=(); TARGS=(); VERS=(); DESCS=()
while IFS=$'\x1f' read -r n c t v desc; do
  [ -n "$n" ] || continue
  NAMES+=("$n"); CATS+=("$c"); TARGS+=("$t"); VERS+=("$v"); DESCS+=("$desc")
done < "$TMP/list"
[ "${#NAMES[@]}" -gt 0 ] || die "the catalog lists no skills (is skills.json valid?)"

index_of() {
  local i
  for i in "${!NAMES[@]}"; do [ "${NAMES[$i]}" = "$1" ] && { echo "$i"; return 0; }; done
  return 1
}
fits() { case ",${TARGS[$1]}," in *",$TARGET,"*) return 0 ;; *) return 1 ;; esac; }
only_note() {
  case "${TARGS[$1]}" in
    codex)  echo " [Codex CLI only]" ;;
    claude) echo " [Claude Code only]" ;;
    *)      echo "" ;;
  esac
}

print_catalog() {
  local i last=""
  for i in "${!NAMES[@]}"; do
    if [ "${CATS[$i]}" != "$last" ]; then echo ""; echo "  ${CATS[$i]}"; last="${CATS[$i]}"; fi
    printf "  %2d) %-22s %s%s\n" "$((i + 1))" "${NAMES[$i]}" "${DESCS[$i]}" "$(only_note "$i")"
  done
  echo ""
}

if [ "$LIST" -eq 1 ]; then print_catalog; exit 0; fi

# ---- a terminal to ask questions on (stdin is the script itself when piped) -----
TTY=0
if [ -t 0 ]; then
  exec 3<&0; TTY=1
elif { exec 3</dev/tty; } 2>/dev/null; then
  TTY=1
fi
ask() { local reply=""; printf "%s" "$1" >&2; read -r -u 3 reply || true; printf "%s" "$reply"; }

# ---- update notice for skills already installed here ----------------------------
stamp_version() {
  [ -f "$1/.agent-skills.json" ] || return 1
  sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$1/.agent-skills.json" | head -n 1
}
UPDATES=()
for i in "${!NAMES[@]}"; do
  have="$(stamp_version "$DEST/${NAMES[$i]}" || true)"
  if [ -n "$have" ] && [ -n "${VERS[$i]}" ] && [ "$have" != "${VERS[$i]}" ]; then UPDATES+=("${NAMES[$i]}"); fi
done
if [ "${#UPDATES[@]}" -gt 0 ]; then
  echo "Updates available in $DEST: ${UPDATES[*]}"
  echo "  (install them again with --force to update; the old copy is backed up)"
fi

# ---- choose ------------------------------------------------------------------------
if [ "$ALL" -eq 0 ] && [ "${#PICKS[@]}" -eq 0 ]; then
  [ "$TTY" -eq 1 ] || die "no skills named and no terminal for the menu; pass skill names or --all (see --list)"
  echo "  Available skills (installing for $TARGET into $DEST)"
  print_catalog
  ANSWER="$(ask "Install which? (numbers or names, space or comma separated, or 'all'): ")"
  for tok in $(echo "$ANSWER" | tr ',' ' '); do
    if [ "$tok" = all ]; then
      ALL=1
    elif [[ "$tok" =~ ^[0-9]+$ ]]; then
      if [ "$tok" -ge 1 ] && [ "$tok" -le "${#NAMES[@]}" ]; then PICKS+=("${NAMES[$((tok - 1))]}")
      else warn "no skill numbered $tok (valid: 1-${#NAMES[@]})"; fi
    else
      PICKS+=("$tok")
    fi
  done
fi
if [ "$ALL" -eq 1 ]; then
  PICKS=()
  for i in "${!NAMES[@]}"; do if fits "$i"; then PICKS+=("${NAMES[$i]}"); fi; done
fi
[ "${#PICKS[@]}" -gt 0 ] || { echo "Nothing selected."; exit 0; }

# ---- install -----------------------------------------------------------------------
mkdir -p "$DEST"
FAILED=0
for name in "${PICKS[@]}"; do
  if ! i="$(index_of "$name")"; then warn "unknown skill: $name (see --list)"; FAILED=1; continue; fi
  if ! fits "$i"; then
    if [ "${TARGS[$i]}" = codex ]; then warn "$name is for Codex CLI only; skipped (install it with --codex)"
    else warn "$name is for ${TARGS[$i]} only; skipped"; fi
    continue
  fi
  target="$DEST/$name"
  if [ -e "$target" ] && [ "$FORCE" -ne 1 ]; then
    if [ "$TTY" -eq 1 ]; then
      r="$(ask "  $name already exists in $DEST - replace it? (the old copy is backed up) [y/N]: ")"
      case "$r" in [Yy]*) ;; *) echo "  -- kept existing $name"; continue ;; esac
    else
      echo "  -- $name already exists in $DEST; skipped (use --force to replace)"; continue
    fi
  fi

  stage="$TMP/stage/$name"
  rm -rf "$stage"; mkdir -p "$stage"
  if [ -n "$SRC_DIR" ]; then
    cp -R "$SRC_DIR/skills/$name/." "$stage/"
  else
    ok=1
    query files "$name" > "$TMP/files" || ok=0
    while IFS=$'\x1f' read -r enc path; do
      [ -n "$path" ] || continue
      rel="${path#skills/$name/}"
      mkdir -p "$stage/$(dirname "$rel")"
      # download to a plain temp name first: some curl builds cannot write to paths with ( ) [ ]
      if fetch "${RAW_BASE}${enc}" "$TMP/download"; then mv "$TMP/download" "$stage/$rel"
      else warn "download failed: $path"; ok=0; break; fi
    done < "$TMP/files"
    [ -f "$stage/SKILL.md" ] || ok=0
    if [ "$ok" -ne 1 ]; then warn "could not download $name; nothing changed"; FAILED=1; continue; fi
  fi
  printf '{"name": "%s", "version": "%s", "source": "https://github.com/mhshaon98/agent-skills", "installed": "%s"}\n' \
    "$name" "${VERS[$i]}" "$(date +%Y-%m-%d)" > "$stage/.agent-skills.json"

  if [ -e "$target" ]; then
    mkdir -p "$BACKUP"
    moved="$BACKUP/$name-$(date +%Y%m%d-%H%M%S)"
    mv "$target" "$moved"
    echo "  -- backed up the old $name to $moved"
  fi
  mv "$stage" "$target"
  echo "  ok installed $name -> $target"
done
echo "Done. New skills load the next time the agent starts a session."
exit "$FAILED"
