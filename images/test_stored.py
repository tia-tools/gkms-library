import urllib.error

import pytest

from stored import ask_all, head_url, served_by

BASE = "https://example.test"


class Response:
    def __init__(self, status):
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def opener(statuses, seen):
    """A fake urlopen answering by file name; records each request's method and URL."""

    def urlopen(req, timeout):
        seen.append((req.get_method(), req.full_url, req.get_header("User-agent")))
        status = next(s for name, s in statuses.items() if name in req.full_url)
        if status >= 400:
            raise urllib.error.HTTPError(req.full_url, status, "error", None, None)
        return Response(status)

    return urlopen


def test_the_question_is_a_head_of_the_public_copy_with_the_runs_own_query_string():
    seen = []
    exists = served_by(BASE + "/", "run-7", opener({"pitem_2-004": 200}, seen))
    assert exists("img_general_pitem_2-004.webp") is True
    assert seen == [("HEAD", "https://example.test/img/w48/img_general_pitem_2-004.webp?run=run-7", "gkms-library-images/0.1")]
    assert head_url(BASE, "img_sd_hski_face-00.webp", "x") == "https://example.test/img/w112/img_sd_hski_face-00.webp?run=x"


def test_404_means_missing_and_any_other_status_is_no_answer():
    exists = served_by(BASE, "r", opener({"2-004": 404, "2-005": 500, "2-006": 403, "2-007": 204}, []))
    assert exists("img_general_pitem_2-004.webp") is False
    with pytest.raises(urllib.error.HTTPError):
        exists("img_general_pitem_2-005.webp")
    with pytest.raises(urllib.error.HTTPError):
        exists("img_general_pitem_2-006.webp")
    with pytest.raises(RuntimeError, match="HTTP 204"):
        exists("img_general_pitem_2-007.webp")


def test_ask_all_returns_the_files_that_exist_and_asks_each_once():
    asked = []

    def exists(name):
        asked.append(name)
        return name.endswith("1.webp")

    names = [f"img_general_pitem_2-00{i}.webp" for i in (1, 2, 3, 1)]
    assert ask_all(names, exists, jobs=2) == {"img_general_pitem_2-001.webp"}
    assert sorted(asked) == sorted(set(names))


def test_ask_all_stops_on_the_first_error_instead_of_reading_it_as_missing():
    def exists(name):
        raise RuntimeError("server error")

    with pytest.raises(RuntimeError):
        ask_all(["img_general_pitem_2-001.webp"], exists)
