#!/usr/bin/env python3
"""Checks that the shared test cases in spec/fixtures are well-formed, so every
app that copies them gets valid cases. Run: python3 scripts/check_spec.py"""
import json, pathlib, sys

root = pathlib.Path(__file__).resolve().parent.parent / "spec" / "fixtures"
problems = []

def need(cond, msg):
    if not cond:
        problems.append(msg)

for name, case_keys in {
    "entities.json": {"name", "input", "expect", "roundTripUnchanged"},
    "reconcile.json": {"name", "rule", "input", "expect"},
    "history.json": {"name", "parent", "expect"},
}.items():
    data = json.loads((root / name).read_text())
    need(isinstance(data.get("about"), str), f"{name}: missing 'about'")
    cases = data.get("cases", [])
    need(len(cases) > 0, f"{name}: no cases")
    names = [c.get("name") for c in cases]
    need(len(names) == len(set(names)), f"{name}: duplicate case names")
    for c in cases:
        need(case_keys <= set(c), f"{name}: case {c.get('name')!r} lacks {sorted(case_keys - set(c))}")
        if name == "entities.json":
            need(c.get("expect") in {"valid", "invalid", "newer-format"}, f"{name}: {c.get('name')!r} has an unknown expect")
        if name == "reconcile.json":
            e = c.get("expect", {})
            need(e.get("action") in {"none", "take-remote", "upload", "keep-both"}, f"{name}: {c.get('name')!r} has an unknown action")
            need(set(c.get("input", {})) == {"base", "localChanged", "local", "remote"}, f"{name}: {c.get('name')!r} input keys")

if problems:
    print("\n".join(problems)); sys.exit(1)
print("spec fixtures OK")
