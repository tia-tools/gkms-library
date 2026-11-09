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
- `docs/adr/0003-files-are-served-from-a-public-r2-bucket-address-with-no-worker.md` — **accepted**: apps load data and images straight from a public R2 bucket's own address, with no Worker, so requests do not count toward the Workers Free daily limit; two points are still to be measured.
- `docs/adr/0004-data-is-published-as-immutable-releases-with-a-latest-pointer.md` — **accepted**: each data update is an immutable release with a `latest` pointer; live apps follow `latest`, and an app with its own gates fetches a release and gates its own intake.
- `docs/adr/0005-each-format-is-one-schema-as-code-file-that-never-changes.md` — **accepted**: each format (a file's shape) is one schema-as-code TypeScript file, both types and check, never changed once published and copied verbatim by the apps with a pinned-hash test.

## Project Overview

gkms-library ("the library") is the shared source of 学園アイドルマスター game data and images for the `tia.run` apps: gakumas-supportcards, gkms-hif-final-stats and gkms-memomemo. It generates complete, neutral data files from the game's public tables (support cards, skill cards, items, the idol list) with a structured reading of each effect, extracts the images of everything those files name from the game's servers, and publishes both at its own public address, `gkms-library.tia.run`, twice a day with no person involved. It exists because that job used to live inside gakumas-supportcards, a score table, which grew a special case for every app that asked (per `docs/adr/0001`–`0005` and `docs/plans/EXECPLAN_LIBRARY_ALONE.md`).

Nothing is built yet: the repository holds its design. `docs/plans/EXECPLAN_LIBRARY_ALONE.md` is the first plan, a draft: the library publishes beside what gakumas-supportcards publishes today, with a check comparing the two, before any app moves over (its decision L6 gives the order).

## Architecture

<!-- Describe the high-level structure: key directories, how components relate, data flow. Name the main entry points. -->

## Setup and Development

<!-- How to install dependencies, configure the environment, and run the project locally. Include exact commands. -->

## Build and Test

<!-- List the commands to build, test, lint, and format. Show expected output for a clean run. -->

## Code Style

<!-- Language-specific conventions, naming patterns, import ordering, or formatting tools in use. -->

## Tasks

Tasks live on the GitHub board `tia-tools` project `11`; work them with the `task-board` skill. Merges go through PRs into `develop`, the default branch; a PR closes its issue with `Closes #N`.

## Commit Discipline

- Follow Git-flow workflow to manage the branches
- Use small, frequent commits rather than large, infrequent ones
- Only add and commit affected files; leave untracked files as they are
- Never add coding agent attribution in commits

