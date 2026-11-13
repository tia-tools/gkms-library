import json

import pytest

from site_data import read_site_data, reader_for


def site(tmp_path, formats=("idols", "items", "skill-cards", "support-cards")):
    files = []
    for fmt in formats:
        path = f"data/{fmt}/v1/20261110T0300Z-aaaaaaaa.json"
        (tmp_path / path).parent.mkdir(parents=True)
        (tmp_path / path).write_text(json.dumps({"formatVersion": 1, "format": fmt}), encoding="utf-8")
        files.append({"format": fmt, "formatVersion": 1, "path": path})
    (tmp_path / "data" / "latest.v1.json").write_text(json.dumps({"pointerVersion": 1, "files": files}), encoding="utf-8")
    return tmp_path


def test_reads_the_four_files_the_pointer_names(tmp_path):
    data = read_site_data(reader_for(str(site(tmp_path))))
    assert sorted(data) == ["idols", "items", "skill-cards", "support-cards"]
    assert data["items"] == {"formatVersion": 1, "format": "items"}


def test_stops_when_the_pointer_does_not_name_a_format(tmp_path):
    with pytest.raises(ValueError, match="expected one release of support-cards v1, found 0"):
        read_site_data(reader_for(str(site(tmp_path, formats=("idols", "items", "skill-cards")))))
