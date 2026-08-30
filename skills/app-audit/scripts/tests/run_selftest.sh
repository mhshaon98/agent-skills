#!/usr/bin/env bash
# run_selftest.sh — deterministic self-test for the /app-audit deterministic layer.
#
# Exercises every schema, validator and read-only scanner against the sample
# assets in scripts/tests/, plus the codex wrapper's FAILURE path.
#
# It never makes a network call and never runs a live Codex completion:
# the codex checks run with a stripped PATH and an empty companion glob.
#
# exit 0 = every check passed, 1 = at least one check failed.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="$(dirname "$HERE")"
SKILL="$(dirname "$SCRIPTS")"
SAMPLES="$HERE/samples"
SCHEMAS="$SKILL/schemas"
PY="${PYTHON:-python3}"
TODAY="2026-08-20"
export PYTHONDONTWRITEBYTECODE=1

# Split so this file does not itself contain a full credential-shaped literal.
SEEDED_SECRET="sk_test""_000fakefakefake"

PASS_COUNT=0
FAIL_COUNT=0
LAST_OUT=""
LAST_RC=0

pass() { printf 'PASS  %s\n' "$1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() {
  printf 'FAIL  %s\n        reason: %s\n' "$1" "$2"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

run() {
  LAST_OUT="$("$@" 2>&1)"
  LAST_RC=$?
}

expect_rc() {
  local name="$1" want="$2"
  shift 2
  run "$@"
  if [ "$LAST_RC" -eq "$want" ]; then
    pass "$name (rc=$LAST_RC)"
  else
    fail "$name" "expected rc $want, got $LAST_RC | $(printf '%s' "$LAST_OUT" | head -n 3 | tr '\n' ' ')"
  fi
}

expect_out() {
  local name="$1" needle="$2"
  if printf '%s' "$LAST_OUT" | grep -qF -- "$needle"; then
    pass "$name"
  else
    fail "$name" "output did not contain: $needle"
  fi
}

expect_not_out() {
  local name="$1" needle="$2"
  if printf '%s' "$LAST_OUT" | grep -qF -- "$needle"; then
    fail "$name" "output unexpectedly contained: $needle"
  else
    pass "$name"
  fi
}

expect_eq() {
  local name="$1" got="$2" want="$3"
  if [ "$got" = "$want" ]; then
    pass "$name"
  else
    fail "$name" "expected '$want', got '$got'"
  fi
}

pyeval() { # pyeval <json-text> <python-expression over d>
  printf '%s' "$1" | "$PY" -c "import sys,json;d=json.load(sys.stdin);print($2)" 2>&1
}

section() { printf '\n--- %s\n' "$1"; }

TMPDIR_SELFTEST="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_SELFTEST"' EXIT

printf '/app-audit deterministic layer selftest\n'
printf 'skill dir : %s\n' "$SKILL"
printf 'python    : %s\n' "$($PY --version 2>&1)"
printf 'engine    : %s\n' "$($PY -c "import sys;sys.path.insert(0,'$SCRIPTS');import schema_util;print(schema_util.ENGINE)" 2>&1)"
printf 'evaluated as of: %s\n' "$TODAY"

# ---------------------------------------------------------------------------
section "1. schemas parse and declare draft 2020-12"
for schema in finding application-profile source-registry audit-state; do
  path="$SCHEMAS/$schema.schema.json"
  if [ ! -f "$path" ]; then
    fail "schema $schema exists" "missing file $path"
    continue
  fi
  run "$PY" -c "import json,sys;d=json.load(open(sys.argv[1]));assert '2020-12' in d.get('\$schema',''),'wrong \$schema';print('ok')" "$path"
  if [ "$LAST_RC" -eq 0 ]; then
    pass "schema $schema.schema.json is valid JSON (draft 2020-12)"
  else
    fail "schema $schema.schema.json is valid JSON (draft 2020-12)" "$(printf '%s' "$LAST_OUT" | tail -n 1)"
  fi
done

# ---------------------------------------------------------------------------
section "2. finding validator"
expect_rc "valid findings accepted" 0 "$PY" "$SCRIPTS/validate_finding.py" "$SAMPLES/finding.valid.json"
expect_out "valid findings report 3 documents" "3 document(s)"

expect_rc "invalid findings rejected" 1 "$PY" "$SCRIPTS/validate_finding.py" "$SAMPLES/finding.invalid.json"
expect_out "rejects bad status enum" "FAILED"
expect_out "rejects bad severity enum" "BLOCKER"
expect_out "rejects bad confidence enum" "PRETTY_SURE"
expect_out "rejects bad provenance value" "gut_feeling"
expect_out "rejects codex_review without 'performed'" "missing required property 'performed'"
expect_out "rejects missing required confidence" "missing required property 'confidence'"
expect_out "rejects missing required evidence" "missing required property 'evidence'"
expect_out "rejects typo'd unknown property" "sevrity"

expect_rc "finding validator usage error" 2 "$PY" "$SCRIPTS/validate_finding.py"
expect_out "finding validator prints usage" "usage: validate_finding.py"

# ---------------------------------------------------------------------------
section "3. registry validator"
expect_rc "valid registry object accepted" 0 "$PY" "$SCRIPTS/validate_registry.py" "$SAMPLES/registry.valid.json"
expect_rc "valid bare-array registry accepted" 0 "$PY" "$SCRIPTS/validate_registry.py" "$SAMPLES/registry.fresh.json"

expect_rc "invalid registry rejected" 1 "$PY" "$SCRIPTS/validate_registry.py" "$SAMPLES/registry.invalid.json"
expect_out "rejects bad status enum" "PROBABLY_STILL_GOOD"
expect_out "rejects non-date last_verified" "August 2026"
expect_out "rejects unknown root key" "unexpected_root_key"

expect_rc "registry validator usage error" 2 "$PY" "$SCRIPTS/validate_registry.py"
expect_out "registry validator prints usage" "usage: validate_registry.py"

# ---------------------------------------------------------------------------
section "4. profile and state schemas (generic validator)"
expect_rc "valid application profile accepted" 0 "$PY" "$SCRIPTS/validate_json.py" application-profile "$SAMPLES/profile.valid.json"
expect_rc "invalid application profile rejected" 1 "$PY" "$SCRIPTS/validate_json.py" application-profile "$SAMPLES/profile.invalid.json"
expect_out "profile: rejects missing maturity" "missing required property 'maturity'"
expect_out "profile: rejects string where array required" "expected type array"
expect_out "profile: rejects bad processor category" "billing"

expect_rc "valid audit state accepted" 0 "$PY" "$SCRIPTS/validate_json.py" audit-state "$SAMPLES/state.valid.json"
expect_rc "invalid audit state rejected" 1 "$PY" "$SCRIPTS/validate_json.py" audit-state "$SAMPLES/state.invalid.json"
expect_out "state: rejects bad launch_readiness" "PROBABLY_FINE"
expect_out "state: rejects bad router classification" "PROBABLY_APPLIES"
expect_out "state: rejects bad depth" "EXHAUSTIVE"
expect_out "state: rejects bad mode" "deep_dive"
expect_out "state: rejects negative counter" "below minimum"
expect_out "state: rejects incomplete criticals_challenged" "criticals_challenged"

expect_rc "generic validator usage error" 2 "$PY" "$SCRIPTS/validate_json.py"
expect_out "generic validator prints usage" "usage: validate_json.py"

# ---------------------------------------------------------------------------
section "5. freshness check"
expect_rc "stale registry flagged (exit 3)" 3 "$PY" "$SCRIPTS/freshness_check.py" "$SAMPLES/registry.valid.json" --today "$TODAY"
expect_out "flags 2 of 3 entries" "SOURCE_REVIEW_REQUIRED: 2 of 3"
expect_out "flags the stale statute" "CCPA-THRESHOLDS"
expect_out "reports days stale" "stale by 132d"
expect_out "flags the VACATED entry" "FTC-CLICK-TO-CANCEL"
expect_out "explains the VACATED reason" "status=VACATED"
expect_not_out "does not flag the fresh platform policy" "- PLAY-DATA-SAFETY"

expect_rc "all-fresh registry passes (exit 0)" 0 "$PY" "$SCRIPTS/freshness_check.py" "$SAMPLES/registry.fresh.json" --today "$TODAY"
expect_out "reports all fresh" "all entries fresh"

expect_rc "window overrides applied (exit 0)" 0 "$PY" "$SCRIPTS/freshness_check.py" "$SAMPLES/registry.valid.json" --today "$TODAY" --statute-days 400 --no-flag-noncurrent
expect_out "override widened the statute window" "statute=400d"

run "$PY" "$SCRIPTS/freshness_check.py" "$SAMPLES/registry.valid.json" --today "$TODAY" --json
expect_eq "freshness --json review_required_count is 2" "$(pyeval "$LAST_OUT" "d['review_required_count']")" "2"
expect_eq "freshness --json days_stale is 132" "$(pyeval "$LAST_OUT" "[e['days_stale'] for e in d['review_required'] if e['rule_id']=='CCPA-THRESHOLDS'][0]")" "132"

expect_rc "freshness usage error" 2 "$PY" "$SCRIPTS/freshness_check.py"
expect_out "freshness prints usage" "usage: freshness_check.py"

# ---------------------------------------------------------------------------
section "6. secret scanner"
expect_rc "seeded secret found (exit 3)" 3 "$PY" "$SCRIPTS/scan_secrets.py" "$HERE/scan-target"
expect_out "reports the stripe test key rule" "stripe_test_secret_key"
expect_out "reports file and line" "src/config.js:3"
expect_out "value is redacted" "sk_t****"
expect_not_out "full secret is never printed" "$SEEDED_SECRET"

run "$PY" "$SCRIPTS/scan_secrets.py" "$HERE/scan-target" --json
expect_eq "secret scanner --json finds exactly 1" "$(pyeval "$LAST_OUT" "d['findings_count']")" "1"
expect_eq "secret scanner --json rule id" "$(pyeval "$LAST_OUT" "d['findings'][0]['rule']")" "stripe_test_secret_key"
expect_not_out "json output never contains the raw secret" "$SEEDED_SECRET"

GENERIC_DIR="$TMPDIR_SELFTEST/generic"
mkdir -p "$GENERIC_DIR"
{
  printf '# selftest generic-rule fixture\n'
  printf 'API_KEY=%s\n' "9fKq2Zb7Lm4Xc1Rv8Tn6Yd3Wh5Ps0Ju"
  printf 'DEMO_API_KEY=your-key-here\n'
  printf 'PORT=8080\n'
} >"$GENERIC_DIR/.env.local"
expect_rc "generic high-entropy assignment detected" 3 "$PY" "$SCRIPTS/scan_secrets.py" "$GENERIC_DIR"
expect_out "generic rule names the key" "key=API_KEY"
expect_not_out "placeholder value is ignored" "DEMO_API_KEY"
expect_not_out "port number is ignored" "PORT"

expect_rc "clean tree is silent (exit 0)" 0 "$PY" "$SCRIPTS/scan_secrets.py" "$HERE/clean-target"
expect_out "clean tree reports OK" "no likely committed secrets found"

expect_rc "secret scanner usage error" 2 "$PY" "$SCRIPTS/scan_secrets.py"
expect_out "secret scanner prints usage" "usage: scan_secrets.py"

# ---------------------------------------------------------------------------
section "7. processor scanner"
expect_rc "processor scan completes" 0 "$PY" "$SCRIPTS/scan_processors.py" "$HERE/scan-target"
expect_out "detects PostHog" "PostHog"
expect_out "detects Stripe" "Stripe"
expect_out "detects OpenAI" "OpenAI"
expect_out "categorises analytics" "[analytics]"
expect_out "categorises payments" "[payments]"
expect_out "categorises ai" "[ai]"
expect_out "cites manifest evidence" "package.json:"
expect_out "cites env var NAME evidence" "env_var_name"

run "$PY" "$SCRIPTS/scan_processors.py" "$HERE/scan-target" --json
expect_eq "processor --json names" "$(pyeval "$LAST_OUT" "','.join(sorted(p['name'] for p in d['processors']))")" "OpenAI,PostHog,Stripe"
expect_eq "processor --json categories" "$(pyeval "$LAST_OUT" "','.join(sorted({p['category'] for p in d['processors']}))")" "ai,analytics,payments"
expect_eq "PostHog evidence has file:line" "$(pyeval "$LAST_OUT" "[bool(e['file']) and e['line']>0 for p in d['processors'] if p['name']=='PostHog' for e in p['evidence']][0]")" "True"

expect_rc "clean tree has no processors (exit 0)" 0 "$PY" "$SCRIPTS/scan_processors.py" "$HERE/clean-target"
expect_out "clean tree reports none detected" "no known third-party processor families detected"

expect_rc "processor scanner usage error" 2 "$PY" "$SCRIPTS/scan_processors.py"
expect_out "processor scanner prints usage" "usage: scan_processors.py"

# ---------------------------------------------------------------------------
section "8. codex wrapper — static contract (no live call)"
CODEX_SH="$SCRIPTS/codex_review.sh"
if [ -x "$CODEX_SH" ]; then
  pass "codex_review.sh is executable"
else
  fail "codex_review.sh is executable" "chmod +x missing"
fi

if grep -qF 'DEFAULT_MODEL="gpt-5.6-sol"' "$CODEX_SH"; then
  pass "model pinned to gpt-5.6-sol"
else
  fail "model pinned to gpt-5.6-sol" "default model pin not found"
fi
if grep -qF 'DEFAULT_EFFORT="medium"' "$CODEX_SH"; then
  pass "effort pinned to medium"
else
  fail "effort pinned to medium" "default effort pin not found"
fi
if grep -v '^[[:space:]]*#' "$CODEX_SH" | grep -qF -- '--write'; then
  fail "never passes --write" "an executable line contains --write"
else
  pass "never passes --write"
fi
if grep -v '^[[:space:]]*#' "$CODEX_SH" | grep -qF -- '-s read-only'; then
  pass "fallback uses the read-only sandbox"
else
  fail "fallback uses the read-only sandbox" "-s read-only not found in executable lines"
fi
if grep -v '^[[:space:]]*#' "$CODEX_SH" | grep -qF -- '</dev/null'; then
  pass "fallback redirects stdin from /dev/null (anti-hang)"
else
  fail "fallback redirects stdin from /dev/null (anti-hang)" "redirect not found"
fi
if grep -v '^[[:space:]]*#' "$CODEX_SH" | grep -qF -- 'Turn failed'; then
  pass "detects companion turn failure by output marker"
else
  fail "detects companion turn failure by output marker" "'Turn failed' marker check not found"
fi

# ---------------------------------------------------------------------------
section "9. codex wrapper — failure path (offline, no live completion)"
PROMPT_FILE="$TMPDIR_SELFTEST/prompt.txt"
printf 'Selftest prompt. This must never reach a model.\n' >"$PROMPT_FILE"
EMPTY_GLOB="$TMPDIR_SELFTEST/no-plugins/*/scripts/codex-companion.mjs"

expect_rc "codex wrapper usage error without arguments" 64 bash "$CODEX_SH"
expect_out "codex wrapper prints usage" "usage: codex_review.sh PROMPT_FILE"

expect_rc "codex wrapper rejects an unreadable prompt file" 64 bash "$CODEX_SH" "$TMPDIR_SELFTEST/does-not-exist.txt"

expect_rc "codex unavailable path exits 2" 2 \
  env -i HOME="$HOME" PATH=/usr/bin:/bin \
  APP_AUDIT_PLUGIN_GLOB="$EMPTY_GLOB" \
  bash "$CODEX_SH" "$PROMPT_FILE" "$TMPDIR_SELFTEST"
expect_out "prints CODEX_UNAVAILABLE" "CODEX_UNAVAILABLE:"
expect_out "reason names the missing companion" "codex-companion.mjs not found"
expect_out "reason names the missing CLI" "codex CLI not found on PATH"
expect_not_out "never fabricates review text" "Turn completed"

# ---------------------------------------------------------------------------
section "10. codex wrapper — transport logic against a LOCAL STUB companion"
# The stub is a plain node script on disk. No API call is made and no Codex
# model is contacted: this checks argument pinning, highest-version selection,
# progress-line stripping, and the "exit 0 but the turn failed" trap.
STUB_ROOT="$TMPDIR_SELFTEST/plugins/openai-codex/codex"
mkdir -p "$STUB_ROOT/1.0.6/scripts" "$STUB_ROOT/1.0.10/scripts" "$STUB_ROOT/1.0.2/scripts"

cat >"$STUB_ROOT/1.0.10/scripts/codex-companion.mjs" <<'STUB'
// LOCAL STUB — no network, no model. Echoes back what the wrapper passed.
const args = process.argv.slice(2);
console.log("[codex] Starting task...");
console.log("STUB_VERSION=1.0.10");
console.log("STUB_ARGS=" + args.join(" "));
console.log("STUB_CWD=" + process.cwd());
console.log("Independent review: no material issues identified in the stub input.");
console.log("[codex] Turn completed.");
process.exit(0);
STUB
cp "$STUB_ROOT/1.0.10/scripts/codex-companion.mjs" "$STUB_ROOT/1.0.6/scripts/codex-companion.mjs"
sed -i.bak 's/1\.0\.10/1.0.6/' "$STUB_ROOT/1.0.6/scripts/codex-companion.mjs"
cp "$STUB_ROOT/1.0.10/scripts/codex-companion.mjs" "$STUB_ROOT/1.0.2/scripts/codex-companion.mjs"
sed -i.bak 's/1\.0\.10/1.0.2/' "$STUB_ROOT/1.0.2/scripts/codex-companion.mjs"
rm -f "$STUB_ROOT"/*/scripts/*.bak

mkdir -p "$TMPDIR_SELFTEST/failplugin/codex/1.0.0/scripts"
cat >"$TMPDIR_SELFTEST/failplugin/codex/1.0.0/scripts/codex-companion.mjs" <<'STUB'
// LOCAL STUB — reproduces the real failure shape: the turn fails but exit is 0.
console.log("[codex] Starting task...");
console.error('[codex] Codex error: {"type":"error","status":400,"message":"unsupported model"}');
console.error("[codex] Turn failed.");
process.exit(0);
STUB

# A PATH that has node but deliberately NOT codex, so a stub failure can never
# fall through to a live CLI completion.
STUB_BIN="$TMPDIR_SELFTEST/bin"
mkdir -p "$STUB_BIN"
NODE_BIN="$(command -v node || true)"
if [ -n "$NODE_BIN" ]; then
  ln -sf "$NODE_BIN" "$STUB_BIN/node"
fi
STUB_PATH="$STUB_BIN:/usr/bin:/bin"

if [ -z "$NODE_BIN" ]; then
  fail "stub companion checks" "node not found on PATH — cannot run the stub transport tests"
elif PATH="$STUB_PATH" command -v codex >/dev/null 2>&1; then
  fail "stub PATH excludes codex" "codex is resolvable under the stub PATH — aborting to avoid a live call"
else
  pass "stub PATH has node but not codex (no live completion possible)"

  expect_rc "stub companion success path exits 0" 0 \
    env -i HOME="$HOME" PATH="$STUB_PATH" \
    APP_AUDIT_PLUGIN_GLOB="$STUB_ROOT/*/scripts/codex-companion.mjs" \
    bash "$CODEX_SH" "$PROMPT_FILE" "$TMPDIR_SELFTEST"
  expect_out "picks the highest companion version (1.0.10)" "STUB_VERSION=1.0.10"
  expect_out "passes the pinned model and effort" "task --model gpt-5.6-sol --effort medium"
  # macOS resolves /var -> /private/var, so compare against the real path.
  expect_out "runs from the requested WORKDIR" "STUB_CWD=$(cd "$TMPDIR_SELFTEST" && pwd -P)"
  expect_out "relays the review text" "Independent review:"
  expect_not_out "strips [codex] progress lines" "[codex] Turn completed."
  expect_not_out "strips [codex] start lines" "[codex] Starting task"

  expect_rc "turn-failed-but-exit-0 is treated as failure" 2 \
    env -i HOME="$HOME" PATH="$STUB_PATH" \
    APP_AUDIT_PLUGIN_GLOB="$TMPDIR_SELFTEST/failplugin/codex/*/scripts/codex-companion.mjs" \
    bash "$CODEX_SH" "$PROMPT_FILE" "$TMPDIR_SELFTEST"
  expect_out "failed turn prints CODEX_UNAVAILABLE" "CODEX_UNAVAILABLE:"
  expect_out "failed turn surfaces the model error" "unsupported model"

  expect_rc "explicit model override is honoured" 0 \
    env -i HOME="$HOME" PATH="$STUB_PATH" \
    APP_AUDIT_CODEX_MODEL="gpt-5.6-sol" APP_AUDIT_CODEX_EFFORT="high" \
    APP_AUDIT_PLUGIN_GLOB="$STUB_ROOT/*/scripts/codex-companion.mjs" \
    bash "$CODEX_SH" "$PROMPT_FILE" "$TMPDIR_SELFTEST"
  expect_out "override reaches the companion arguments" "--effort high"
fi

# ---------------------------------------------------------------------------
printf '\n===========================================\n'
printf 'checks passed: %d\n' "$PASS_COUNT"
printf 'checks failed: %d\n' "$FAIL_COUNT"
if [ "$FAIL_COUNT" -eq 0 ]; then
  printf 'SELFTEST: PASS\n'
  exit 0
fi
printf 'SELFTEST: FAIL\n'
exit 1
