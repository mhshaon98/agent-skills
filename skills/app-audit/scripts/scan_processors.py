#!/usr/bin/env python3
"""READ-ONLY scanner for third-party processors (sub-processors / SDKs).

Detection is evidence-based and multi-signal, not a static assumption:
package manifests, import/require statements, SDK initialisation calls,
environment variable NAMES (names only — never values), config files, and
script/CDN hostnames.

The bundled family list covers the processors named in the requirements
(analytics, payments, AI, auth, email/comms, infra, monitoring). It is a
starting point, NOT the definition of the answer: anything unrecognised must
still be discovered by reading the project.

Never writes, never opens a network connection.

Exit codes: 0 = scan completed, 2 = usage / unreadable target.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import sys

DEFAULT_SKIP_DIRS = {
    ".git", "node_modules", "dist", "build", ".next", "out", ".nuxt", ".output",
    ".svelte-kit", ".turbo", ".parcel-cache", ".cache", "coverage", "__pycache__",
    ".venv", "venv", ".tox", ".mypy_cache", ".pytest_cache", "vendor", "target",
    "Pods", "DerivedData", ".gradle", ".idea",
}

SKIP_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".pdf", ".zip",
    ".gz", ".tgz", ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".mp4", ".mov",
    ".so", ".dylib", ".dll", ".exe", ".bin", ".pyc", ".class", ".sqlite",
}

MANIFEST_FILES = {
    "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
    "requirements.txt", "requirements-dev.txt", "pyproject.toml", "poetry.lock",
    "Pipfile", "Gemfile", "Gemfile.lock", "composer.json", "go.mod",
    "Podfile", "Package.swift", "build.gradle", "build.gradle.kts", "pubspec.yaml",
}

IMPORT_CONTEXT = re.compile(
    r"(?:^\s*import\b|\bfrom\s+['\"]?|\brequire\s*\(|\bimport\s*\(|\buse\s+|#include)"
)

# name: (category, packages, env var names, init-call regexes, hostnames, config globs)
REGISTRY: dict[str, dict] = {
    # ---------------- analytics / tracking ----------------
    "Google Analytics / GTM": {
        "category": "analytics",
        "packages": ["react-ga", "react-ga4", "@next/third-parties", "gtag", "vue-gtag"],
        "env": ["GA_MEASUREMENT_ID", "NEXT_PUBLIC_GA_ID", "NEXT_PUBLIC_GA_MEASUREMENT_ID",
                "GOOGLE_ANALYTICS_ID", "GTM_ID", "NEXT_PUBLIC_GTM_ID"],
        "init": [r"gtag\s*\(\s*['\"]config", r"dataLayer\.push\s*\(", r"GoogleAnalytics\s*\("],
        "hosts": ["googletagmanager.com", "google-analytics.com", "analytics.google.com"],
        "files": [],
    },
    "Meta Pixel": {
        "category": "analytics",
        "packages": ["react-facebook-pixel", "@rjhilgefort/react-facebook-pixel"],
        "env": ["FACEBOOK_PIXEL_ID", "NEXT_PUBLIC_FB_PIXEL_ID", "META_PIXEL_ID"],
        "init": [r"fbq\s*\(\s*['\"]init", r"ReactPixel\.init\s*\("],
        "hosts": ["connect.facebook.net", "facebook.com/tr"],
        "files": [],
    },
    "TikTok Pixel": {
        "category": "analytics",
        "packages": ["tiktok-pixel"],
        "env": ["TIKTOK_PIXEL_ID", "NEXT_PUBLIC_TIKTOK_PIXEL_ID"],
        "init": [r"ttq\.(?:load|track)\s*\("],
        "hosts": ["analytics.tiktok.com"],
        "files": [],
    },
    "Microsoft Clarity": {
        "category": "analytics",
        "packages": ["@microsoft/clarity", "react-microsoft-clarity"],
        "env": ["CLARITY_PROJECT_ID", "NEXT_PUBLIC_CLARITY_ID"],
        "init": [r"clarity\s*\(\s*['\"]"],
        "hosts": ["clarity.ms"],
        "files": [],
    },
    "Hotjar": {
        "category": "analytics",
        "packages": ["@hotjar/browser", "react-hotjar"],
        "env": ["HOTJAR_ID", "NEXT_PUBLIC_HOTJAR_ID", "HOTJAR_SITE_ID"],
        "init": [r"hj\s*\(\s*['\"]", r"Hotjar\.init\s*\("],
        "hosts": ["static.hotjar.com", "hotjar.io"],
        "files": [],
    },
    "Mixpanel": {
        "category": "analytics",
        "packages": ["mixpanel", "mixpanel-browser"],
        "env": ["MIXPANEL_TOKEN", "NEXT_PUBLIC_MIXPANEL_TOKEN"],
        "init": [r"mixpanel\.init\s*\("],
        "hosts": ["api.mixpanel.com", "cdn.mxpnl.com"],
        "files": [],
    },
    "PostHog": {
        "category": "analytics",
        "packages": ["posthog-js", "posthog-node", "posthog", "posthog-python"],
        "env": ["POSTHOG_API_KEY", "POSTHOG_KEY", "POSTHOG_HOST", "POSTHOG_PROJECT_API_KEY",
                "NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_HOST"],
        "init": [r"posthog\.init\s*\(", r"new\s+PostHog\s*\("],
        "hosts": ["posthog.com", "i.posthog.com"],
        "files": [],
    },
    "Amplitude": {
        "category": "analytics",
        "packages": ["@amplitude/analytics-browser", "@amplitude/analytics-node", "amplitude-js"],
        "env": ["AMPLITUDE_API_KEY", "NEXT_PUBLIC_AMPLITUDE_KEY"],
        "init": [r"amplitude\.init\s*\("],
        "hosts": ["api.amplitude.com", "cdn.amplitude.com"],
        "files": [],
    },
    "Segment": {
        "category": "analytics",
        "packages": ["@segment/analytics-node", "@segment/analytics-next", "analytics-node"],
        "env": ["SEGMENT_WRITE_KEY", "NEXT_PUBLIC_SEGMENT_WRITE_KEY"],
        "init": [r"AnalyticsBrowser\.load\s*\(", r"new\s+Analytics\s*\(\s*\{\s*writeKey"],
        "hosts": ["cdn.segment.com", "api.segment.io"],
        "files": [],
    },

    # ---------------- monitoring ----------------
    "Sentry": {
        "category": "monitoring",
        "packages": ["@sentry/nextjs", "@sentry/node", "@sentry/react", "@sentry/browser",
                     "@sentry/sveltekit", "@sentry/vue", "sentry-sdk"],
        "env": ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN", "SENTRY_AUTH_TOKEN", "SENTRY_ORG"],
        "init": [r"Sentry\.init\s*\(", r"sentry_sdk\.init\s*\("],
        "hosts": ["sentry.io", "ingest.sentry.io"],
        "files": ["sentry.*.config.*", "sentry.properties", ".sentryclirc"],
    },
    "Datadog": {
        "category": "monitoring",
        "packages": ["dd-trace", "@datadog/browser-rum", "@datadog/browser-logs", "datadog-api-client"],
        "env": ["DD_API_KEY", "DATADOG_API_KEY", "DD_SITE", "DD_APP_KEY"],
        "init": [r"datadogRum\.init\s*\(", r"datadogLogs\.init\s*\("],
        "hosts": ["datadoghq.com"],
        "files": ["datadog.yaml"],
    },
    "New Relic": {
        "category": "monitoring",
        "packages": ["newrelic", "@newrelic/next"],
        "env": ["NEW_RELIC_LICENSE_KEY", "NEW_RELIC_APP_NAME"],
        "init": [],
        "hosts": ["newrelic.com"],
        "files": ["newrelic.js", "newrelic.ini"],
    },
    "LogRocket": {
        "category": "monitoring",
        "packages": ["logrocket", "logrocket-react"],
        "env": ["LOGROCKET_APP_ID", "NEXT_PUBLIC_LOGROCKET_ID"],
        "init": [r"LogRocket\.init\s*\("],
        "hosts": ["logrocket.com"],
        "files": [],
    },

    # ---------------- infra / hosting / backend ----------------
    "Firebase": {
        "category": "infra",
        "packages": ["firebase", "firebase-admin", "@react-native-firebase/app", "firebase-functions"],
        "env": ["FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY", "FIREBASE_PROJECT_ID",
                "GOOGLE_APPLICATION_CREDENTIALS", "FIREBASE_AUTH_DOMAIN"],
        "init": [r"initializeApp\s*\(", r"getFirestore\s*\(", r"getAuth\s*\("],
        "hosts": ["firebaseio.com", "firebaseapp.com", "googleapis.com/identitytoolkit"],
        "files": ["firebase.json", ".firebaserc", "firestore.rules", "storage.rules"],
    },
    "Supabase": {
        "category": "infra",
        "packages": ["@supabase/supabase-js", "@supabase/ssr", "@supabase/auth-helpers-nextjs",
                     "supabase", "supabase-py"],
        "env": ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_ANON_KEY",
                "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
                "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_DB_URL"],
        "init": [r"createClient\s*\(", r"createServerClient\s*\(", r"createBrowserClient\s*\("],
        "hosts": ["supabase.co", "supabase.in"],
        "files": ["supabase/config.toml", "supabase/*.sql"],
    },
    "AWS": {
        "category": "infra",
        "packages": ["aws-sdk", "@aws-sdk/client-s3", "@aws-sdk/client-ses", "@aws-sdk/client-dynamodb",
                     "@aws-sdk/client-sqs", "boto3", "aws-cdk-lib", "serverless"],
        "env": ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_S3_BUCKET",
                "AWS_SESSION_TOKEN", "AWS_DEFAULT_REGION"],
        "init": [r"new\s+S3Client\s*\(", r"boto3\.client\s*\(", r"new\s+DynamoDBClient\s*\("],
        "hosts": ["amazonaws.com"],
        "files": ["serverless.yml", "serverless.yaml", "template.yaml", "samconfig.toml"],
    },
    "Cloudflare": {
        "category": "infra",
        "packages": ["wrangler", "@cloudflare/workers-types", "cloudflare", "@cloudflare/next-on-pages"],
        "env": ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "CF_API_TOKEN", "R2_ACCESS_KEY_ID"],
        "init": [],
        "hosts": ["cloudflare.com", "workers.dev", "r2.cloudflarestorage.com"],
        "files": ["wrangler.toml", "wrangler.jsonc", "wrangler.json", "_headers", "_redirects"],
    },
    "Vercel": {
        "category": "infra",
        "packages": ["@vercel/analytics", "@vercel/speed-insights", "@vercel/kv", "@vercel/blob",
                     "@vercel/postgres", "vercel"],
        "env": ["VERCEL_URL", "VERCEL_ENV", "VERCEL_TOKEN", "VERCEL_PROJECT_ID", "BLOB_READ_WRITE_TOKEN"],
        "init": [r"<Analytics\s*/?>", r"<SpeedInsights\s*/?>"],
        "hosts": ["vercel.app", "vercel.com"],
        "files": ["vercel.json", ".vercel/project.json"],
    },
    "Netlify": {
        "category": "infra",
        "packages": ["netlify-cli", "@netlify/functions"],
        "env": ["NETLIFY_AUTH_TOKEN", "NETLIFY_SITE_ID"],
        "init": [],
        "hosts": ["netlify.app", "netlify.com"],
        "files": ["netlify.toml"],
    },
    "GitHub Actions": {
        "category": "infra",
        "packages": [],
        "env": ["GITHUB_TOKEN", "GH_TOKEN", "ACTIONS_RUNTIME_TOKEN"],
        "init": [],
        "hosts": [],
        "files": [".github/workflows/*.yml", ".github/workflows/*.yaml"],
    },

    # ---------------- payments ----------------
    "Stripe": {
        "category": "payments",
        "packages": ["stripe", "@stripe/stripe-js", "@stripe/react-stripe-js"],
        "env": ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
                "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_ID"],
        "init": [r"new\s+Stripe\s*\(", r"loadStripe\s*\(", r"stripe\.webhooks\.constructEvent\s*\("],
        "hosts": ["api.stripe.com", "js.stripe.com"],
        "files": [],
    },
    "Paddle": {
        "category": "payments",
        "packages": ["@paddle/paddle-js", "@paddle/paddle-node-sdk", "paddle-sdk"],
        "env": ["PADDLE_API_KEY", "PADDLE_VENDOR_ID", "PADDLE_WEBHOOK_SECRET",
                "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN"],
        "init": [r"Paddle\.(?:Setup|Initialize)\s*\("],
        "hosts": ["paddle.com", "paddlejs"],
        "files": [],
    },
    "RevenueCat": {
        "category": "payments",
        "packages": ["react-native-purchases", "@revenuecat/purchases-js", "purchases-hybrid-common"],
        "env": ["REVENUECAT_API_KEY", "RC_API_KEY", "REVENUECAT_WEBHOOK_SECRET"],
        "init": [r"Purchases\.configure\s*\("],
        "hosts": ["revenuecat.com"],
        "files": [],
    },

    # ---------------- auth ----------------
    "Clerk": {
        "category": "auth",
        "packages": ["@clerk/nextjs", "@clerk/clerk-react", "@clerk/backend", "@clerk/clerk-sdk-node"],
        "env": ["CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_WEBHOOK_SECRET"],
        "init": [r"<ClerkProvider", r"clerkMiddleware\s*\(", r"authMiddleware\s*\("],
        "hosts": ["clerk.com", "clerk.accounts.dev"],
        "files": [],
    },
    "Auth0": {
        "category": "auth",
        "packages": ["@auth0/nextjs-auth0", "@auth0/auth0-react", "auth0", "@auth0/auth0-spa-js"],
        "env": ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET",
                "AUTH0_ISSUER_BASE_URL"],
        "init": [r"<Auth0Provider", r"initAuth0\s*\("],
        "hosts": ["auth0.com"],
        "files": [],
    },

    # ---------------- AI ----------------
    "OpenAI": {
        "category": "ai",
        "packages": ["openai", "@ai-sdk/openai", "langchain-openai"],
        "env": ["OPENAI_API_KEY", "OPENAI_ORG_ID", "OPENAI_BASE_URL", "OPENAI_PROJECT_ID"],
        "init": [r"new\s+OpenAI\s*\(", r"OpenAI\s*\(\s*api_key", r"openai\.ChatCompletion"],
        "hosts": ["api.openai.com"],
        "files": [],
    },
    "Anthropic": {
        "category": "ai",
        "packages": ["@anthropic-ai/sdk", "anthropic", "@ai-sdk/anthropic", "langchain-anthropic"],
        "env": ["ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL"],
        "init": [r"new\s+Anthropic\s*\(", r"Anthropic\s*\(\s*api_key"],
        "hosts": ["api.anthropic.com"],
        "files": [],
    },
    "Google Gemini": {
        "category": "ai",
        "packages": ["@google/generative-ai", "@google/genai", "google-generativeai", "@ai-sdk/google"],
        "env": ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_AI_API_KEY"],
        "init": [r"GoogleGenerativeAI\s*\(", r"genai\.configure\s*\("],
        "hosts": ["generativelanguage.googleapis.com"],
        "files": [],
    },
    "xAI": {
        "category": "ai",
        "packages": ["@ai-sdk/xai", "xai-sdk"],
        "env": ["XAI_API_KEY", "GROK_API_KEY"],
        "init": [],
        "hosts": ["api.x.ai"],
        "files": [],
    },
    "Replicate": {
        "category": "ai",
        "packages": ["replicate"],
        "env": ["REPLICATE_API_TOKEN"],
        "init": [r"new\s+Replicate\s*\(", r"replicate\.run\s*\("],
        "hosts": ["api.replicate.com"],
        "files": [],
    },
    "Hugging Face": {
        "category": "ai",
        "packages": ["@huggingface/inference", "huggingface_hub", "transformers"],
        "env": ["HUGGINGFACE_API_KEY", "HF_TOKEN", "HUGGINGFACEHUB_API_TOKEN"],
        "init": [r"new\s+HfInference\s*\(", r"InferenceClient\s*\("],
        "hosts": ["huggingface.co", "api-inference.huggingface.co"],
        "files": [],
    },
    "AWS Bedrock": {
        "category": "ai",
        "packages": ["@aws-sdk/client-bedrock-runtime", "@ai-sdk/amazon-bedrock"],
        "env": ["BEDROCK_REGION", "AWS_BEDROCK_MODEL_ID"],
        "init": [r"BedrockRuntimeClient\s*\(", r"bedrock-runtime"],
        "hosts": ["bedrock-runtime"],
        "files": [],
    },
    "Azure AI": {
        "category": "ai",
        "packages": ["@azure/openai", "@azure/ai-inference", "azure-ai-inference"],
        "env": ["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_DEPLOYMENT"],
        "init": [r"AzureOpenAI\s*\(", r"new\s+OpenAIClient\s*\("],
        "hosts": ["openai.azure.com"],
        "files": [],
    },

    # ---------------- email / messaging / support ----------------
    "Resend": {
        "category": "email",
        "packages": ["resend", "@react-email/components"],
        "env": ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
        "init": [r"new\s+Resend\s*\("],
        "hosts": ["api.resend.com"],
        "files": [],
    },
    "SendGrid": {
        "category": "email",
        "packages": ["@sendgrid/mail", "@sendgrid/client", "sendgrid"],
        "env": ["SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL"],
        "init": [r"sgMail\.setApiKey\s*\("],
        "hosts": ["api.sendgrid.com"],
        "files": [],
    },
    "Mailgun": {
        "category": "email",
        "packages": ["mailgun.js", "mailgun-js", "mailgun"],
        "env": ["MAILGUN_API_KEY", "MAILGUN_DOMAIN"],
        "init": [r"new\s+Mailgun\s*\("],
        "hosts": ["api.mailgun.net"],
        "files": [],
    },
    "Twilio": {
        "category": "email",
        "packages": ["twilio", "@twilio/conversations"],
        "env": ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER",
                "TWILIO_MESSAGING_SERVICE_SID"],
        "init": [r"twilio\s*\(\s*", r"new\s+Twilio\s*\("],
        "hosts": ["api.twilio.com"],
        "files": [],
    },
    "Intercom": {
        "category": "email",
        "packages": ["@intercom/messenger-js-sdk", "intercom-client", "react-intercom"],
        "env": ["INTERCOM_APP_ID", "NEXT_PUBLIC_INTERCOM_APP_ID", "INTERCOM_ACCESS_TOKEN"],
        "init": [r"Intercom\s*\(\s*", r"window\.Intercom"],
        "hosts": ["intercom.io", "intercomcdn.com"],
        "files": [],
    },
}

CATEGORY_NOTE = {
    "analytics": "analytics / tracking",
    "payments": "payments & billing",
    "ai": "AI model providers",
    "auth": "identity & authentication",
    "email": "communications (email / SMS / in-app messaging)",
    "infra": "hosting, storage, backend platform",
    "monitoring": "monitoring, error tracking, session replay",
}


def _escape_alternation(items: list[str]) -> str:
    return "|".join(re.escape(item) for item in sorted(items, key=len, reverse=True))


def build_matchers() -> tuple[dict[str, tuple[re.Pattern[str], dict[str, str]]], list[tuple[str, list[str]]]]:
    """Build ONE union regex per signal kind.

    Scanning 40 processors x 4 signal kinds per line is quadratic enough to
    matter on a real repository, so each kind becomes a single alternation
    whose named groups identify the processor.
    """
    parts: dict[str, list[str]] = {"packages": [], "env": [], "init": [], "hosts": []}
    names: dict[str, dict[str, str]] = {"packages": {}, "env": {}, "init": {}, "hosts": {}}
    file_globs: list[tuple[str, list[str]]] = []

    for index, (name, spec) in enumerate(REGISTRY.items()):
        group = f"p{index}"
        if spec.get("packages"):
            parts["packages"].append(
                f"(?P<{group}>(?<![\\w./-])(?:{_escape_alternation(spec['packages'])})(?![\\w./-]))"
            )
            names["packages"][group] = name
        if spec.get("env"):
            parts["env"].append(f"(?P<{group}>\\b(?:{_escape_alternation(spec['env'])})\\b)")
            names["env"][group] = name
        if spec.get("init"):
            inner = "|".join(f"(?:{pattern})" for pattern in spec["init"])
            parts["init"].append(f"(?P<{group}>{inner})")
            names["init"][group] = name
        if spec.get("hosts"):
            parts["hosts"].append(f"(?P<{group}>{_escape_alternation(spec['hosts'])})")
            names["hosts"][group] = name
        if spec.get("files"):
            file_globs.append((name, spec["files"]))

    # Cheap prefilter per kind: one alternation with no capture groups, used to
    # skip the (much more expensive) named union on the overwhelming majority
    # of lines that mention no processor at all.
    bare: dict[str, list[str]] = {"packages": [], "env": [], "init": [], "hosts": []}
    for name, spec in REGISTRY.items():
        if spec.get("packages"):
            bare["packages"].extend(spec["packages"])
        if spec.get("env"):
            bare["env"].extend(spec["env"])
        if spec.get("hosts"):
            bare["hosts"].extend(spec["hosts"])
        if spec.get("init"):
            bare["init"].extend(spec["init"])

    prefilter_templates = {
        "packages": r"(?<![\w./-])(?:{})(?![\w./-])",
        "env": r"\b(?:{})\b",
        "hosts": r"(?:{})",
    }

    unions: dict[str, tuple[re.Pattern[str], re.Pattern[str], dict[str, str]]] = {}
    for kind, fragments in parts.items():
        if not fragments:
            continue
        if kind == "init":
            prefilter = re.compile("|".join(f"(?:{p})" for p in bare["init"]))
        else:
            prefilter = re.compile(
                prefilter_templates[kind].format(_escape_alternation(bare[kind]))
            )
        unions[kind] = (prefilter, re.compile("|".join(fragments)), names[kind])
    return unions, file_globs


def _matched_processor(match: re.Match[str], names: dict[str, str]) -> tuple[str, str] | None:
    for group, value in match.groupdict().items():
        if value is not None and group in names:
            return names[group], value
    return None


def is_scannable(path: str, max_bytes: int) -> bool:
    ext = os.path.splitext(path)[1].lower()
    if ext in SKIP_EXTENSIONS:
        return False
    try:
        if os.path.getsize(path) > max_bytes:
            return False
        with open(path, "rb") as handle:
            return b"\x00" not in handle.read(8192)
    except OSError:
        return False


def iter_files(root: str, skip_dirs: set[str], max_bytes: int):
    if os.path.isfile(root):
        if is_scannable(root, max_bytes):
            yield root
        return
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in skip_dirs)
        for name in sorted(filenames):
            full = os.path.join(dirpath, name)
            if not os.path.islink(full) and is_scannable(full, max_bytes):
                yield full


def path_matches(rel_path: str, patterns: list[str]) -> str | None:
    normalised = rel_path.replace(os.sep, "/")
    base = os.path.basename(normalised)
    for pattern in patterns:
        if fnmatch.fnmatch(normalised, pattern) or fnmatch.fnmatch(base, pattern):
            return pattern
    return None


def scan(root: str, skip_dirs: set[str], max_bytes: int, per_kind_limit: int):
    unions, file_globs = build_matchers()
    results: dict[str, dict] = {}
    files_scanned = 0

    def record(name: str, kind: str, rel: str, line_no: int, detail: str) -> None:
        bucket = results.setdefault(
            name,
            {"name": name, "category": REGISTRY[name]["category"], "evidence": [], "_counts": {}},
        )
        counts = bucket["_counts"]
        if counts.get(kind, 0) >= per_kind_limit:
            return
        counts[kind] = counts.get(kind, 0) + 1
        bucket["evidence"].append(
            {"kind": kind, "file": rel, "line": line_no, "detail": detail}
        )

    for path in iter_files(root, skip_dirs, max_bytes):
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as handle:
                lines = handle.read().splitlines()
        except OSError:
            continue
        files_scanned += 1
        rel = os.path.relpath(path, root) if os.path.isdir(root) else os.path.basename(path)
        base = os.path.basename(path)
        is_manifest = base in MANIFEST_FILES

        for name, globs in file_globs:
            matched_glob = path_matches(rel, globs)
            if matched_glob:
                record(name, "config_file", rel, 1, matched_glob)

        for index, line in enumerate(lines, start=1):
            if len(line) > 4000:
                line = line[:4000]
            for kind, (prefilter, union, names) in unions.items():
                if not prefilter.search(line):
                    continue
                for match in union.finditer(line):
                    resolved = _matched_processor(match, names)
                    if resolved is None:
                        continue
                    name, text = resolved
                    if kind == "packages":
                        if is_manifest:
                            signal = "dependency"
                        elif IMPORT_CONTEXT.search(line):
                            signal = "import"
                        else:
                            signal = "reference"
                        record(name, signal, rel, index, text)
                    elif kind == "env":
                        record(name, "env_var_name", rel, index, text)
                    elif kind == "init":
                        record(name, "sdk_init", rel, index, text.strip()[:60])
                    else:
                        record(name, "network_host", rel, index, text)

    for bucket in results.values():
        bucket.pop("_counts", None)
        bucket["signal_kinds"] = sorted({e["kind"] for e in bucket["evidence"]})
        bucket["evidence_count"] = len(bucket["evidence"])

    return results, files_scanned


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="scan_processors.py",
        description="READ-ONLY detection of third-party processors from manifests, imports, "
        "SDK init calls, env-var NAMES, config files and hostnames.",
        epilog="exit 0 = scan completed, 2 = usage error. "
        "The family list is a starting point, never the whole answer.",
    )
    parser.add_argument("target", help="directory or file to scan")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    parser.add_argument(
        "--max-evidence",
        type=int,
        default=3,
        help="max evidence items kept per processor per signal kind (default 3)",
    )
    parser.add_argument(
        "--max-bytes", type=int, default=2_000_000, help="skip files larger than this (default 2000000)"
    )
    parser.add_argument(
        "--exclude", action="append", default=[], metavar="DIRNAME",
        help="additional directory name to skip (repeatable)",
    )
    parser.add_argument(
        "--min-signals", type=int, default=1,
        help="only report processors with at least this many distinct signal kinds (default 1)",
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
    results, files_scanned = scan(root, skip_dirs, args.max_bytes, max(1, args.max_evidence))

    processors = [
        bucket for bucket in results.values() if len(bucket["signal_kinds"]) >= args.min_signals
    ]
    processors.sort(key=lambda b: (b["category"], b["name"]))

    if args.json:
        print(
            json.dumps(
                {
                    "scanner": "scan_processors",
                    "target": root,
                    "files_scanned": files_scanned,
                    "processors_count": len(processors),
                    "processors": processors,
                    "note": "env vars are reported by NAME only; no values are read or stored",
                },
                indent=2,
            )
        )
        return 0

    print(f"processor scan: {root}  ({files_scanned} text files scanned)")
    if not processors:
        print("OK: no known third-party processor families detected")
        print("(absence of a family match is not proof of no processors — read the project too)")
        return 0

    print(f"\nDETECTED PROCESSORS: {len(processors)}")
    current_category = None
    for bucket in processors:
        if bucket["category"] != current_category:
            current_category = bucket["category"]
            print(f"\n[{current_category}] {CATEGORY_NOTE.get(current_category, '')}")
        print(f"  {bucket['name']}  ({', '.join(bucket['signal_kinds'])})")
        for item in bucket["evidence"]:
            print(f"      {item['file']}:{item['line']}  {item['kind']}: {item['detail']}")
    print("\n(env vars are listed by NAME only — values are never read)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
