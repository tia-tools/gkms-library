# The library's images

This directory turns the game's images into the library's: for everything the published data names, a public copy at display size and a lossless master. It is Python, run with `uv`. What is published and why is decided in `docs/adr/0002-only-what-the-data-names-is-published-masters-stay-private.md`; the sizes, names and order of work are decisions L19–L23 of `docs/plans/EXECPLAN_LIBRARY_ALONE.md`.

## What it makes

The data names four kinds of image. Each keeps the name the game gives its asset bundle, with `.webp` for `.unity3d`.

| Kind | File name | Public copy | Master |
| --- | --- | --- | --- |
| Support card art | `img_general_csprt-3-0016_full.webp` | `img/w192/`, 192 × 108, opaque | 2048 × 1152, the 16:9 the game shows |
| P-item icon | `img_general_pitem_2-004.webp` | `img/w48/`, 48 × 48, with transparency | 256 × 256 as stored |
| Skill card icon | `img_general_skillcard_act-3_029.webp`, or one per idol: `…_029-hski.webp` | `img/w112/`, 112 × 112, with transparency | 256 × 256 as stored |
| Idol's face | `img_sd_hski_face-00.webp` | `img/w112/`, 112 × 112, with transparency | 256 × 256 as stored |

Public copies go to the bucket `gkms-library`, served at `https://gkms-library.tia.run/`, stored as immutable: a file never changes under its name, and a further size would be a new prefix. Masters go to the private bucket `gkms-library-masters` under the file name alone, stored as `private, no-cache`, since a master is overwritten when its rule changes.

The game stores card art squashed to 2048 × 1024 and stretches it to 16:9 when it shows a card. The master is resampled once to that shape, so it looks right wherever it is opened.

Only images the data names are fetched or uploaded. The game's manifest also lists images of things that are not released yet, and those must not go out early. If the data names an image whose name is none of the four kinds, every command stops: a new kind of asset needs a naming rule in `renditions.py`.

## Setup

    uv sync
    ./fetch-vendor.sh

`fetch-vendor.sh` unpacks GkmasObjectManager (`AllenHeartcore/GkmasObjectManager`, GPL-3.0) into `vendor/`, at the commit in `GkmasObjectManager.sha`. It is not a Python package, so its requirements are listed in `pyproject.toml`. It is used only to fetch and decrypt the game's manifest and to download bundles; it runs on your machine or the runner and is never committed or distributed. To move to a newer commit, change the `.sha` file and run the script again.

Uploading needs Wrangler, run through `bunx`, with a login for the Cloudflare account that holds `tia.run` (`bunx wrangler login`), or `CLOUDFLARE_API_TOKEN` in an unattended run.

## The commands

All read the data from `--site`, by default `out/site/` at the repository root, which `bun run generate` writes. Working files go under `out/`, which is not committed: `out/raw/` (downloaded bundles), `out/masters/`, `out/site/img/`, and `out/images-summary.json`.

    uv run extract.py                 # what the data names and the address does not serve yet
    uv run extract.py --all           # everything the data names, without asking the address
    uv run extract.py --only 'img_sd_' --force
    uv run upload.py --dry-run        # what would be uploaded
    uv run upload.py                  # upload it: each master, then its public copy

`extract.py` asks the public address which images it already serves, one `HEAD` per file with a query string of its own, because the address's cache remembers a "not found" for three minutes after an upload. It then downloads and decodes the rest. An image the game does not offer yet is printed as `not offered`, recorded in the summary, and stops nothing. An image the game offers that fails to download or decode is printed as `FAILED` and makes the command exit 1.

`upload.py` uploads what the address lacks and the disk holds. The master goes first, so a public copy that is served always has a stored master. It stops before uploading anything if an image is missing on disk for any reason other than the game not offering it.

`out/images-summary.json` is what the two commands tell the daily run. `extract.py` starts it anew every time. It vouches for the whole of the data (`extraction_complete`) only when the run looked at all of it, without `--only` or `--limit`, and nothing failed; `upload.py` takes its `not_offered` list as an excuse only then, and only if the data is still the same. `upload_complete` says that every image the data names and the game offers is stored; a run cut short by `--limit` says false.

Decoding is ours (`decode.py`). The bundles have their Unity version stripped, and a wrong guess yields a texture of absurd size instead of an error, so each known engine version is tried in order. If a game update breaks decoding, add the new version to the front of `UNITY_VERSIONS`. `extract.py` also prints `SyntaxWarning: invalid escape sequence` lines from `pydub`, a dependency of the vendored tool, about its own regular expressions; they are harmless.

## Masters for an app's own image build

An app that builds its own images from the game's art reads the masters with one command, from the repository root:

    bun run sync-masters -- --dest ~/masters
    bun run sync-masters -- --dest ~/masters --only 'img_sd_'

It reads which images exist from the published data, downloads each master from the private bucket with this machine's Wrangler login, and skips files already in the destination. `--site out/site` reads the data from a local directory instead of the public address.

## Tests

    uv run pytest

The tests are hermetic: no network, no vendored checkout. When checking that a test bites by breaking a rule, delete `__pycache__` before each run: Python trusts stale bytecode for an edit that keeps the file's size within one second.
