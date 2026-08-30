#!/usr/bin/env python3
"""Validate an /app-audit source registry against schemas/source-registry.schema.json.

The registry root may be either a bare array of entries or an object with an
`entries` array plus freshness metadata — the schema accepts both, so the whole
file is validated as one document.

Uses the `jsonschema` package when available, otherwise the built-in structural
validator in schema_util.py (stdlib only).

Exit codes: 0 = valid, 1 = invalid, 2 = usage / unreadable schema.
"""

from __future__ import annotations

import os
import sys

sys.dont_write_bytecode = True  # keep the skill directory free of __pycache__
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from schema_util import run_cli  # noqa: E402

USAGE = """usage: validate_registry.py FILE.json [MORE.json ...] [--schema PATH] [--quiet]

  FILE.json    source registry: array of entries, or {"entries": [...]}
  --schema     validate against a different schema (name or path);
               defaults to schemas/source-registry.schema.json
  --quiet      print only failures

exit 0 = valid, 1 = invalid, 2 = usage error"""


if __name__ == "__main__":
    sys.exit(
        run_cli(
            sys.argv[1:],
            default_schema="source-registry.schema.json",
            usage=USAGE,
            array_means_many=False,
        )
    )
