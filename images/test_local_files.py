from pathlib import Path

from local_files import complete_on_disk, master_path, path_of, public_path, read_summary, update_summary
from uploads import upload_order

FACE = "img_sd_hski_face-00.webp"


def test_local_paths_mirror_the_two_buckets():
    out = Path("out")
    assert master_path(out, FACE) == out / "masters" / FACE
    assert public_path(out, FACE) == out / "site" / "img" / "w112" / FACE
    assert [path_of(out, put) for put in upload_order(FACE)] == [master_path(out, FACE), public_path(out, FACE)]


def test_a_file_is_complete_only_with_both_its_master_and_its_public_copy(tmp_path):
    both, master_only = "img_general_pitem_2-001.webp", "img_general_pitem_2-002.webp"
    for path in (master_path(tmp_path, both), public_path(tmp_path, both), master_path(tmp_path, master_only)):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"x")
    assert complete_on_disk(tmp_path, [both, master_only, "img_general_pitem_2-003.webp"]) == {both}


def test_the_summary_keeps_what_other_steps_wrote(tmp_path):
    assert read_summary(tmp_path) == {}
    update_summary(tmp_path, extracted=3, not_offered=["a.webp"])
    update_summary(tmp_path, uploaded=3)
    assert read_summary(tmp_path) == {"extracted": 3, "not_offered": ["a.webp"], "uploaded": 3}
