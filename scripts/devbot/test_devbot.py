"""DevBot V1 pure unit tests; none execute SQL, npm or network requests."""
import os
from pathlib import Path
import sys
from unittest import TestCase, mock
from contextlib import redirect_stdout
import io

sys.path.insert(0, str(Path(__file__).resolve().parent))
import run as devbot


class DevBotSafetyTests(TestCase):
    def test_only_approved_modes(self):
        self.assertEqual(devbot.ALLOWED_SUITES, ("quick", "auth-static", "frontend", "all"))
        with self.assertRaises(ValueError):
            devbot.build_plan("arbitrary;curl remote")

    def test_quick_runs_only_local_self_tests(self):
        plan = devbot.build_plan("quick")
        self.assertEqual(len(plan), 1)
        self.assertEqual(plan[0][0], "DevBot self-tests")

    def test_auth_static_never_runs_live_db_commands(self):
        plan = devbot.build_plan("auth-static")
        self.assertEqual(len(plan), 9)
        self.assertTrue(all(x[1][0] == sys.executable for x in plan))
        self.assertFalse(any("psql" in " ".join(x[1]) for x in plan))

    def test_all_suite_contains_static_and_frontend(self):
        plan = devbot.build_plan("all")
        self.assertEqual(len(plan), 12)
        self.assertEqual(plan[0][0], "DevBot self-tests")
        self.assertEqual(plan[-1][0], "Frontend build")

    def test_frontend_is_test_and_build_only(self):
        plan = devbot.build_plan("frontend")
        commands = [" ".join(x[1]) for x in plan]
        self.assertTrue(any("npm ci --no-audit --no-fund" in x for x in commands))
        self.assertTrue(any("npm run build" in x for x in commands))
        self.assertFalse(any("deploy" in x for x in commands))

    def test_secrets_do_not_reach_subprocess(self):
        with mock.patch.dict(os.environ, {"SUPABASE_SERVICE_ROLE_KEY": "not-for-test",
                                           "GITHUB_TOKEN": "not-for-test",
                                           "VERCEL_TOKEN": "not-for-test"}):
            env = devbot.limited_environment()
        for key in ("SUPABASE_SERVICE_ROLE_KEY", "GITHUB_TOKEN", "VERCEL_TOKEN"):
            self.assertNotIn(key, env)
        self.assertEqual(env["REACT_APP_SUPABASE_KEY"],
                         "ci-placeholder-key-not-for-deployment")

    def test_summary_is_truthful(self):
        out = devbot.format_summary("quick", [{"name": "self-test", "status": "PASS",
                                               "seconds": 0.1}], "devbot-v1")
        self.assertIn("Kheltriva DevBot V1", out)
        self.assertIn("not real Supabase GoTrue", out)
        self.assertIn("Owner approval", out)

    def test_exit_status_propagates(self):
        process = mock.Mock(returncode=0, stdout="OK")
        with mock.patch.object(devbot.subprocess, "run", return_value=process):
            with redirect_stdout(io.StringIO()):
                self.assertEqual(devbot.run("quick"), 0)
        process.returncode = 1
        process.stdout = "test failure"
        with mock.patch.object(devbot.subprocess, "run", return_value=process):
            with redirect_stdout(io.StringIO()):
                self.assertEqual(devbot.run("quick"), 1)
