#!/usr/bin/env bash
# Interactive skill installer — lists the catalog, installs what you pick.
# Usage: ./install.sh            (run from a clone)
#        ./install.sh name1 name2 ... [--codex] [--all]
set -euo pipefail
cd "$(dirname "$0")"

DEST="$HOME/.claude/skills"
PICKS=()
ALL=0
for a in "$@"; do
  case "$a" in
    --codex) DEST="${CODEX_HOME:-$HOME/.codex}/skills" ;;
    --all)   ALL=1 ;;
    *)       PICKS+=("$a") ;;
  esac
done

command -v python3 >/dev/null || { echo "python3 required (parses skills.json)"; exit 1; }
[ -f skills.json ] || { echo "skills.json not found — run from a repo clone"; exit 1; }

mapfile -t NAMES < <(python3 -c "import json;[print(s['name']) for s in json.load(open('skills.json'))]")
mapfile -t DESCS < <(python3 -c "import json;[print(s['description']) for s in json.load(open('skills.json'))]")

if [ "$ALL" -eq 1 ]; then
  PICKS=("${NAMES[@]}")
elif [ "${#PICKS[@]}" -eq 0 ]; then
  echo ""
  echo "  Available skills"
  echo "  ----------------"
  for i in "${!NAMES[@]}"; do
    printf "  %2d) %-24s %s\n" "$((i+1))" "${NAMES[$i]}" "${DESCS[$i]}"
  done
  echo ""
  read -rp "Install which? (numbers/names, space-separated, or 'all'): " ANSWER
  [ "$ANSWER" = "all" ] && PICKS=("${NAMES[@]}") || {
    for tok in $ANSWER; do
      if [[ "$tok" =~ ^[0-9]+$ ]]; then PICKS+=("${NAMES[$((tok-1))]}"); else PICKS+=("$tok"); fi
    done
  }
fi

[ "${#PICKS[@]}" -gt 0 ] || { echo "Nothing selected."; exit 0; }
mkdir -p "$DEST"
for name in "${PICKS[@]}"; do
  if [ ! -d "skills/$name" ]; then echo "  !! unknown skill: $name (skipped)"; continue; fi
  if [ -d "$DEST/$name" ]; then
    read -rp "  $name already exists in $DEST — replace? [y/N]: " R
    [[ "$R" =~ ^[Yy]$ ]] || { echo "  -- kept existing $name"; continue; }
    rm -rf "$DEST/$name"
  fi
  cp -R "skills/$name" "$DEST/$name"
  echo "  ok installed $name -> $DEST/$name"
done
echo "Done. New skills load on your next session."
