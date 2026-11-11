"""Pure AG2 guard tests: no network, Docker, or database mutations."""
import os
import sys
import unittest
from pathlib import Path
from unittest import mock
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ag2_real_auth_ci as ag2


class Ag2GuardTests(unittest.TestCase):
    def test_local_only(self):
        self.assertEqual(ag2.API_URL, "http://127.0.0.1:54321")
        self.assertEqual(ag2.CONTAINER, "supabase_db_kheltriva-ag2-ci")

    def test_pinned_fixtures_only(self):
        self.assertEqual(len(ag2.FIXTURES), 6)
        self.assertTrue(all(x.startswith("ps_l2_3_b2_9_") for x in ag2.FIXTURES))
        self.assertTrue(all("/" not in x and "\\" not in x for x in ag2.FIXTURES))

    def test_cli_credential_scope(self):
        text = "API_URL=http://127.0.0.1:54321\nPUBLISHABLE_KEY=sb_publishable_local\n"
        self.assertEqual(ag2.local_status(text), "sb_publishable_local")
        with self.assertRaises(ag2.Ag2Error):
            ag2.local_status(text.replace("127.0.0.1:54321", "hosted.supabase.co"))
        with self.assertRaises(ag2.Ag2Error):
            ag2.local_status(text.replace("PUBLISHABLE_KEY=", "SECRET_KEY="))

    def test_no_shell_for_docker_sql(self):
        good = mock.Mock(returncode=0, stdout="OK")
        with mock.patch.object(ag2.subprocess, "run", return_value=good) as runner:
            self.assertEqual(ag2.psql("-At", "-c", "SELECT 1"), "OK")
        args = runner.call_args.args[0]
        self.assertEqual(args[:6], ["docker", "exec", ag2.CONTAINER,
                                    "psql", "-U", "postgres"])
        self.assertFalse(runner.call_args.kwargs.get("shell", False))

    def test_negative_bearer(self):
        unauthorized = HTTPError(ag2.API_URL, 401, "Unauthorized", {}, None)
        with mock.patch.object(ag2, "urlopen", side_effect=unauthorized):
            self.assertTrue(ag2.rejects_invalid_token("sb_publishable_ci"))
        with mock.patch.object(ag2, "urlopen", return_value=mock.MagicMock()):
            self.assertFalse(ag2.rejects_invalid_token("sb_publishable_ci"))

    def test_fail_when_auth_response_has_no_token(self):
        with mock.patch.object(ag2, "auth_json", return_value={"user": {"id": "abc"}}):
            with self.assertRaises(ag2.Ag2Error):
                ag2.signup("key", "c34a")

    def test_runner_source_denies_hosted_actions(self):
        source = Path(ag2.__file__).read_text(encoding="utf-8")
        for item in ("supabase link", "supabase db push",
                     "SUPABASE_SERVICE_ROLE_KEY", "supabase projects",
                     "subprocess.run([\"bash\", \"-c\""):
            self.assertNotIn(item, source)
        self.assertIn("capture_output=True", source)
        self.assertIn("GITHUB_ACTIONS", source)


if __name__ == "__main__":
    unittest.main()
