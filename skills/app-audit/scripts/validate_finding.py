#!/usr/bin/env python3
"""Validate /app-audit finding JSON against schemas/finding.schema.json.

The target file may hold a single finding object or an array of findings.
Uses the `jsonschema` package when available, otherwise the built-in
structural validator in schema_util.py (stdlib only).

Exit codes: 0 = all valid, 1 = at least one document invalid,
            2 = usage / unreadable schema.
"""

from __future__ import annotations

import os
import sys

sys.dont_write_bytecode = True  # keep the skill directory free of __pycache__
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from schema_util import run_cli  # noqa: E402

USAGE = """usage: validate_finding.py FILE.json [MORE.json ...] [--schema PATH] [--quiet]

  FILE.json    a single finding object, or an array of finding objects
  --schema     validate against a different schema (name or path);
               defaults to schemas/finding.schema.json
  --quiet      print only failures

exit 0 = valid, 1 = invalid, 2 = usage error"""


if __name__ == "__main__":
    sys.exit(run_cli(sys.argv[1:], default_schema="finding.schema.json", usage=USAGE))
