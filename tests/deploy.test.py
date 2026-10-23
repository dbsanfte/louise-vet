"""Exercise the root deployment helper with isolated state and command stubs.

Run with sudo python3 tests/deploy.test.py. Only a temporary copy's PATH and
state directory change; production commands, validation and rollback stay intact.
"""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


REVISION = "a" * 40
DIGEST = "sha256:" + "b" * 64
PREVIOUS = "ghcr.io/dbsanfte/vet-game:" + "c" * 40
IMAGE = f"ghcr.io/dbsanfte/vet-game:{REVISION}@{DIGEST}"
SOURCE = Path(__file__).resolve().parents[1] / "deploy/louise-deploy"

STUB = r'''
import json, os, sys
from pathlib import Path
root = Path(os.environ['DEPLOY_TEST_ROOT'])
name = Path(sys.argv[0]).name
args = sys.argv[1:]
log = root / 'calls.jsonl'
calls = [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []
with log.open('a') as output:
    output.write(json.dumps([name, args]) + '\n')
scenario = os.environ.get('DEPLOY_TEST_SCENARIO', '')
if name == 'kubectl':
    if 'get' in args:
        print(os.environ['DEPLOY_TEST_PREVIOUS'])
    elif 'rollout' in args and scenario == 'rollout-failure':
        if not any(cmd == 'kubectl' and 'rollout' in argv for cmd, argv in calls):
            sys.exit(1)
elif name == 'curl':
    assert '--insecure' not in args and '-k' not in args
    if args[-1].endswith('/healthz'):
        print('ok')
    else:
        previous_checks = sum(cmd == 'curl' and argv[-1].endswith('/version.json') for cmd, argv in calls)
        stale = scenario == 'wrong-revision' or (scenario == 'transient' and previous_checks == 0)
        print(json.dumps({'revision': 'old' if stale else os.environ['DEPLOY_TEST_REVISION']}))
'''


class DeploymentTest(unittest.TestCase):
    def setUp(self):
        if os.geteuid() != 0:
            self.fail("Run these isolated helper tests with sudo python3 tests/deploy.test.py")
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.state = self.root / "state"
        self.state.mkdir()
        (self.state / "current-revision").write_text("previous\n")
        (self.state / "current-image").write_text(PREVIOUS + "\n")
        for name in ("kubectl", "curl", "sleep"):
            path = self.bin / name
            path.write_text(f"#!{sys.executable}\n" + STUB)
            path.chmod(0o755)
        source = SOURCE.read_text()
        self.assertEqual(source.count("export PATH="), 1)
        self.assertEqual(source.count("state=/var/lib/louise-vet"), 1)
        source = source.replace(
            "export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            f"export PATH={self.bin}:/usr/bin:/bin",
        ).replace("state=/var/lib/louise-vet", f"state={self.state}")
        self.helper = self.root / "louise-deploy"
        self.helper.write_text(source)

    def run_helper(self, scenario="", args=None):
        return subprocess.run(
            ["bash", str(self.helper), *(args if args is not None else [REVISION, DIGEST])],
            env={**os.environ, "DEPLOY_TEST_ROOT": str(self.root),
                 "DEPLOY_TEST_SCENARIO": scenario, "DEPLOY_TEST_PREVIOUS": PREVIOUS,
                 "DEPLOY_TEST_REVISION": REVISION},
            capture_output=True, text=True, timeout=10,
        )

    def calls(self):
        log = self.root / "calls.jsonl"
        return [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []

    def assert_rollback(self):
        self.assertIn(["kubectl", ["-n", "louise-vet", "set", "image", "deployment/web", f"web={PREVIOUS}"]], self.calls())
        self.assertEqual((self.state / "current-revision").read_text(), "previous\n")
        self.assertEqual((self.state / "current-image").read_text(), PREVIOUS + "\n")

    def test_rejects_invalid_inputs_before_cluster_access(self):
        for args in ([], [REVISION], ["main", DIGEST], [REVISION, "latest"],
                     [REVISION, "--cached"], [REVISION, DIGEST, "extra"]):
            with self.subTest(args=args):
                self.assertEqual(self.run_helper(args=args).returncode, 2)
                self.assertEqual(self.calls(), [])

    def test_pins_published_digest_and_enables_recovery_pulls(self):
        result = self.run_helper()
        self.assertEqual(result.returncode, 0, result.stderr)
        patches = [args for name, args in self.calls() if name == "kubectl" and "patch" in args]
        self.assertEqual(len(patches), 1)
        patch = json.loads(patches[0][-1])
        self.assertEqual(patch["spec"]["template"]["spec"]["containers"], [
            {"name": "web", "image": IMAGE, "imagePullPolicy": "IfNotPresent"}
        ])
        self.assertEqual((self.state / "current-revision").read_text(), REVISION + "\n")
        self.assertEqual((self.state / "current-image").read_text(), IMAGE + "\n")

    def test_failed_rollout_restores_previous_release(self):
        self.assertNotEqual(self.run_helper("rollout-failure").returncode, 0)
        self.assert_rollback()

    def test_healthy_but_wrong_release_fails_and_rolls_back(self):
        self.assertNotEqual(self.run_helper("wrong-revision").returncode, 0)
        self.assert_rollback()
        checks = [args for name, args in self.calls() if name == "curl" and args[-1].endswith("/version.json")]
        self.assertEqual(len(checks), 10)

    def test_transient_old_backend_is_retried(self):
        result = self.run_helper("transient")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any(name == "kubectl" and "set" in args for name, args in self.calls()))
        self.assertEqual((self.state / "current-image").read_text(), IMAGE + "\n")


if __name__ == "__main__":
    unittest.main()
