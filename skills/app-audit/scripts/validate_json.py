#!/usr/bin/env python3
"""Validate any JSON file against any /app-audit schema.

Generic entry point used for the application profile and the audit state
(the finding and registry validators are the dedicated ones).

    validate_json.py application-profile profile.json
    validate_json.py audit-state .app-audit/state.json
    validate_json.py /abs/path/to/custom.schema.json data.json

Exit codes: 0 = valid, 1 = invalid, 2 = usage / unreadable schema.
"""

from __future__ import annotations

import os
import sys

sys.dont_write_bytecode = True  # keep the skill directory free of __pycache__
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from schema_util import run_cli  # noqa: E402

USAGE = """usage: validate_json.py SCHEMA FILE.json [MORE.json ...] [--quiet]

  SCHEMA       schema name resolved against skills/app-audit/schemas/
               (finding | application-profile | source-registry | audit-state)
               or an explicit path to a .json schema file
  --quiet      print only failures

exit 0 = valid, 1 = invalid, 2 = usage error"""


if __name__ == "__main__":
    argv = sys.argv[1:]
    if argv and argv[0] in ("-h", "--help"):
        print(USAGE)
        sys.exit(0)
    if len(argv) < 2:
        print(f"error: SCHEMA and at least one FILE are required\n\n{USAGE}", file=sys.stderr)
        sys.exit(2)
    schema_arg, rest = argv[0], argv[1:]
    # A bare registry document is one document even when it is an array.
    array_means_many = "source-registry" not in schema_arg
    sys.exit(
        run_cli(
            rest,
            default_schema=schema_arg,
            usage=USAGE,
            array_means_many=array_means_many,
        )
    )
