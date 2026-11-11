#!/usr/bin/env python3
"""Kheltriva DevBot V1: allowlisted CI checks, NOT an AI coding agent.

No hosted DB access, deployments, migrations, arbitrary commands or API keys.
"""
from __future__ import annotations
import argparse
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
AUTH_SAFETY_FILES = (
    ("supabase/tests/subscriptions", "test_b2_9_snapshot_integrity.py"),
    ("supabase/tests/subscriptions", "test_b2_9_authorized_scope.py"),
    ("supabase/recovery/historical-baseline", "test_b2_9_c2_local_preflight_safety.py"),
    ("supabase/tests/subscriptions", "test_b2_9_c3_native_schema_guard.py"),
    ("supabase/tests/subscriptions", "test_b2_9_c33b_guard.py"),
    ("supabase/tests/subscriptions", "test_b2_9_c34a_local_auth_safety.py"),
    ("supabase/tests/subscriptions", "test_b2_9_c34b1_owner_a_safety.py"),
    ("supabase/tests/subscriptions", "test_b2_9_c34b2_owner_b_safety.py"),
)
ALLOWED_SUITES = ("quick", "auth-static", "frontend", "all")


def build_plan(suite: str) -> list[tuple[str, tuple[str, ...], Path]]:
    """All commands are hard-coded; user input cannot enter a shell."""
    if suite not in ALLOWED_SUITES:
        raise ValueError("Unsupported DevBot suite")
    tasks = [("DevBot self-tests", (sys.executable, "-m", "unittest", "discover",
             "-s", "scripts/devbot", "-p", "test_*.py", "-v"), ROOT)]
    if suite in ("auth-static", "all"):
        for directory, pattern in AUTH_SAFETY_FILES:
            tasks.append(("Auth source guard: " + pattern,
                          (sys.executable, "-m", "unittest", "discover", "-s",
                           directory, "-p", pattern, "-v"), ROOT))
    if suite in ("frontend", "all"):
        tasks.extend((
            ("Frontend locked install", ("npm", "ci", "--no-audit", "--no-fund"), ROOT / "frontend"),
            ("Frontend Jest", ("npm", "test", "--", "--watchAll=false"), ROOT / "frontend"),
            ("Frontend build", ("npm", "run", "build"), ROOT / "frontend"),
        ))
    return tasks


def limited_environment() -> dict[str, str]:
    # Do not forward runner secrets to child test processes.
    keys = ("PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "TMP", "TEMP",
            "SYSTEMROOT", "WINDIR", "USERPROFILE", "APPDATA", "LOCALAPPDATA")
    env = {k: os.environ[k] for k in keys if k in os.environ}
    env.update({
        "CI": "true",
        "REACT_APP_SUPABASE_URL": "https://example.supabase.co",
        "REACT_APP_SUPABASE_KEY": "ci-placeholder-key-not-for-deployment",
        "NPM_CONFIG_AUDIT": "false",
        "NPM_CONFIG_FUND": "false",
    })
    return env


def format_summary(suite: str, results: list[dict[str, object]], branch: str) -> str:
    branch = branch.replace("|", "-").replace("\n", "")
    outcome = "PASS" if all(x["status"] == "PASS" for x in results) else "FAIL"
    lines = [
        "## Kheltriva DevBot V1 — Test report",
        "",
        "**Result:** " + outcome + " | **Suite:** " + suite + " | **Branch:** " + branch,
        "",
        "| Check | Result | Duration |",
        "| --- | --- | ---: |",
    ]
    for result in results:
        lines.append("| " + str(result["name"]).replace("|", "-") + " | " +
                     str(result["status"]) + " | " +
                     format(float(result["seconds"]), ".1f") + "s |")
    lines += [
        "", "**Boundary:** No hosted Supabase credentials, deployed resources, or AI API calls.",
        "", "**Not covered:** Auth source checks are not real Supabase GoTrue JWT or",
        "cross-tenant RLS tests. Those require separate AG2 integration infrastructure.",
        "", "**Owner approval remains required** for merges and production deployment.", "",
    ]
    return "\n".join(lines)


def run(suite: str, summary_path: Path | None = None) -> int:
    planned = build_plan(suite)
    env = limited_environment()
    results: list[dict[str, object]] = []
    for name, command, cwd in planned:
        started = time.monotonic()
        try:
            result = subprocess.run(command, cwd=cwd, env=env, text=True,
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                    timeout=400, check=False)
            success, output = result.returncode == 0, result.stdout or ""
        except (subprocess.TimeoutExpired, OSError) as error:
            success, output = False, type(error).__name__
        seconds = time.monotonic() - started
        results.append({"name": name, "status": "PASS" if success else "FAIL",
                        "seconds": seconds})
        print(("PASS" if success else "FAIL") + " - " + name +
              " (" + format(seconds, ".1f") + "s)", flush=True)
        if not success:
            print("Failure output (last 30 lines):")
            print("\n".join(output.splitlines()[-30:])[:8000], flush=True)
    report = format_summary(suite, results, os.getenv("GITHUB_REF_NAME", "local"))
    if summary_path:
        with summary_path.open("a", encoding="utf-8") as f:
            f.write(report)
    else:
        print(report)
    return 0 if all(x["status"] == "PASS" for x in results) else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--suite", choices=ALLOWED_SUITES, default="quick")
    args = parser.parse_args()
    target = os.getenv("GITHUB_STEP_SUMMARY")
    return run(args.suite, Path(target) if target else None)


if __name__ == "__main__":
    raise SystemExit(main())
