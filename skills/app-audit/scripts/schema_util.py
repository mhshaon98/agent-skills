#!/usr/bin/env python3
"""Shared JSON Schema validation engine for /app-audit.

Uses the `jsonschema` package when it is importable. When it is not (the
common case on a stock macOS python3), falls back to a built-in structural
validator implemented with the standard library only.

The fallback supports the subset of JSON Schema draft 2020-12 actually used
by the app-audit schemas:

    $ref (local "#/..." pointers), type, enum, const, required, properties,
    additionalProperties, items, minItems, maxItems, uniqueItems,
    minLength, maxLength, pattern, minimum, maximum, multipleOf,
    format (date / date-time only), anyOf, oneOf, allOf

Anything else in a schema is ignored by the fallback rather than guessed at.
Keep the schemas inside this subset so both engines agree.
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import re
import sys
from typing import Any

SCHEMA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "schemas")

try:  # pragma: no cover - depends on the machine
    import jsonschema as _jsonschema  # type: ignore

    HAVE_JSONSCHEMA = True
except Exception:  # noqa: BLE001
    _jsonschema = None  # type: ignore
    HAVE_JSONSCHEMA = False

ENGINE = "jsonschema" if HAVE_JSONSCHEMA else "builtin-fallback"


# --------------------------------------------------------------------------
# loading helpers
# --------------------------------------------------------------------------


def resolve_schema_path(name_or_path: str) -> str:
    """Accept a bare schema name, a file name, or an absolute/relative path."""
    if os.path.isfile(name_or_path):
        return os.path.abspath(name_or_path)
    candidates = [
        os.path.join(SCHEMA_DIR, name_or_path),
        os.path.join(SCHEMA_DIR, name_or_path + ".json"),
        os.path.join(SCHEMA_DIR, name_or_path + ".schema.json"),
    ]
    for cand in candidates:
        if os.path.isfile(cand):
            return os.path.abspath(cand)
    raise FileNotFoundError(f"schema not found: {name_or_path} (looked in {SCHEMA_DIR})")


def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


# --------------------------------------------------------------------------
# built-in fallback validator
# --------------------------------------------------------------------------

_TYPE_MAP = {
    "object": dict,
    "array": list,
    "string": str,
    "number": (int, float),
    "integer": int,
    "boolean": bool,
    "null": type(None),
}

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _type_name(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def _check_type(value: Any, expected: str) -> bool:
    py = _TYPE_MAP.get(expected)
    if py is None:
        return True  # unknown type keyword: do not guess
    if expected == "boolean":
        return isinstance(value, bool)
    if expected in ("integer", "number") and isinstance(value, bool):
        return False  # bool is a subclass of int in Python; JSON disagrees
    if expected == "integer" and isinstance(value, float):
        return value.is_integer()
    return isinstance(value, py)


def _short(value: Any, limit: int = 60) -> str:
    try:
        text = json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        text = repr(value)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _resolve_ref(root: Any, ref: str) -> Any:
    if not ref.startswith("#"):
        raise ValueError(f"only local $ref pointers are supported, got: {ref}")
    pointer = ref[1:]
    node = root
    if not pointer:
        return node
    for raw in pointer.lstrip("/").split("/"):
        token = raw.replace("~1", "/").replace("~0", "~")
        if isinstance(node, list):
            node = node[int(token)]
        else:
            node = node[token]
    return node


class _Fallback:
    def __init__(self, root: Any) -> None:
        self.root = root

    def validate(self, instance: Any, schema: Any, path: str = "$") -> list[str]:
        errors: list[str] = []
        if schema is True or schema == {}:
            return errors
        if schema is False:
            return [f"{path}: schema forbids any value here"]
        if not isinstance(schema, dict):
            return errors

        if "$ref" in schema:
            target = _resolve_ref(self.root, schema["$ref"])
            errors.extend(self.validate(instance, target, path))
            rest = {k: v for k, v in schema.items() if k != "$ref"}
            if rest:
                errors.extend(self.validate(instance, rest, path))
            return errors

        # --- type -------------------------------------------------------
        if "type" in schema:
            expected = schema["type"]
            expected_list = expected if isinstance(expected, list) else [expected]
            if not any(_check_type(instance, exp) for exp in expected_list):
                errors.append(
                    f"{path}: expected type {'/'.join(expected_list)}, got "
                    f"{_type_name(instance)} ({_short(instance)})"
                )
                return errors  # further keywords would just add noise

        # --- const / enum ----------------------------------------------
        if "const" in schema and instance != schema["const"]:
            errors.append(f"{path}: must be {_short(schema['const'])}, got {_short(instance)}")
        if "enum" in schema:
            allowed = schema["enum"]
            if not any(instance == opt and _type_name(instance) == _type_name(opt) for opt in allowed):
                errors.append(
                    f"{path}: {_short(instance)} is not one of "
                    f"{', '.join(_short(o, 30) for o in allowed)}"
                )

        # --- combinators ------------------------------------------------
        for keyword in ("anyOf", "oneOf"):
            if keyword in schema:
                subs = schema[keyword]
                matched = []
                sub_errors: list[str] = []
                for index, sub in enumerate(subs):
                    sub_result = self.validate(instance, sub, path)
                    if not sub_result:
                        matched.append(index)
                    else:
                        sub_errors.extend(f"  [{keyword}#{index}] {e}" for e in sub_result)
                if keyword == "anyOf" and not matched:
                    errors.append(
                        f"{path}: does not match any allowed variant ({_short(instance)})"
                    )
                    errors.extend(sub_errors)
                if keyword == "oneOf":
                    if not matched:
                        errors.append(
                            f"{path}: does not match any allowed variant ({_short(instance)})"
                        )
                        errors.extend(sub_errors)
                    elif len(matched) > 1:
                        errors.append(
                            f"{path}: matches {len(matched)} variants, expected exactly one"
                        )
        if "allOf" in schema:
            for sub in schema["allOf"]:
                errors.extend(self.validate(instance, sub, path))

        # --- per-kind checks -------------------------------------------
        if isinstance(instance, dict):
            errors.extend(self._object(instance, schema, path))
        elif isinstance(instance, list):
            errors.extend(self._array(instance, schema, path))
        elif isinstance(instance, str):
            errors.extend(self._string(instance, schema, path))
        elif isinstance(instance, (int, float)) and not isinstance(instance, bool):
            errors.extend(self._number(instance, schema, path))

        return errors

    def _object(self, instance: dict, schema: dict, path: str) -> list[str]:
        errors: list[str] = []
        for key in schema.get("required", []):
            if key not in instance:
                errors.append(f"{path}: missing required property '{key}'")
        props = schema.get("properties", {})
        for key, value in instance.items():
            child = f"{path}.{key}"
            if key in props:
                errors.extend(self.validate(value, props[key], child))
            else:
                extra = schema.get("additionalProperties", True)
                if extra is False:
                    known = ", ".join(sorted(props)) or "(none)"
                    errors.append(
                        f"{child}: unknown property '{key}' is not allowed "
                        f"(known properties: {known})"
                    )
                elif isinstance(extra, dict):
                    errors.extend(self.validate(value, extra, child))
        if "minProperties" in schema and len(instance) < schema["minProperties"]:
            errors.append(f"{path}: needs at least {schema['minProperties']} properties")
        return errors

    def _array(self, instance: list, schema: dict, path: str) -> list[str]:
        errors: list[str] = []
        if "items" in schema:
            for index, item in enumerate(instance):
                errors.extend(self.validate(item, schema["items"], f"{path}[{index}]"))
        if "minItems" in schema and len(instance) < schema["minItems"]:
            errors.append(f"{path}: needs at least {schema['minItems']} items, got {len(instance)}")
        if "maxItems" in schema and len(instance) > schema["maxItems"]:
            errors.append(f"{path}: allows at most {schema['maxItems']} items, got {len(instance)}")
        if schema.get("uniqueItems"):
            seen: list[str] = []
            for item in instance:
                key = json.dumps(item, sort_keys=True, ensure_ascii=False)
                if key in seen:
                    errors.append(f"{path}: duplicate item {_short(item)}")
                    break
                seen.append(key)
        return errors

    def _string(self, instance: str, schema: dict, path: str) -> list[str]:
        errors: list[str] = []
        if "minLength" in schema and len(instance) < schema["minLength"]:
            errors.append(
                f"{path}: string shorter than minLength {schema['minLength']} ({_short(instance)})"
            )
        if "maxLength" in schema and len(instance) > schema["maxLength"]:
            errors.append(f"{path}: string longer than maxLength {schema['maxLength']}")
        if "pattern" in schema and not re.search(schema["pattern"], instance):
            errors.append(f"{path}: {_short(instance)} does not match pattern {schema['pattern']}")
        fmt = schema.get("format")
        if fmt == "date":
            if not _DATE_RE.match(instance):
                errors.append(f"{path}: {_short(instance)} is not a YYYY-MM-DD date")
            else:
                try:
                    _dt.date.fromisoformat(instance)
                except ValueError:
                    errors.append(f"{path}: {_short(instance)} is not a valid calendar date")
        elif fmt == "date-time":
            try:
                _dt.datetime.fromisoformat(instance.replace("Z", "+00:00"))
            except ValueError:
                errors.append(f"{path}: {_short(instance)} is not an ISO 8601 date-time")
        return errors

    def _number(self, instance: Any, schema: dict, path: str) -> list[str]:
        errors: list[str] = []
        if "minimum" in schema and instance < schema["minimum"]:
            errors.append(f"{path}: {instance} is below minimum {schema['minimum']}")
        if "maximum" in schema and instance > schema["maximum"]:
            errors.append(f"{path}: {instance} is above maximum {schema['maximum']}")
        if "exclusiveMinimum" in schema and instance <= schema["exclusiveMinimum"]:
            errors.append(f"{path}: {instance} must be > {schema['exclusiveMinimum']}")
        if "exclusiveMaximum" in schema and instance >= schema["exclusiveMaximum"]:
            errors.append(f"{path}: {instance} must be < {schema['exclusiveMaximum']}")
        return errors


# --------------------------------------------------------------------------
# public API
# --------------------------------------------------------------------------


def validate_instance(instance: Any, schema: Any, path: str = "$") -> list[str]:
    """Return a list of human-readable error strings ([] means valid)."""
    if HAVE_JSONSCHEMA:
        validator_cls = _jsonschema.validators.validator_for(schema)  # type: ignore[union-attr]
        # jsonschema treats "format" as an annotation unless a checker is given;
        # the built-in fallback always checks dates, so enable it for parity.
        checker = getattr(validator_cls, "FORMAT_CHECKER", None)
        validator = validator_cls(schema, format_checker=checker) if checker else validator_cls(schema)
        errors = []
        for err in sorted(validator.iter_errors(instance), key=lambda e: list(e.absolute_path)):
            loc = path
            for part in err.absolute_path:
                loc += f"[{part}]" if isinstance(part, int) else f".{part}"
            errors.append(f"{loc}: {err.message}")
        return errors
    return _Fallback(schema).validate(instance, schema, path)


def validate_documents(
    data: Any,
    schema: Any,
    *,
    array_means_many: bool = True,
    label: str = "$",
) -> tuple[int, list[str]]:
    """Validate a single object or an array of objects.

    Returns (documents_validated, errors).
    """
    if array_means_many and isinstance(data, list):
        errors: list[str] = []
        for index, item in enumerate(data):
            errors.extend(validate_instance(item, schema, f"{label}[{index}]"))
        return len(data), errors
    return 1, validate_instance(data, schema, label)


def run_cli(
    argv: list[str],
    *,
    default_schema: str | None,
    usage: str,
    array_means_many: bool = True,
) -> int:
    """Shared main() for the validator entry points."""
    args = list(argv)
    schema_name = default_schema
    files: list[str] = []
    quiet = False

    index = 0
    while index < len(args):
        arg = args[index]
        if arg in ("-h", "--help"):
            print(usage)
            return 0
        if arg == "--schema":
            index += 1
            if index >= len(args):
                print(f"error: --schema needs a value\n\n{usage}", file=sys.stderr)
                return 2
            schema_name = args[index]
        elif arg == "--quiet":
            quiet = True
        elif arg.startswith("-"):
            print(f"error: unknown option {arg}\n\n{usage}", file=sys.stderr)
            return 2
        else:
            files.append(arg)
        index += 1

    if not files or schema_name is None:
        print(f"error: expected at least one JSON file to validate\n\n{usage}", file=sys.stderr)
        return 2

    try:
        schema_path = resolve_schema_path(schema_name)
        schema = load_json(schema_path)
    except (OSError, ValueError) as exc:
        print(f"error: cannot load schema: {exc}", file=sys.stderr)
        return 2

    failed = False
    for target in files:
        try:
            data = load_json(target)
        except OSError as exc:
            print(f"INVALID {target}\n  $: cannot read file: {exc}")
            failed = True
            continue
        except json.JSONDecodeError as exc:
            print(f"INVALID {target}\n  $: not valid JSON: {exc}")
            failed = True
            continue

        count, errors = validate_documents(data, schema, array_means_many=array_means_many)
        if errors:
            failed = True
            print(f"INVALID {target}  ({count} document(s), {len(errors)} error(s), engine={ENGINE})")
            for err in errors:
                print(f"  {err}")
        elif not quiet:
            print(f"VALID   {target}  ({count} document(s), engine={ENGINE})")

    return 1 if failed else 0


def _main(argv: list[str]) -> int:
    usage = (
        "usage: schema_util.py <schema-name-or-path> <file.json> [more.json ...]\n"
        "       schema-name resolves against skills/app-audit/schemas/\n"
        "       (e.g. 'finding', 'audit-state', 'application-profile')"
    )
    if len(argv) < 2:
        print(usage, file=sys.stderr)
        return 2
    return run_cli(argv[1:], default_schema=argv[0], usage=usage)


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))
