import pytest

from wanted import card_art, faces, item_icons, skill_card_icons, wanted_file_names

IDOLS = {"idols": [{"id": "hski", "name": "花海咲季"}, {"id": "ttmr", "name": "月村手毬"}]}


def skill_card(asset: str, per_idol: bool, upgrade: int = 0) -> dict:
    return {"id": f"p_card-{asset[-9:]}", "upgrade": upgrade, "art": {"asset": asset, "perIdol": per_idol}}


def data() -> dict:
    return {
        "support-cards": {"cards": [{"id": "s_card-3-0016", "assetId": "csprt-3-0016"}, {"id": "s_card-1-0000", "assetId": "csprt-1-0000"}]},
        "items": {"items": [{"id": "pitem_a", "assetId": "img_general_pitem_2-004"}, {"id": "pitem_b", "assetId": "img_general_pitem_2-004"}, {"id": "pitem_c", "assetId": "img_general_pitem_3-001"}]},
        "idols": IDOLS,
        "skill-cards": {"cards": [skill_card("img_general_skillcard_act-3_029", True), skill_card("img_general_skillcard_act-3_029", True, 1), skill_card("img_general_skillcard_sup-3_001", False)]},
    }


def test_each_support_card_names_its_art():
    assert card_art(data()["support-cards"]) == {"img_general_csprt-3-0016_full.webp", "img_general_csprt-1-0000_full.webp"}


def test_items_sharing_an_icon_name_it_once():
    assert item_icons(data()["items"]) == {"img_general_pitem_2-004.webp", "img_general_pitem_3-001.webp"}


def test_each_idol_names_its_default_face():
    assert faces(IDOLS) == {"img_sd_hski_face-00.webp", "img_sd_ttmr_face-00.webp"}


def test_a_skill_card_names_one_icon_or_one_per_idol_and_its_levels_share_them():
    assert skill_card_icons(data()["skill-cards"], IDOLS) == {
        "img_general_skillcard_act-3_029-hski.webp",
        "img_general_skillcard_act-3_029-ttmr.webp",
        "img_general_skillcard_sup-3_001.webp",
    }


def test_the_wanted_files_are_those_of_all_four_kinds_and_nothing_else():
    assert len(wanted_file_names(data())) == 2 + 2 + 2 + 3


def test_a_name_of_no_known_kind_stops_the_run_naming_what_gave_it():
    d = data()
    d["items"]["items"].append({"id": "pitem_new", "assetId": "img_general_pitem_new-style_1"})
    with pytest.raises(ValueError, match="item pitem_new: img_general_pitem_new-style_1.webp is not the name of a item image"):
        wanted_file_names(d)
    d = data()
    d["support-cards"]["cards"].append({"id": "s_card-4-0001", "assetId": "csprt-4-00001"})
    with pytest.raises(ValueError, match="support card s_card-4-0001"):
        wanted_file_names(d)


def test_an_asset_of_another_kind_is_not_taken_for_a_skill_card_icon():
    d = data()
    d["skill-cards"]["cards"].append(skill_card("img_general_pitem_2-004", False))
    with pytest.raises(ValueError, match="is not the name of a skillcard image"):
        wanted_file_names(d)
