import subprocess
from pathlib import Path

import pytest

from r2 import R2_OBJECT, RETRY_WAITS, get, put


class Command:
    """Fails the first `failures` calls, then succeeds; records each command. Each failure exits with
    its attempt's number, so a test can tell which attempt's error was raised."""

    def __init__(self, failures):
        self.failures = failures
        self.commands = []

    def __call__(self, command, check):
        assert check is True
        self.commands.append(command)
        if len(self.commands) <= self.failures:
            raise subprocess.CalledProcessError(len(self.commands), command)


def put_with(command, slept):
    put("gkms-library", "img/w112/x.webp", Path("out/site/img/w112/x.webp"), "image/webp", "public, max-age=31536000, immutable", run=command, sleep=slept.append)


def test_a_put_that_succeeds_runs_the_command_once_without_waiting():
    command, slept = Command(0), []
    put_with(command, slept)
    assert slept == []
    assert command.commands == [
        ["bun", str(R2_OBJECT), "put", "gkms-library", "img/w112/x.webp", "out/site/img/w112/x.webp", "image/webp", "public, max-age=31536000, immutable"]
    ]


def test_a_transient_failure_is_tried_again_after_a_wait():
    command, slept = Command(2), []
    put_with(command, slept)
    assert len(command.commands) == 3 and len(set(map(tuple, command.commands))) == 1  # the same put each time
    assert slept == list(RETRY_WAITS)


def test_a_put_that_keeps_failing_raises_after_its_last_attempt():
    command, slept = Command(99), []
    with pytest.raises(subprocess.CalledProcessError) as raised:
        put_with(command, slept)
    assert raised.value.returncode == len(RETRY_WAITS) + 1  # the last attempt's error, not an earlier one
    assert len(command.commands) == len(RETRY_WAITS) + 1
    assert slept == list(RETRY_WAITS)


def test_get_reads_one_object_into_a_file_creating_its_directory(tmp_path):
    commands = []
    target = tmp_path / "masters" / "x.webp"
    get("gkms-library-masters", "x.webp", target, run=lambda command, check: commands.append((command, check)))
    assert commands == [(["bun", str(R2_OBJECT), "get", "gkms-library-masters", "x.webp", str(target)], True)]
    assert target.parent.is_dir()


def test_the_command_is_the_data_sides_one_way_into_a_bucket():
    assert R2_OBJECT.is_file()
    assert R2_OBJECT.read_text().find("putOnce") != -1
