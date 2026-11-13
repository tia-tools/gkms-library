import subprocess
from pathlib import Path

from sync_masters import sync, to_fetch
from uploads import MASTERS_BUCKET

WANTED = {"img_sd_hski_face-00.webp", "img_sd_ttmr_face-00.webp", "img_general_pitem_2-004.webp"}


def test_fetches_what_the_data_names_and_the_destination_lacks_in_name_order():
    assert to_fetch(WANTED, present={"img_sd_ttmr_face-00.webp", "unrelated.webp"}, only=None) == ["img_general_pitem_2-004.webp", "img_sd_hski_face-00.webp"]


def test_only_narrows_by_file_name_and_never_adds_a_file_the_data_does_not_name():
    assert to_fetch(WANTED, present=set(), only="img_sd_") == ["img_sd_hski_face-00.webp", "img_sd_ttmr_face-00.webp"]
    assert to_fetch(WANTED, present=WANTED, only="img_sd_") == []
    assert to_fetch(WANTED, present=set(), only="img_general_csprt") == []


def test_each_master_is_read_from_the_private_bucket_under_its_file_name():
    calls = []
    assert sync(["a.webp", "b.webp"], Path("dest"), fetch=lambda bucket, key, path: calls.append((bucket, key, path))) == []
    assert calls == [(MASTERS_BUCKET, "a.webp", Path("dest/a.webp")), (MASTERS_BUCKET, "b.webp", Path("dest/b.webp"))]


def test_a_master_the_bucket_does_not_hold_is_listed_and_the_rest_still_downloaded():
    fetched = []

    def fetch(bucket, key, path):
        if key == "a.webp":
            raise subprocess.CalledProcessError(1, "wrangler")
        fetched.append(key)

    assert sync(["a.webp", "b.webp"], Path("dest"), fetch=fetch) == ["a.webp"]
    assert fetched == ["b.webp"]
