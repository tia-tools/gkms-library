# gkms-library

The shared source of 学園アイドルマスター game data and images for the `tia.run` apps. It generates data files from the game's public tables, extracts the images of everything those files name from the game's servers, and publishes both at `https://gkms-library.tia.run`, twice a day with no person involved.

It describes the game and nothing else: every released support card, skill card, item and idol, as facts an app can filter by. An app's own rules (scores, a card pool, what to hide) live in the app. Why it exists and what it will not do are in `docs/adr/`.

## What is published

Everything is a plain file at the address, readable from any origin.

| Path | What |
| --- | --- |
| `data/latest.v1.json` | The pointer: for each format, its newest release. The only file that changes under its name. |
| `data/<format>/v<N>/<release>.json` | A release: one update's content. Never changes once published. |
| `formats/<format>.v<N>.ts` | A format: the shape of a file, as a Valibot schema. Never changes once published. |
| `img/w192/img_general_<assetId>_full.webp` | Support card art, 192 × 108. |
| `img/w48/<assetId>.webp` | P-item icon, 48 × 48. |
| `img/w112/<asset>.webp`, `img/w112/<asset>-<idol id>.webp` | Skill card icon, 112 × 112; one per idol where the card is drawn differently for each. |
| `img/w112/img_sd_<idol id>_face-00.webp` | An idol's face, 112 × 112. |

The four data formats, each at version 1:

- **`idols`**: the playable idols, in the game's order.
- **`support-cards`**: every support card, with the effects that raise Vocal, Dance or Visual read into a structure (what kind, on which trigger), and the list of effects that could not be read.
- **`skill-cards`**: every skill card at every upgrade level, and every memory ability.
- **`items`**: every P-item, as plain facts.

A release is named by the UTC minute it was made and the first 8 hex digits of its SHA-256, such as `20261113T0226Z-0513c9bc`. A release is made only when the content changed.

An image is published only for a thing the data names, so nothing unreleased appears. The lossless masters are kept in a private bucket.

## Reading it from an app

Fetch the pointer, then the release it names:

    const pointer = await (await fetch("https://gkms-library.tia.run/data/latest.v1.json")).json();
    const entry = pointer.files.find((f) => f.format === "idols" && f.formatVersion === 1);
    const data = await (await fetch(`https://gkms-library.tia.run/${entry.path}`)).json();

To check what you fetched, copy the format file into your app exactly as it is (`https://gkms-library.tia.run/formats/idols.v1.ts`) and call its `parse`, which returns the typed value or throws an error naming the place of the first bad value. It needs Valibot at major version 1. Pin the copy's SHA-256 in a test, so that an accidental edit is noticed. A format file never changes: a change of shape is a new version number, published beside the old one.

The pointer may be kept for five minutes; a release and an image may be kept forever. An app that must gate what it takes in fetches a release, runs its own checks, and keeps the release it accepted.

An image a release names may be missing for a while: the game sometimes lists a card before its art can be downloaded. Such images are reported by the run and appear at a later one. Note that the address tells a browser to remember a missing image for four hours.

## Working on it

Bun 1.4.3 for the data, Python with uv for the images.

    bun install
    bun run generate                    # the four data files, as releases with a pointer, into out/site/
    bun run compare --site out/site     # against what gakumas-supportcards publishes; exits 1 on an unexpected difference
    bun test && bun run type-check && bun run lint

    cd images && uv sync && ./fetch-vendor.sh
    uv run pytest
    uv run extract.py                   # the images the data names and the address does not serve yet
    uv run upload.py --dry-run          # what would be uploaded

`images/README.md` explains the image side. Uploading and publishing need a Wrangler login for the Cloudflare account that holds `tia.run`.

    bun run publish --dry-run           # what a publication would upload
    bun run daily --dry-run             # the whole unattended run, uploading nothing
    bun run sync-masters -- --dest <directory> [--only <regular expression>]

`bun run daily` is what `.github/workflows/update.yml` runs at 11:50 and 20:50 Japan time: generate, the images, the publication, the comparison. Everything is built and checked before the first upload, the data goes out only when its images are stored, and the pointer moves last, so a run that fails leaves the last good releases in place. The workflow file is on `develop`; the code it runs is `main`.

`bun run sync-masters` brings the lossless masters to a directory, for an app that builds its own images from the game's art.

The plan this was built by, with every decision and what was measured, is `docs/plans/EXECPLAN_LIBRARY_ALONE.md`.
