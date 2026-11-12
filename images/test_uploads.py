from uploads import IMMUTABLE, MASTERS_BUCKET, PUBLIC_BUCKET, REVALIDATE, Put, plan_extraction, plan_uploads, unexplained_absences, upload_order

A, B, C, D, E = (f"img_general_pitem_2-00{i}.webp" for i in range(1, 6))


def test_extraction_fetches_what_is_wanted_offered_not_stored_and_not_on_disk():
    plan = plan_extraction(wanted=[A, B, C, D, E], offered=[A, B, C, "img_general_pitem_9-999.webp"], stored=[B, E], on_disk=[C])
    assert plan.to_extract == (A,)
    assert plan.not_offered == (D,)  # E is not offered either, but it is stored: nothing to report


def test_extraction_never_fetches_what_the_data_does_not_name():
    assert plan_extraction(wanted=[], offered=[A, B], stored=[], on_disk=[]).to_extract == ()


def test_extraction_plans_in_name_order_whatever_order_it_was_given():
    assert plan_extraction(wanted=[C, A, B], offered=[B, C, A], stored=[], on_disk=[]).to_extract == (A, B, C)


def test_the_master_goes_to_the_private_bucket_before_the_public_copy_goes_out():
    assert upload_order("img_general_pitem_2-004.webp") == [
        Put(MASTERS_BUCKET, "img_general_pitem_2-004.webp", REVALIDATE),
        Put(PUBLIC_BUCKET, "img/w48/img_general_pitem_2-004.webp", IMMUTABLE),
    ]
    assert [p.key for p in upload_order("img_sd_hski_face-00.webp")] == ["img_sd_hski_face-00.webp", "img/w112/img_sd_hski_face-00.webp"]


def test_the_two_buckets_and_their_cache_control():
    assert (PUBLIC_BUCKET, MASTERS_BUCKET) == ("gkms-library", "gkms-library-masters")
    assert IMMUTABLE == "public, max-age=31536000, immutable"  # a public copy never changes under its name
    assert REVALIDATE == "private, no-cache"  # a master is overwritten when its rule changes


def test_upload_sends_what_is_wanted_not_stored_and_on_disk_and_lists_what_is_not_on_disk():
    plan = plan_uploads(wanted=[A, B, C, D], stored=[B], on_disk=[A, B, "img_general_pitem_9-999.webp"])
    assert plan.to_upload == (A,)
    assert plan.absent == (C, D)


def test_an_absent_file_is_explained_only_by_the_game_not_offering_it():
    assert unexplained_absences([C, D], not_offered=[D]) == [C]
    assert unexplained_absences([D], not_offered=[D, E]) == []
    assert unexplained_absences([], not_offered=[]) == []
