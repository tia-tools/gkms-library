# Publish the game's data and images from the library, beside what exists

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. It is maintained in accordance with `docs/PLANS.md` at the repository root.

This is a draft from the design session of 2026-11-10. Its decisions are settled; its milestones are an outline to be fleshed out, by reading the code named in Context and Orientation, before the first one starts.

## Purpose / Big Picture

Three public web apps for players of 学園アイドルマスター (a mobile game) run under `tia.run`: gakumas-supportcards (a score table of support cards), gkms-hif-final-stats (a calculator for one scenario) and gkms-memomemo (a memo of owned memories). All three need the same things from the game: its card data and its images. Until now the first app has produced them for the other two as well, and each new need became a request to that app: a file shaped for one reader, a new kind of image. gkms-library ("the library") takes that job over as a neutral service.

After this plan, the library publishes, at its own public address, complete data files generated from the game's tables and the images of everything those files name, updated twice a day with no person involved. Nothing reads it yet: gakumas-supportcards keeps publishing exactly as it does, and a check compares the two, which proves the move loses nothing. Moving each app over is later work, one app at a time (L6).

To see it working at the end: open `https://gkms-library.tia.run/data/latest.json` (the exact paths are settled in Milestone 1) and follow it to a release of the support card data; open the image of a card that release names; run the comparison check and see it report no difference from what gakumas-supportcards publishes.

## Progress

- [x] (2026-11-09 22:45Z) Design session (`/grill-me`): twelve decisions, recorded below as L1–L12 and in `docs/adr/0001`–`0005`; the repository scaffolded from project-template; this draft written.
- [ ] Milestones fleshed out from a full reading of gakumas-supportcards' generator, image pipeline and update workflow (Context and Orientation names them).
- [ ] Milestone 0 (prototyping): the public bucket address measured, and the schema library chosen.
- [ ] Milestone 1: the data, generated and checked here, written as releases to a local directory.
- [ ] Milestone 2: the images, extracted here, with public copies and private masters.
- [ ] Milestone 3: the daily run publishes both; the comparison check runs in it; failures reach Discord.

## Surprises & Discoveries

- Observation: the skill card file gakumas-supportcards publishes is not a description of the game's skill cards but gkms-memomemo's card pool: its builder keeps only released cards "that can be a produce memory", leaving out P-idol unique cards, support-card event cards, starter cards (but one), trouble cards and Legend cards, and carries only the H.I.F. scenario's memory abilities.
  Evidence: the header comment of gakumas-supportcards' `scripts/lib/build-skillcards.ts`, citing gkms-memomemo's decisions D8, D37 and D38 (read 2026-11-10).

- Observation: the published support card file holds no scores, but it is not pure game fact either: it carries the reading of each effect (`ClassifiedEffect`, `ParsedTrigger`), typed in the scoring engine's `src/engine/types.ts`, and a `held` list of cards the score table hides, for an unreadable effect or for lacking a number in some route profile, which is a scoring matter.
  Evidence: gakumas-supportcards' `data/card-data-file.ts` (format 2, with format 1 still written beside it for gkms-hif-final-stats).

- Observation: gakumas-supportcards' unattended run never fetches an idol's face, and its upload never sends one: faces were added there as local masters only, for gkms-memomemo, the day before this plan. That request is what set this design off.
  Evidence: gakumas-supportcards pull request #83; `extract.py --only-missing` keeps only files of cards in its data.

- Observation: Cloudflare's documentation confirms most of what serving from a public bucket rests on and leaves two points unstated. Confirmed: R2's free tier (10 GB-month, 1 million Class A, 10 million Class B operations a month; GetObject is Class B; no egress charge); "Only requests that hit a Worker will count against your limits and your bill"; a custom domain can use Cloudflare's cache, which caches by file extension, WebP by default and JSON not, and respects the stored Cache-Control; a bucket CORS policy makes the custom domain answer cross-origin requests. Not stated: that a request to a bucket's custom domain runs no Worker, and whether a cache hit counts as a Class B operation.
  Evidence: the R2 pricing, public buckets and CORS pages, the Workers pricing and limits pages, and the default cache behavior page, read 2026-11-10.

## Decision Log

The decisions are numbered L1, L2, … Decisions that outlive this plan are also ADRs under `docs/adr/`; the ADR is the durable record.

- Decision: L1 — the library owns the game's images and the published data files (support cards, skill cards, items, the idol list); apps only read. It does not mirror the raw public tables: gakumas-hajime-lesson and gkms-contest-ai keep reading those themselves.
  Rationale: which images are published follows from the data, and both come out of one daily run; the two projects reading raw tables have no problem today. ADR 0001.
  Date/Author: 2026-11-10, user.

- Decision: L2 — inside the card data, the library publishes the game's facts plus the structured reading of effects (kind, trigger) and names the effects it could not read. The `held` list, scores and scenarios stay in gakumas-supportcards, which derives `held` from the unread effects plus its own scoring gaps.
  Rationale: two apps share the effect reading, and it is where a game update breaks first; `held` mixes in a scoring concept. ADR 0001.
  Date/Author: 2026-11-10, user.

- Decision: L3 — files are served from a public R2 bucket's own address (`gkms-library.tia.run`), with no Worker; apps load data and images directly.
  Rationale: such requests do not count toward the Workers Free daily limit, so single images cost nothing and no sheets are needed. Checked against Cloudflare's documentation at the user's request; two points remain to measure (Surprises & Discoveries; Milestone 0). ADR 0003.
  Date/Author: 2026-11-10, user.

- Decision: L4 — only images of things named in the published data are published, at display sizes; lossless masters are private, in a second bucket.
  Rationale: nothing unreleased leaks, and a new idol's face follows from the idol list being data, with no app asking. ADR 0002.
  Date/Author: 2026-11-10, user.

- Decision: L5 — each data update is an immutable release, with a `latest` pointer. Live apps follow `latest`; gakumas-supportcards fetches the newest release in its own job, runs its gates, and commits it only if they pass.
  Rationale: the score check stays where the scoring lives, and releases give every app something to roll back to. ADR 0004.
  Date/Author: 2026-11-10, user.

- Decision: L6 — migration is side by side, one reader at a time: (1) the library alone publishes at its new address, with a check comparing its output with gakumas-supportcards' published files (this plan); (2) gkms-memomemo moves (faces, the idol list, its own card pool rule; its parked issue #103 is settled there, and its ADR 0005 superseded); (3) gkms-hif-final-stats; (4) gakumas-supportcards last (its generator and extractor leave; its job becomes fetch a release, gate, commit); (5) the old paths are removed once logs show no reader.
  Rationale: three live sites, and installed copies on players' phones, keep working throughout; each step is a small release. Taking over the old addresses instead would keep the per-Worker serving L3 leaves behind.
  Date/Author: 2026-11-10, user.

- Decision: L7 — each format is one schema-as-code TypeScript file, both the types and the check, never changed once published, copied verbatim by each app with a pinned-hash test; the library checks every release against it. Terms: a format is the shape of a file; a release is one update's content in a format.
  Rationale: it is the only option that removes the apps' hand-written readers, where a perfect copy of the types can still be checked wrongly; the never-changes rule removes the dangerous drift, a shape changed without a new number. Which schema library: Milestone 0. ADR 0005.
  Date/Author: 2026-11-10, user.

- Decision: L8 — the data is complete and neutral: every released skill card with the facts an app needs to filter (its kind; every scenario's memory abilities), not one app's pool. gkms-memomemo takes over its pool rule in migration step 2.
  Rationale: the library describes the game; an app's rules live in the app. ADR 0001.
  Date/Author: 2026-11-10, user.

- Decision: L9 — an app that builds its own images from game art reads the private masters through one sync command of the library, with the person's own Cloudflare login; its products stay in its own storage.
  Rationale: the public bucket holds only what the library publishes; quality is kept; a read-only CI token is a later option. ADR 0002.
  Date/Author: 2026-11-10, user.

- Decision: L10 — the repository is created now, from project-template, with a task board.
  Rationale: the decisions need a durable home, and step 1 touches no live site.
  Date/Author: 2026-11-10, user.

- Decision: L11 — the name is `gkms-library`; in prose, "the library".
  Rationale: it holds data and images alike, is tied to no app, and its name is its public address.
  Date/Author: 2026-11-10, user.

- Decision: L12 — the repository is `tia-tools/gkms-library`, public.
  Rationale: its three readers are public under the same organization; the extraction code is already public in gakumas-supportcards; GitHub's branch protection is enforced on public repositories only on the free plans.
  Date/Author: 2026-11-10, user.

Left to this plan by the session, to be decided as the milestones are fleshed out: the public display size of each kind of image; that images are uploaded before the data that names them; that a failed run publishes nothing, so every app keeps the last release; reporting through nudge; the twice-daily schedule; dropping the plain skill card icons and sprite sheets no app reads.

## Outcomes & Retrospective

Nothing yet.

## Context and Orientation

This repository holds only its scaffold so far. The code this plan builds on lives in the sibling checkout `~/Developer/gakumas-supportcards` (GitHub `tia-tools/gakumas-supportcards`, public), which this plan reads and copies from but does not change.

Terms, in plain language. The game's tables are YAML dumps of its master data, public at `https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/<Table>.yaml`. The asset manifest is the game's list of downloadable files, fetched live from its servers; an image there is a Unity asset bundle that must be downloaded and decoded. A master is a lossless copy of an image as the game stores it. R2 is Cloudflare's object storage; a bucket on a custom domain is readable by anyone at that address. A Worker is code Cloudflare runs per request; the account's free plan allows 100,000 such requests a day across every `tia.run` app. nudge (`Taka499/nudge`) lets a GitHub Actions job post to the owner's Discord with an OIDC token and no stored secret.

What gakumas-supportcards has today, by path there. `scripts/generate-cards.ts` with `scripts/lib/` (`tables.ts` loading the tables, `build-cards.ts` and `parse-trigger.ts` and `effect-types.ts` reading support cards and their effects, `build-skillcards.ts` building the skill card file and the idol list, `profile-gate.ts`, which belongs to scoring) generates `data/*.generated.ts`; `data/card-data-file.ts` and `data/skillcard-data-file.ts` define the published files, built into `dist/data/` and served at `https://gakumas-supportcards.tia.run/data/cards.v1.json`, `cards.v2.json` and `skillcards.v1.json`. `scripts/images/` (Python with uv) is the image pipeline: `extract.py` fetches the manifest through GkmasObjectManager (GPL-3.0, unpacked by `fetch-vendor.sh` at a pinned commit, never committed), `decode.py` decodes with UnityPy, `thumbnail.py` names files and makes renditions, `upload.py` and `r2.py` send them to the shared bucket `tia-assets` (`master/` private; `w192/` card art, `w48/` item icons, `w112/` and `sheet112/` skill card icons and sheets, served by the apps' Workers), and `README.md` there explains each. `.github/workflows/update-data.yml` runs all of it at 11:30 and 20:30 JST behind its gates and reports through nudge.

The readers. gkms-hif-final-stats reads `cards.v1.json` and card art and item icons. gkms-memomemo reads `skillcards.v1.json` live, and on its owner's machine the skill card masters and the idols' face masters for images it builds itself. Neither changes in this plan.

## Plan of Work

An outline; each milestone gets its files, commands and acceptance written out when the reading named in Progress is done.

Milestone 0 is two prototypes. First, create the public bucket and its custom domain, put one image and one JSON file in it, and measure what the documentation leaves unstated: fetch each a few hundred times and read the account's Worker request count and R2 operation counts before and after, with and without a Cache Rule for JSON, and with the bucket's CORS policy answering a fetch from another origin. If requests to the address do count as Worker requests, stop: L3 and ADR 0003 are reopened with the user. Second, write the idol list's format in two or three candidate schema libraries and compare the bytes each adds to a built page and the message each gives for a file with one bad value; choose one and record why.

Milestone 1 brings the data here: the table loader, the support card facts and the effect reading, and a skill card builder that keeps every released card with its kind and every scenario's memory abilities (L8), each format as one schema file (L7), each run written as releases with a `latest` pointer (L5) to a local directory, checked against its format. The comparison check reads gakumas-supportcards' published files and reports any difference in what both describe; expected differences (no `held` list; more skill cards) are named in the check, not ignored.

Milestone 2 brings the images here: the extractor and decoder, public copies at display sizes for everything the data names (L4), masters to the private bucket, and the sync command (L9).

Milestone 3 is the unattended run: twice a day it generates, checks, extracts, uploads images, then publishes the data that names them, then moves `latest`; a failure publishes nothing and is reported through nudge; the comparison check runs in it for as long as gakumas-supportcards still publishes.

## Concrete Steps

To be written with the milestones. The toolchain is expected to be Bun with TypeScript for the data and Python with uv for the images, as in gakumas-supportcards, confirmed when Milestone 1 starts.

## Validation and Acceptance

At the end of this plan: the library's address serves a `latest` pointer, the releases it names and the images they name; two consecutive daily runs succeed with no person involved; the comparison check reports no unexpected difference from gakumas-supportcards' published files; the account's Worker request count does not rise with requests to the address; and no app has changed.

## Idempotence and Recovery

Releases never change and `latest` moves last, so a run that fails partway leaves the last good release in place and can simply run again. Nothing in this plan writes to the shared bucket `tia-assets` or changes gakumas-supportcards; removing the library's two buckets and its domain undoes the plan.

## Artifacts and Notes

None yet.

## Interfaces and Dependencies

To be written with the milestones: the address layout (formats, releases, the pointer, image paths), each format's schema file, and the sync command's interface.
