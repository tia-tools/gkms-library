# CLAUDE.md

This file provides guidance to a coding agent when working with code in this repository.

## Central Configuration

This template carries only the project-scoped scaffold: this CLAUDE.md skeleton, `docs/PLANS.md` (ExecPlan methodology), and `docs/adr/README.md` (ADR convention). Cross-project rules and the generic workflow skills (`grill-me`, `close-out`, `codebase-design`, `adopt-from-sibling`, `harvest-session`, `backlog`) live in the central `Taka499/claude` repository, deployed user-level at `~/.claude` — do not copy them into projects.

`docs/PLANS.md` is the one document that exists in both places. The canonical copy is `docs/PLANS.md` in `Taka499/claude`; the copy here is downstream and is checked in so a plan stays followable from a fresh clone with no `~/.claude`. Change the canonical one and propagate; see the note at the top of the file.

## Documentation

Project documentation lives in `docs/`. When creating or updating plans, ExecPlans, or design docs, save them there. Reference existing docs in `docs/` for context on project phases and milestones.

Every document should be self-sufficient: the reader should never need to hunt for context. Explain concepts inline. When a concept is already defined in another checked-in document, you may reference it by file path and section rather than repeating it — but the reference must be precise enough that the reader can find it immediately (e.g., "see `docs/PLANS.md` § Milestones"), not vague ("see the architecture doc").

## ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in `docs/PLANS.md`) from design to implementation. ExecPlans are the persistence layer for cross-session development — they carry forward all context, decisions, and progress so that a fresh session can continue the work without loss. Completed plans are immutable history; when one finishes, run the close-out ritual (`close-out` skill) to extract its durable decisions before moving on.

## Durable Decisions (ADRs)

Cross-plan decisions live in `docs/adr/` (convention: `docs/adr/README.md`). This list is an index, not a home — one line per active decision with a pointer to its ADR; full context, provenance, and lifecycle live in the ADR file. Every non-obvious claim elsewhere in this file must cite its source (`per docs/adr/NNNN` or `per docs/plans/<plan>.md`) so this snapshot stays auditable and rebuildable. When an ADR corrects something an old plan asserted, the ADR wins.

- `docs/adr/0001-the-library-describes-the-game-and-an-apps-rules-live-in-the-app.md` — **accepted**: the library owns the game's images and the data files generated from its tables, published complete and neutral with a structured reading of effects; no app's rules (scoring, held cards, a card pool) live here.
- `docs/adr/0002-only-what-the-data-names-is-published-masters-stay-private.md` — **accepted**: an image is published only for a thing the published data names, at display sizes; lossless masters stay in a private bucket, read by an app's own image build through a sync command, and app-built images never live in the library's public bucket.
- `docs/adr/0003-files-are-served-from-a-public-r2-bucket-address-with-no-worker.md` — **accepted**: apps load data and images straight from a public R2 bucket's own address, with no Worker, so requests do not count toward the Workers Free daily limit; measured on the live address 2026-11-10 (no Worker request, and a cache hit is no R2 read operation).
- `docs/adr/0004-data-is-published-as-immutable-releases-with-a-latest-pointer.md` — **accepted**: each data update is an immutable release with a `latest` pointer; live apps follow `latest`, and an app with its own gates fetches a release and gates its own intake.
- `docs/adr/0005-each-format-is-one-schema-as-code-file-that-never-changes.md` — **accepted**: each format (a file's shape) is one schema-as-code TypeScript file, both types and check, never changed once published and copied verbatim by the apps with a pinned-hash test; the schema library is Valibot 1.

## Project Overview

gkms-library ("the library") is the shared source of 学園アイドルマスター game data and images for the `tia.run` apps: gakumas-supportcards, gkms-hif-final-stats and gkms-memomemo. It generates complete, neutral data files from the game's public tables (support cards, skill cards, items, the idol list) with a structured reading of each effect, extracts the images of everything those files name from the game's servers, and publishes both at its own public address, `gkms-library.tia.run`, twice a day with no person involved. It exists because that job used to live inside gakumas-supportcards, a score table, which grew a special case for every app that asked (per `docs/adr/0001`–`0005` and `docs/plans/EXECPLAN_LIBRARY_ALONE.md`).

`docs/plans/EXECPLAN_LIBRARY_ALONE.md` is the first plan: the library publishes beside what gakumas-supportcards publishes today, with a check comparing the two, before any app moves over (its decision L6 gives the order). Its Milestones 0 to 2 are done. The data is generated and checked here but written to a local directory only. The bucket `gkms-library` (public, at `gkms-library.tia.run`) holds a display-size copy of every image the data names, 2,928 on 2026-11-13, and `gkms-library-masters` (private) each one's lossless master. Milestone 3, the unattended run that publishes the data, has not started; it has an issue on the board.

## Architecture

Per `docs/plans/EXECPLAN_LIBRARY_ALONE.md` § Plan of Work and § Interfaces and Dependencies.

- `formats/` holds one Valibot schema file per format and version (`idols.v1.ts`, `items.v1.ts`, `skill-cards.v1.ts`, `support-cards.v1.ts`, and `latest.v1.ts` for the pointer). Each is the format's types and its check, imports nothing but Valibot, and is published beside the data. None is published yet, so they may still change; once published, never (per `docs/adr/0005`).
- `src/` is the data side, TypeScript run by Bun. `tables.ts` loads the game's tables (cached in `.cache/gakumasu-diff/`). `support-cards/`, `skill-cards/`, `idols/` and `items/` each build one file's entries, purely. `build-all.ts` builds the four files and checks each against its format. `release.ts` names releases and computes the pointer. `generate.ts` is the command that writes them. `compare/` is the check against what gakumas-supportcards publishes, to be deleted when that site stops publishing.
- `images/` is the image side, Python run with uv; `images/README.md` explains it. `wanted.py` says which images the data names, `renditions.py` how each is named and rendered, `extract.py` fetches and decodes them from the game's servers, `upload.py` sends each master to the private bucket and then its public copy, and `sync_masters.py` (`bun run sync-masters`) brings masters to a directory for an app's own image build.
- `out/` (not committed) holds a run's files: `out/site/` mirrors the public bucket (`data/latest.v1.json`, `data/<format>/v<N>/<release>.json`, `formats/`, `img/<size>/<file>`), `out/masters/` the private one, `out/raw/` the downloaded bundles.
- `infra/cors.json` is the public bucket's CORS policy.

The builders are adapted from gakumas-supportcards at commit `f8be2dd`; what changed is in the plan's decisions L15–L17.

## Setup and Development

Bun 1.4.3. From the repository root:

    bun install
    bun run generate                    # the four data files, as releases with a pointer, into out/site/
    bun run compare --site out/site     # against gakumas-supportcards' live files; exits 1 on an unexpected difference
    cd images && uv sync && ./fetch-vendor.sh    # once, for the image side
    uv run extract.py && uv run upload.py        # the images the address lacks; uploading needs a Wrangler login

`generate` fetches the game's tables on first use and caches them in `.cache/gakumasu-diff/`; delete that directory to fetch them again. `GAKUMASU_DIFF_CACHE=<directory>` points it at another copy.

## Build and Test

    bun test                # hermetic: no network
    bun run type-check
    bun run lint            # Oxlint; a clean run prints nothing, so read its exit status
    cd images && uv run pytest

`.github/workflows/check.yml` runs all four on every pull request into `develop`. A new test is first seen to fail with its rule broken.

## Code Style

<!-- Language-specific conventions, naming patterns, import ordering, or formatting tools in use. -->

## Tasks

Tasks live on the GitHub board `tia-tools` project `11`; work them with the `task-board` skill. Merges go through PRs into `develop`, the default branch; a PR closes its issue with `Closes #N`.

## Commit Discipline

- Follow Git-flow workflow to manage the branches
- Use small, frequent commits rather than large, infrequent ones
- Only add and commit affected files; leave untracked files as they are
- Never add coding agent attribution in commits

