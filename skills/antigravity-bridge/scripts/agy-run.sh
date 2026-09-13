#!/usr/bin/env bash
# agy-run.sh - the ONLY sanctioned way for Claude Code to call Antigravity CLI.
#
# Why a wrapper and not a bare `agy -p`:
#   1. agy lives in ~/.local/bin, which a non-login Bash tool shell may not have on PATH.
#   2. Issue #76: `agy -p` can silently emit NOTHING when stdout is not a TTY - exactly
#      how Claude calls it. We detect that (rc=0 + empty stdout) and retry under a pty.
#   3. An open non-TTY stdin makes CLI agents wait for input forever (the codex-exec
#      lesson). stdin is always closed here.
#   4. Headless runs must never hang a session: hard timeout, always.
#
# Usage:
#   agy-run.sh [--model M] [--effort low|medium|high] [--timeout 600]
#              [--format text|json|stream-json] [--schema FILE] [--dir PATH]
#              [--write] [--continue|--conversation ID] -- "<prompt>"
#
# Exit codes: 0 ok | 124 timeout | 125 not installed | 126 not signed in
#             127 empty output even under a pty | else agy's own code.

set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"

MODEL=""; EFFORT=""; TIMEOUT=600; FORMAT="text"; SCHEMA=""; WRITE=0
EXTRA=(); DIRS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --model)        MODEL="$2"; shift 2 ;;
    --effort)       EFFORT="$2"; shift 2 ;;
    --timeout)      TIMEOUT="$2"; shift 2 ;;
    --format)       FORMAT="$2"; shift 2 ;;
    --schema)       SCHEMA="$2"; shift 2 ;;
    --dir)          DIRS+=(--add-dir "$2"); shift 2 ;;
    --write)        WRITE=1; shift ;;
    --continue)     EXTRA+=(--continue); shift ;;
    --conversation) EXTRA+=(--conversation "$2"); shift 2 ;;
    --)             shift; break ;;
    *)              echo "agy-run: unknown flag $1" >&2; exit 2 ;;
  esac
done
PROMPT="${1:-}"
[ -z "$PROMPT" ] && { echo "agy-run: no prompt given" >&2; exit 2; }

# ---- Model policy ----
# Medium or low effort - never max; high only on Flash. agy bakes effort into the slug.
# Claude picks the model; Claude models via agy are banned (they share Claude's
# blind spots, which destroys the only reason this bridge exists).
case "$MODEL" in
  claude-*)        echo "agy-run: POLICY - Claude models via agy are banned. Use a gemini-* slug." >&2; exit 2 ;;
  *flash*-high)    : ;;   # high IS allowed on Flash - it is the cheap tier
  *-high)          echo "agy-run: POLICY - high effort is allowed on Flash models only. Pro/other: use -medium or -low." >&2; exit 2 ;;
esac

command -v agy >/dev/null 2>&1 || {
  echo "agy-run: Antigravity CLI not installed on this machine." >&2
  echo "  curl -fsSL https://antigravity.google/cli/install.sh | bash" >&2
  exit 125; }

# agy bakes reasoning effort INTO the model slug (…-high/-medium/-low), so --model and
# --effort are mutually exclusive - agy itself errors if both arrive. Refuse loudly rather
# than silently dropping one (an earlier version defaulted MODEL, which made --effort a
# permanent no-op: the default is only applied when the caller asked for NEITHER).
if [ -n "$MODEL" ] && [ -n "$EFFORT" ]; then
  echo "agy-run: --model and --effort are mutually exclusive (agy bakes effort into the slug)." >&2
  echo "  Pick one: --model gemini-3.8-flash-medium   OR   --effort medium" >&2
  exit 2
fi
[ -n "$MODEL" ] || [ -n "$EFFORT" ] || MODEL="gemini-3.8-flash-medium"
ARGS=(--output-format "$FORMAT" --print-timeout "${TIMEOUT}s")
[ -n "$EFFORT" ] && ARGS+=(--effort "$EFFORT")
[ -n "$MODEL" ]  && ARGS+=(--model "$MODEL")
[ -n "$SCHEMA" ] && ARGS+=(--json-schema "$SCHEMA")
[ ${#DIRS[@]}  -gt 0 ] && ARGS+=("${DIRS[@]}")
[ ${#EXTRA[@]} -gt 0 ] && ARGS+=("${EXTRA[@]}")
# Read-only by default. --write auto-approves tool calls; the CALLER is responsible for
# having asked the user first (see SKILL.md section 4).
[ "$WRITE" = 1 ] && ARGS+=(--dangerously-skip-permissions)

# Portable hard timeout (macOS has no coreutils `timeout`).
run_with_timeout() {
  perl -e 'my $t=shift; my $pid=fork();
           if(!$pid){ open(STDIN,"<","/dev/null"); exec @ARGV; exit 127 }
           local $SIG{ALRM}=sub{ kill 9,$pid; waitpid $pid,0; exit 124 };
           alarm $t; waitpid $pid,0; my $st=$?; alarm 0;
           exit(($st & 127) ? 128 + ($st & 127) : ($st >> 8))' "$@"
}

OUT="$(run_with_timeout "$((TIMEOUT+30))" agy "${ARGS[@]}" --print="$PROMPT" 2>/tmp/agy-run.err)"
RC=$?

if [ $RC -eq 124 ]; then
  echo "agy-run: TIMEOUT after ${TIMEOUT}s. Partial stderr:" >&2; tail -5 /tmp/agy-run.err >&2; exit 124
fi
if grep -qi "sign in\|not authenticated\|please log in" /tmp/agy-run.err 2>/dev/null; then
  echo "agy-run: not signed in. The user must run \`agy\` interactively once on this machine." >&2
  exit 126
fi

# Issue #76 fallback: succeeded but produced nothing -> retry through a pty.
if [ $RC -eq 0 ] && [ -z "${OUT//[[:space:]]/}" ]; then
  if command -v script >/dev/null 2>&1; then
    echo "agy-run: empty stdout on a pipe (issue #76) - retrying under a pty." >&2
    if script -q /dev/null true >/dev/null 2>&1; then           # BSD / macOS
      OUT="$(run_with_timeout "$((TIMEOUT+30))" script -q /dev/null agy "${ARGS[@]}" --print="$PROMPT" 2>>/tmp/agy-run.err)"
    else                                                        # util-linux
      OUT="$(run_with_timeout "$((TIMEOUT+30))" script -qec "agy $(printf '%q ' "${ARGS[@]}") --print=$(printf '%q' "$PROMPT")" /dev/null 2>>/tmp/agy-run.err)"
    fi
    RC=$?
    OUT="$(printf '%s' "$OUT" | tr -d '\r')"
  fi
  if [ -z "${OUT//[[:space:]]/}" ]; then
    if [ "$RC" -eq 124 ]; then
      echo "agy-run: TIMEOUT during the pty retry after ${TIMEOUT}s." >&2; tail -5 /tmp/agy-run.err >&2; exit 124
    fi
    echo "agy-run: no output even under a pty. stderr:" >&2; tail -10 /tmp/agy-run.err >&2; exit 127
  fi
fi

# Tools are soft-denied outside a TRUSTED workspace, which yields SUCCESS with an
# empty response. That is a setup failure, not an answer - never report it as one.
# A denied action is only a FAILURE if it left the model with no answer. In read-only
# mode RunCommand is denied by design and the run usually still succeeds via file reads.
if printf '%s' "$OUT" | grep -q '"denied_actions"'; then
  if printf '%s' "$OUT" | grep -q '"response":""'; then
    echo "agy-run: agy denied tool calls AND returned nothing. Either:" >&2
    echo "  (a) the task needs shell access - re-run with --write (ask the user first), or" >&2
    echo "  (b) the directory is outside every trusted workspace - the user runs \`agy\` once" >&2
    echo "      inside it and accepts (~/.gemini/antigravity-cli/settings.json)." >&2
    printf '%s\n' "$OUT"
    exit 4
  fi
  echo "agy-run: note - some tool calls were denied (read-only mode); answer came from file reads." >&2
fi

# agy exits 0 even when its JSON envelope carries status ERROR. Surface it.
if [ "$FORMAT" = json ] && printf '%s' "$OUT" | grep -q '"status":"ERROR"'; then
  echo "agy-run: agy reported ERROR (exit code was $RC):" >&2
  printf '%s\n' "$OUT" | sed -n 's/.*"error":"\([^"]*\)".*/  \1/p' >&2
  printf '%s\n' "$OUT"
  exit 3
fi

printf '%s\n' "$OUT"
exit $RC
