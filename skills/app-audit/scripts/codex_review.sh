#!/usr/bin/env bash
# codex_review.sh — READ-ONLY independent Codex peer review for /app-audit.
#
#   usage: codex_review.sh PROMPT_FILE [WORKDIR]
#
# Sends the contents of PROMPT_FILE to Codex as a review task, executed from
# WORKDIR (default: current directory), and prints Codex's answer on stdout.
#
#   exit 0   review text printed on stdout
#   exit 2   Codex unavailable / the turn failed — prints
#            "CODEX_UNAVAILABLE: <reason>" on stdout, nothing is fabricated
#   exit 64  usage error (bad arguments / unreadable prompt file)
#
# Transport, in order:
#   1. the openai-codex plugin companion:
#        node <companion> task --model gpt-5.6-sol --effort medium "<prompt>"
#      (located by globbing the plugin cache and picking the highest version)
#   2. fallback CLI:
#        codex exec --skip-git-repo-check -s read-only \
#          -c model="gpt-5.6-sol" -c model_reasoning_effort="medium" \
#          "<prompt>" </dev/null
#      (the </dev/null is mandatory — without it the CLI can hang for minutes)
#
# READ-ONLY BY CONSTRUCTION: --write is never passed to the companion and the
# fallback always runs in the read-only sandbox. Codex is never asked to write
# anything under the skill directory.
#
# MODEL DISCIPLINE: the model is pinned to gpt-5.6-sol at effort medium (Sol
# defaults to LOW effort, so medium must be explicit). A wrong or unavailable
# model is a REPORTED FAILURE — never a silent downgrade, never a fabricated
# review. APP_AUDIT_CODEX_MODEL / APP_AUDIT_CODEX_EFFORT can override the pin,
# but only by explicit user direction (they exist for diagnostics, not for
# routine audits).
#
# IMPORTANT: the companion exits 0 even when the turn fails, so success is
# judged from the output markers, not from the exit code.
#
# Other environment overrides:
#   APP_AUDIT_PLUGIN_GLOB   glob used to find codex-companion.mjs (testability)
#   APP_AUDIT_CODEX_LENIENT 1 = accept companion output that lacks a
#                           "Turn completed" marker but shows no error markers
#                           (diagnostic escape hatch only)

set -uo pipefail

DEFAULT_MODEL="gpt-5.6-sol"
DEFAULT_EFFORT="medium"
MODEL="${APP_AUDIT_CODEX_MODEL:-$DEFAULT_MODEL}"
EFFORT="${APP_AUDIT_CODEX_EFFORT:-$DEFAULT_EFFORT}"
PLUGIN_GLOB="${APP_AUDIT_PLUGIN_GLOB:-$HOME/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs}"
LENIENT="${APP_AUDIT_CODEX_LENIENT:-0}"

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
}

fail_unavailable() {
  # Single, unambiguous failure contract for callers.
  local reason
  reason="$(printf '%s' "$1" | tr '\n' ' ' | tr -s ' ' | cut -c1-400)"
  printf 'CODEX_UNAVAILABLE: %s\n' "$reason"
  exit 2
}

if [ "$#" -lt 1 ]; then
  usage >&2
  echo "error: PROMPT_FILE is required" >&2
  exit 64
fi
case "$1" in
  -h | --help)
    usage
    exit 0
    ;;
esac

PROMPT_FILE="$1"
WORKDIR="${2:-$PWD}"

if [ ! -f "$PROMPT_FILE" ] || [ ! -r "$PROMPT_FILE" ]; then
  usage >&2
  echo "error: prompt file not readable: $PROMPT_FILE" >&2
  exit 64
fi
if [ ! -d "$WORKDIR" ]; then
  usage >&2
  echo "error: workdir is not a directory: $WORKDIR" >&2
  exit 64
fi

PROMPT="$(cat "$PROMPT_FILE")"
if [ -z "${PROMPT//[[:space:]]/}" ]; then
  usage >&2
  echo "error: prompt file is empty: $PROMPT_FILE" >&2
  exit 64
fi

# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

find_companion() {
  # Highest version wins. An unmatched glob expands to itself and is filtered
  # out by the -f test, so an empty/mismatched glob yields nothing.
  local candidate version best="" best_version="" newer
  local matches
  # shellcheck disable=SC2206
  matches=( $PLUGIN_GLOB )
  for candidate in "${matches[@]}"; do
    [ -f "$candidate" ] || continue
    version="$(basename "$(dirname "$(dirname "$candidate")")")"
    if [ -z "$best" ]; then
      best="$candidate"
      best_version="$version"
      continue
    fi
    newer="$(printf '%s\n%s\n' "$best_version" "$version" | sort -V | tail -n 1)"
    if [ "$newer" = "$version" ] && [ "$newer" != "$best_version" ]; then
      best="$candidate"
      best_version="$version"
    fi
  done
  printf '%s' "$best"
}

strip_progress() {
  # Drop the companion's "[codex] ..." progress chatter, keep the review text.
  grep -v '^[[:space:]]*\[codex\]' || true
}

has_failure_marker() {
  printf '%s' "$1" | grep -Eq '\[codex\] Turn failed|\[codex\] Codex error|"type"[[:space:]]*:[[:space:]]*"error"'
}

first_error_line() {
  printf '%s' "$1" \
    | grep -Em1 '\[codex\] Turn failed|\[codex\] Codex error|"type"[[:space:]]*:[[:space:]]*"error"' \
    | cut -c1-400
}

# --------------------------------------------------------------------------
# transport 1: plugin companion (read-only; --write is never passed)
# --------------------------------------------------------------------------

REASONS=""
add_reason() { REASONS="${REASONS:+$REASONS; }$1"; }

COMPANION="$(find_companion)"

if [ -z "$COMPANION" ]; then
  add_reason "codex-companion.mjs not found via glob '$PLUGIN_GLOB'"
elif ! command -v node >/dev/null 2>&1; then
  add_reason "node not found on PATH (companion $COMPANION unusable)"
else
  COMPANION_OUT="$(cd "$WORKDIR" && node "$COMPANION" task \
    --model "$MODEL" --effort "$EFFORT" "$PROMPT" 2>&1)"
  COMPANION_RC=$?

  if has_failure_marker "$COMPANION_OUT"; then
    add_reason "companion turn failed: $(first_error_line "$COMPANION_OUT")"
  else
    BODY="$(printf '%s\n' "$COMPANION_OUT" | strip_progress)"
    if [ -z "${BODY//[[:space:]]/}" ]; then
      add_reason "companion returned no assistant message (rc=$COMPANION_RC)"
    elif printf '%s' "$COMPANION_OUT" | grep -Eq 'Turn completed|turn[._]completed'; then
      printf '%s\n' "$BODY"
      exit 0
    elif [ "$LENIENT" = "1" ]; then
      printf '%s\n' "$BODY"
      exit 0
    else
      add_reason "companion produced no completed-turn marker (rc=$COMPANION_RC)"
    fi
  fi
fi

# --------------------------------------------------------------------------
# transport 2: codex CLI fallback (read-only sandbox; </dev/null is required)
# --------------------------------------------------------------------------

if ! command -v codex >/dev/null 2>&1; then
  add_reason "codex CLI not found on PATH"
  fail_unavailable "$REASONS"
fi

CLI_OUT="$(cd "$WORKDIR" && codex exec --skip-git-repo-check -s read-only \
  -c model="$MODEL" -c model_reasoning_effort="$EFFORT" \
  "$PROMPT" </dev/null 2>&1)"
CLI_RC=$?

if [ "$CLI_RC" -ne 0 ]; then
  add_reason "codex exec failed (rc=$CLI_RC): $(printf '%s' "$CLI_OUT" | tail -n 3 | cut -c1-300)"
  fail_unavailable "$REASONS"
fi
if has_failure_marker "$CLI_OUT"; then
  add_reason "codex exec reported an error: $(first_error_line "$CLI_OUT")"
  fail_unavailable "$REASONS"
fi

CLI_BODY="$(printf '%s\n' "$CLI_OUT" | strip_progress)"
if [ -z "${CLI_BODY//[[:space:]]/}" ]; then
  add_reason "codex exec returned empty output"
  fail_unavailable "$REASONS"
fi

printf '%s\n' "$CLI_BODY"
exit 0
