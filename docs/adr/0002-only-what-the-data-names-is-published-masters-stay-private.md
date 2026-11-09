---
status: accepted
---

# Only images of what the data names are published, at display sizes; masters stay private

The library publishes an image only for a thing named in its published data: a support card, an item, a skill card, an idol. Public copies are at display sizes; the lossless masters (the images as the game stores them) are kept in a separate private bucket and never served. No app asks for an image: a new idol's face is published because the idol list is data, by the same rule as a new card's art. An app that builds its own images from game art (gkms-memomemo's game-style skill card sheets) reads the masters through one sync command of the library, with the person's own Cloudflare login, and keeps its products in its own storage, never in the library's public bucket.

The alternatives were publishing everything the game offers (unreleased content would leak), per-app requests (the arrangement this repository exists to end), building app images from the public copies (the art compressed twice, and one public size to fit every use), and running the extractor by hand on a developer's machine (today's practice). The cost is a second bucket, and a local step for an app's own image build until a read-only token for the masters is added for CI, which needs no change of design.

Source: the user's decisions 4 and 9 of the design session of 2026-11-10 (`docs/plans/EXECPLAN_LIBRARY_ALONE.md` § Decision Log, L4, L9); evidence level: user decision. That a public bucket cannot keep one prefix private is from Cloudflare's public-buckets documentation, which describes exposing a bucket's contents and no per-prefix privacy (read 2026-11-10).
