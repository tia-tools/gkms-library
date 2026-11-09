# Publish the game's data and images from the library, beside what exists

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. It is maintained in accordance with `docs/PLANS.md` at the repository root.

The design session of 2026-11-10 settled decisions L1–L12. Its milestones were then written out from a full reading of gakumas-supportcards (issue #1), which added decisions L13–L27; those are the agent's, for the user's review when #1 merges. One question is the user's and still open: job #6 (Decision Log, L20). No code exists yet.

## Purpose / Big Picture

Three public web apps for players of 学園アイドルマスター (a mobile game) run under `tia.run`: gakumas-supportcards (a score table of support cards), gkms-hif-final-stats (a calculator for one scenario) and gkms-memomemo (a memo of owned memories). All three need the same things from the game: its card data and its images. Until now the first app has produced them for the other two as well, and each new need became a request to that app: a file shaped for one reader, a new kind of image. gkms-library ("the library") takes that job over as a neutral service.

After this plan, the library publishes, at its own public address, complete data files generated from the game's tables and the images of everything those files name, updated twice a day with no person involved. Nothing reads it yet: gakumas-supportcards keeps publishing exactly as it does, and a check compares the two, which proves the move loses nothing. Moving each app over is later work, one app at a time (L6).

To see it working at the end: open `https://gkms-library.tia.run/data/latest.v1.json` and follow the path it gives for `support-cards` to a release of the support card data; open `https://gkms-library.tia.run/img/w192/img_general_csprt-3-0110_full.webp`, the art of a card that release names; run `bun run compare --site https://gkms-library.tia.run` and see it report no unexpected difference from what gakumas-supportcards publishes.

## Progress

Each milestone is one issue and one branch, merged through a pull request into `develop`.

- [x] (2026-11-09 22:45Z) Design session (`/grill-me`): twelve decisions, recorded below as L1–L12 and in `docs/adr/0001`–`0005`; the repository scaffolded from project-template; this draft written.
- [x] (2026-11-09 23:27Z) Milestones written out from a full reading of gakumas-supportcards at commit `f8be2dd` (its generator, published formats, image pipeline, update workflow and Worker), of what the two other apps load from it, and of the game's tables and the live published files (#1). Decisions L13–L27 added; issues #2–#5 filed, one per milestone; job #6 filed for the one open question.
- [ ] The user answers job #6 (plain skill card icons public or not); L20 and Milestone 2 are updated if the answer is B.
- [ ] Milestone 0 (prototyping, #2): the public bucket address measured, and the schema library chosen.
- [ ] Milestone 1 (#3): the data, generated and checked here, written as releases to a local directory; the comparison check passes on it.
- [ ] Milestone 2 (#4): the images, extracted here, with public copies and private masters; the sync command.
- [ ] Milestone 3 (#5): the daily run publishes both; the comparison check runs in it; failures reach Discord; two consecutive unattended runs succeed.

## Surprises & Discoveries

- Observation: the skill card file gakumas-supportcards publishes is not a description of the game's skill cards but gkms-memomemo's card pool: its builder keeps only released cards "that can be a produce memory", leaving out P-idol unique cards, support-card event cards, starter cards (but one), trouble cards and Legend cards, and carries only the H.I.F. scenario's memory abilities.
  Evidence: the header comment of gakumas-supportcards' `scripts/lib/build-skillcards.ts`, citing gkms-memomemo's decisions D8, D37 and D38 (read 2026-11-10).

- Observation: the published support card file holds no scores, but it is not pure game fact either: it carries the reading of each effect (`ClassifiedEffect`, `ParsedTrigger`), typed in the scoring engine's `src/engine/types.ts`, and a `held` list of cards the score table hides, for an unreadable effect or for lacking a number in some route profile, which is a scoring matter.
  Evidence: gakumas-supportcards' `data/card-data-file.ts` (format 2, with format 1 still written beside it for gkms-hif-final-stats).

- Observation: gakumas-supportcards' unattended run never fetches an idol's face, and its upload never sends one: faces were added there as local masters only, for gkms-memomemo, the day before this plan. That request is what set this design off.
  Evidence: gakumas-supportcards pull request #83; `extract.py --only-missing` keeps only files of cards in its data.

- Observation: Cloudflare's documentation confirms most of what serving from a public bucket rests on and leaves two points unstated. Confirmed: R2's free tier (10 GB-month, 1 million Class A, 10 million Class B operations a month; GetObject is Class B; no egress charge); "Only requests that hit a Worker will count against your limits and your bill"; a custom domain can use Cloudflare's cache, which caches by file extension, WebP by default and JSON not, and respects the stored Cache-Control; a bucket CORS policy makes the custom domain answer cross-origin requests. Not stated: that a request to a bucket's custom domain runs no Worker, and whether a cache hit counts as a Class B operation.
  Evidence: the R2 pricing, public buckets and CORS pages, the Workers pricing and limits pages, and the default cache behavior page, read 2026-11-10.

- Observation: the reading of a trigger carries one site's vocabulary. A trigger restricted to one scenario ends in `for_<token>` (`for_hif`, `for_hif_memory`, `for_hajime_legend`, `for_hajime_legend_ssr`, `for_nia_master`), and gakumas-supportcards' parser replaces the token with its own scenario id (`hif`, `hajime-legend`), treating a token missing from its table as unreadable so that no score silently counts 0.
  Evidence: `SCENARIO_TOKENS` and `readScenario` in gakumas-supportcards' `scripts/lib/parse-trigger.ts`. Consequence: L15.

- Observation: the game's tables are far larger than what is published today. `ProduceCard` has 1,817 rows for 476 card ids at upgrade levels 0 to 3 (the published pool is 361 rows at levels 0 and 1); its `searchTag` is empty, `starter` or `idol-unique`; 236 rows name an origin support card and 676 an origin idol card. `MemoryAbility` has 585 rows, 115 of them of the H.I.F. scenario group `produce_group-003`, 288 of `produce_group-001`, 108 of `produce_group-002` and 74 of no group. `ProduceItem` has 1,075 rows sharing 521 icons, of which support cards grant 56. Every row of all three is released today. The step labels of every customization, at every level, can be built with the existing rule (2,661 labels, no error).
  Evidence: a probe over the tables cached in gakumas-supportcards on 2026-11-07 (`.cache/gakumasu-diff`), and the live files on 2026-11-10: `cards.v2.json` 1,587,399 bytes with 212 cards and 0 held, `skillcards.v1.json` 192,178 bytes with 13 idols, 361 cards and 115 H.I.F. abilities.

- Observation: the icons of the skill cards left out of today's pool have names the image pipeline does not recognise. Its pattern accepts the kinds `act`, `men` and `ido`; the complete table also has `sup` (236 rows, the cards support cards' events give) and `acc` (1 row).
  Evidence: `SKILLCARD_OBJECT_NAME` in gakumas-supportcards' `scripts/images/thumbnail.py`, against the `assetId` values of `ProduceCard`. Consequence: Milestone 2 widens the pattern, and stops when the data names an image no pattern matches.

- Observation: no app reads the plain skill card icons (`w112/`) or the sprite sheets (`sheet112/`) gakumas-supportcards publishes. gkms-memomemo loads only its own game-style sheets (`gkms-memomemo/sheet112/` in the shared bucket) and builds them from the masters on its owner's machine; gkms-hif-final-stats loads card art (`w192/`) and item icons (`w48/`) only.
  Evidence: `infra/worker/img.ts` of both apps (read 2026-11-10). Consequence: L19, L20 and job #6.

- Observation: gakumas-supportcards treats images as best effort because the game can list a card in its tables before its art is downloadable, and because a game engine update can break decoding; either would otherwise have stopped its data.
  Evidence: the comments of its `update-data.yml` and its issue #84. Consequence: L23.

- Observation: Wrangler (4.159.0) can put, get and delete an R2 object, connect a custom domain to a bucket (`r2 bucket domain add <bucket> --domain … --zone-id …`) and set a bucket's CORS policy from a JSON file (`r2 bucket cors set <bucket> --file …`), but it cannot list a bucket's objects.
  Evidence: `bunx wrangler r2 object --help` and `r2 bucket --help`, run 2026-11-10. Consequence: L21.

- Observation: GitHub runs a scheduled workflow only from the repository's default branch, which here is `develop` so that a pull request's `Closes #N` closes its issue; and it disables schedules in a public repository after 60 days without activity. gakumas-supportcards avoids both because its default branch is production and its run commits data; the library's run commits nothing.
  Evidence: the comments of gakumas-supportcards' `update-data.yml` and its ADR 0008; `CLAUDE.md` § Tasks here. Consequence: L25.

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

- Decision: L13 — the toolchain is the one gakumas-supportcards runs: Bun 1.3.5 with TypeScript 7, `js-yaml` and Oxlint for the data, and Python 3.11 or 3.12 with uv, Pillow and UnityPy for the images. The code is copied from that repository at commit `f8be2dd` and adapted, not rewritten; its tests come with it.
  Rationale: the code works and is tested, the plan's promise is that nothing is lost, and the same person maintains both.
  Date/Author: 2026-11-10, agent, from the reading for #1.

- Decision: L14 — the library publishes four data formats, each at version 1: `idols`, `support-cards`, `skill-cards` and `items`; and a fifth small format, `latest`, for the pointer. The idol list is a file of its own, not a part of the skill card file as today.
  Rationale: ADR 0001 names these four; the idols are named by two other things (a skill card's per-idol art, a face), and an app wanting only the list should not download every skill card.
  Date/Author: 2026-11-10, agent.

- Decision: L15 — `support-cards` version 1 carries what `cards.v2.json` carries (level limits, every card with its breakpoints, effects, triggers and granted items) without `held`, and with `unread`: one entry per effect the library could not read, naming the card and the reason. A trigger restricted to one scenario carries the game's own token (`hif_memory`), not a site's scenario id, and any final `for_<word>` is read as such a restriction. The reading stays what it is today: the effects that raise Vocal, Dance or Visual, the own-event bonus, the SP-rate mark and the granted items with their P-drinks. An effect type that is neither one of those nor on the audited list of types known to raise no parameter is unread.
  Rationale: which scenario a token belongs to, and refusing to count an unknown one as 0, are scoring rules (L2); gakumas-supportcards applies them when it moves over. Widening the reading to other kinds of effect is a new format when an app needs it, not part of moving the job.
  Date/Author: 2026-11-10, agent.

- Decision: L16 — `skill-cards` version 1 lists every released `ProduceCard` row at every upgrade level, with what today's file carries for each (name, plan, rarity, type, order, guide labels, art, customization) and the facts gkms-memomemo's pool rule needs: the type now includes `trouble`, and `origin` gives the search tag (`none`, `starter` or `idolUnique`) and the origin support card and idol card ids. It lists every `MemoryAbility` row with its scenario groups, and, for an ability whose skill names a card (the H.I.F. ones), that card. An unknown enum value still stops the run.
  Rationale: ADR 0001 says every released entry; the comparison check (Milestone 1) then proves today's pool is a subset that can be cut out again with those facts.
  Date/Author: 2026-11-10, agent.

- Decision: L17 — `items` version 1 lists every released `ProduceItem` row with plain facts (id, name, icon, rarity, plan, the limit on how often it fires, the origin support card and idol card ids) and no reading of its effects. The reading of the items support cards grant stays inside `support-cards`, where it is today.
  Rationale: ADR 0001 names items as a data file and says complete; the existing reader handles only the two item effect types support cards' items use, and no app reads other items' effects.
  Date/Author: 2026-11-10, agent.

- Decision: L18 — a release is named `<UTC time as YYYYMMDDTHHMM>Z-<first 8 hex digits of its SHA-256>.json` and stored at `data/<format>/v<N>/`. The pointer `data/latest.v1.json` names, for each format and version, its newest release with its full SHA-256. A run whose content for a format hashes the same as the release the pointer names writes no release for it; the pointer is rewritten only when it would differ. Releases, format files and images are stored `public, max-age=31536000, immutable`; the pointer `public, max-age=300`.
  Rationale: the time makes a listing readable in order and the hash makes the name say what the file holds; skipping unchanged content keeps two runs a day from filling the bucket; five minutes lets Cloudflare's cache carry the pointer's load while an update still reaches apps quickly. R2 returns the Cache-Control stored with an object on every download, so it must match how the object may change: the pointer is the one object rewritten under its name, hence the one short-lived value.
  Date/Author: 2026-11-10, agent.

- Decision: L19 — public images keep today's sizes, prefixes and file names: card art 192 × 108 at `img/w192/img_general_<assetId>_full.webp`, item icons 48 × 48 at `img/w48/<assetId>.webp`, and at `img/w112/`, 112 × 112 with transparency, each idol's face (`img_sd_<idol id>_face-00.webp`) and, pending job #6, each skill card's icon. Faces are published for the idols the idol list names, the 13 playable ones. A further size is a new prefix, never a rename.
  Rationale: gkms-hif-final-stats already shows the first two at these sizes, so its move changes a host name only; 112 is twice a 56-pixel cell, as chosen for skill card icons before; sizes are additive, so starting from the proven ones costs nothing later.
  Date/Author: 2026-11-10, agent.

- Decision: L20 (open, job #6) — the library builds no sprite sheets. Whether it publishes plain skill card icons is the user's to decide: the plan is written for A, publish them at `img/w112/` like every other image (about 2,200 files, 15 MB); B keeps skill card art as private masters only.
  Rationale: sheets existed only for the Workers request limit (ADR 0003). For A: ADR 0002's rule is that publication follows the data and no app asks, and a public copy lets the run ask the address what is stored (L21). For B: no app reads them (Surprises & Discoveries), and it needs another way to know which masters are stored, a list kept in the private bucket.
  Date/Author: 2026-11-10, agent; the choice is the user's.

- Decision: L21 — what is already stored is asked of the public address, one `HEAD` per file the data names, several at a time; only 200 and 404 are answers. A master is uploaded before its public copy, so a public copy that answers 200 implies a stored master.
  Rationale: this is how gakumas-supportcards plans its uploads, it needs no credentials, and Wrangler cannot list a bucket. About 2,900 requests a run are 175,000 Class B operations a month of the 10 million free. Milestone 0 measures how long a 404 is remembered after an upload.
  Date/Author: 2026-11-10, agent.

- Decision: L22 — a run does everything that can fail before its first write, then writes in one order: each image's master, then its public copy; the format files; the releases; the pointer last. A step that fails stops the run, and the pointer still names the last good releases. Images a stopped run already uploaded stay: they show released things the next good run will name.
  Rationale: the session's two wishes, images before the data that names them and a failed run publishing nothing, with the pointer as the one thing an app follows (L5).
  Date/Author: 2026-11-10, agent, settling two points the session left to the plan.

- Decision: L23 — an image the data names that the game offers must be stored before the data is published; if its download, decoding or upload fails, the run stops and publishes nothing. An image the game does not offer yet is reported in the run's summary and does not stop the run.
  Rationale: an app should be able to trust that a named image loads, but the game can list a card before its art (Surprises & Discoveries), and data held back for that would be stale in every app for days. A decoding failure is the library's to fix, and every run reports it until it is.
  Date/Author: 2026-11-10, agent.

- Decision: L24 — a run stops when a format would list fewer entries than the release the pointer names, unless started by hand with `allow-fewer`.
  Rationale: gakumas-supportcards' guard against a broken dump, moved from its committed file to the previous release.
  Date/Author: 2026-11-10, agent.

- Decision: L25 — the run is scheduled at 11:50 and 20:50 Japan time, from a workflow file on `develop` (the default branch) that checks out `main` and runs one command, `bun run daily`. A Monday morning message says the schedule is alive even when nothing changed. Reports go through nudge.
  Rationale: `main` is what is released (Git-flow), and keeping the workflow to one command leaves almost nothing that can differ between the two branches; twenty minutes after gakumas-supportcards' runs (11:30 and 20:30) lets the comparison see its deploy; the run commits nothing, so the weekly message is what makes a schedule GitHub disabled visible.
  Date/Author: 2026-11-10, agent, settling two points the session left to the plan.

- Decision: L26 — the comparison check runs after publication and never holds it back; an unexpected difference fails the run's report. Expected differences are named in the check, each with its count: more skill cards and abilities, no `held`, the scenario tokens.
  Rationale: nothing reads the library during this plan, so publishing a difference harms no one, and gakumas-supportcards can lag for a reason of its own (a gate that refused an update).
  Date/Author: 2026-11-10, agent.

- Decision: L27 — the buckets are `gkms-library` (public, on the custom domain) and `gkms-library-masters` (private). The unattended run uses a Cloudflare API token limited to R2 on those two buckets, stored as the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Creating the buckets, the domain and the token are the user's actions, asked for as jobs on the board.
  Rationale: the library's token should not be able to deploy another app's Worker or write the shared bucket; changes on the user's Cloudflare account are confirmed first.
  Date/Author: 2026-11-10, agent.

## Outcomes & Retrospective

Nothing yet.

## Context and Orientation

This repository holds only its scaffold so far: `CLAUDE.md`, `docs/PLANS.md`, `docs/adr/` and this plan. The code this plan builds on lives in the sibling checkout `~/Developer/gakumas-supportcards` (GitHub `tia-tools/gakumas-supportcards`, public), which this plan reads and copies from, at commit `f8be2dd`, but does not change.

Terms, in plain language. The game's tables are YAML dumps of its master data, public at `https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/<Table>.yaml`; each is a list of rows. The asset manifest is the game's list of downloadable files, fetched live from its servers; an image there is a Unity asset bundle (a file in the game engine's packed format) that must be downloaded and decoded. A master is a lossless copy of an image as the game stores it. R2 is Cloudflare's object storage; a bucket on a custom domain is readable by anyone at that address. A Class A operation is a write or a listing, a Class B operation a read; R2's free tier allows 1 million and 10 million a month. A Worker is code Cloudflare runs per request; the account's free plan allows 100,000 such requests a day across every `tia.run` app. Wrangler is Cloudflare's command line tool, run as `bunx wrangler`; it uses a person's login locally and the `CLOUDFLARE_API_TOKEN` environment variable in an unattended job. nudge (`Taka499/nudge`) lets a GitHub Actions job post to the owner's Discord with an OIDC token (a short-lived proof of which repository the job runs in) and no stored secret; it already serves the `tia-tools` organization. A format is the shape of a published file; a release is one update's content in a format; the pointer is the one small file that names each format's newest release (L5, L7).

Game vocabulary. A support card has skills whose values change at certain card levels; the card's 凸 (limit break, 0 to 4) sets its maximum level. An effect of a skill fires on a trigger; the trigger's id is text such as `p_trigger-end_lesson-lesson_vocal-for_hif`, which the library reads into an occasion (the game's phase, `EndLesson`), filters (which occurrences qualify: a Vocal lesson), conditions (what must hold: stamina in a range) and an optional scenario restriction. A P-item is an item a card's event grants. A skill card is a card played in lessons and exams; it exists at upgrade levels, some are drawn differently per idol, and from level 1 it can be customized in steps. A memory ability is an ability a produce memory carries; each belongs to scenario groups (`produce_group-003` is 初星アイドルフェスティバル, H.I.F.). An idol here is a playable character, identified by a four-character id such as `hski`.

What gakumas-supportcards has today, by path there.

The data. `scripts/generate-cards.ts` is the command; `scripts/lib/tables.ts` loads the tables (from `.cache/gakumasu-diff/` when present, else fetched and cached; the environment variable `GAKUMASU_DIFF_CACHE` points it at another copy, which tests use) and checks that each row has the fields read, with their types for the skill card tables. `scripts/lib/build-cards.ts` builds the support cards: for each card, the skills active at each level, the events unlocked at each level and the P-items they grant, sorted so that output is identical byte for byte across machines; it throws on what it cannot represent (an unknown enum value, a dangling id, a value range) and reports, without throwing, the effects it cannot read. `scripts/lib/parse-trigger.ts` reads a trigger id; `scripts/lib/effect-types.ts` is the audit of the game's effect types: which raise a parameter and which are known not to. `scripts/lib/build-skillcards.ts` builds gkms-memomemo's pool, the idol list and the H.I.F. abilities; `isReleased` there decides release from `viewStartTime` and a clock passed in. `scripts/lib/profile-gate.ts`, `scripts/lib/score-snapshot.ts`, `scripts/check-score-stability.ts` and `data/scenarios/` are scoring and stay there. The types of a support card are in `src/engine/types.ts` (`Card`, `Breakpoint`, `ClassifiedEffect`, `ParsedTrigger`, `FilterRef`, `ConditionRef`, `ItemGrant`, `LevelLimits`); the skill card file's are in `data/skillcard-data-file.ts`. The generated modules are committed (`data/*.generated.ts`), and the build (`vite.config.ts`) writes from them `dist/data/cards.v2.json`, `cards.v1.json` and `skillcards.v1.json`, served at `https://gakumas-supportcards.tia.run/data/`.

The images. `scripts/images/` is Python with uv. `extract.py` fetches the manifest through GkmasObjectManager (GPL-3.0, not a package; `fetch-vendor.sh` unpacks it at the commit in `GkmasObjectManager.sha` into `vendor/`, never committed), downloads the bundles wanted and writes, per file, a master and a public copy. `decode.py` decodes a bundle with UnityPy, trying engine versions in order because the bundles have theirs stripped and a wrong one yields nonsense instead of an error. `thumbnail.py` holds the naming patterns and the image rules: card art is stored squashed at 2048 × 1024 and kept as a master at the 16:9 the game shows, 2048 × 1152; icons are 256 × 256 with transparency and kept as stored. `uploads.py` plans uploads (which files the data allows, which are missing, master first); `deployed_site.py` asks the live site by `HEAD`; `r2.py` puts one object with `bunx wrangler r2 object put`, trying twice more after 5 and 20 seconds because the R2 API sometimes fails one put; `upload.py` is the command. `sheets.py` and `sheet_rules.py` build sprite sheets, which the library does not (L20). `skillcards.py` reads the generated TypeScript module as JSON; the library's pipeline reads release files instead. The bucket is `tia-assets`, shared by the apps: `master/` private, `w192/`, `w48/`, `w112/` and `sheet112/` served by gakumas-supportcards' Worker under `/img/`.

The run. `.github/workflows/update-data.yml` runs at 11:30 and 20:30 Japan time: generate, the gates (tests, type check, lint, score stability), images as best effort, then a self-merged pull request and a deploy, and a `notify` job posting to nudge. `scripts/lib/workflows.test.ts` pins the order of its steps.

The readers. gkms-hif-final-stats' Worker fetches `cards.v1.json` and serves card art and item icons from the shared bucket. gkms-memomemo's Worker fetches `skillcards.v1.json`; on its owner's machine it reads the skill card masters and the idols' face masters for images it builds itself. Neither changes in this plan.

## Plan of Work

Four milestones, each a branch and a pull request into `develop`, each closing its issue. A session starting one claims its issue first with the `task-board` skill.

### Milestone 0 (prototyping, #2): the address and the schema library

This milestone answers two questions before anything is built on their answers, and leaves the two buckets in place. Nothing it writes is kept except the buckets, the measurements recorded in this plan, and the chosen library.

The first question is whether serving from a bucket's own address is free of the Workers limit, as L3 assumes. The user approves and runs, or lets the session run, the creation of the bucket `gkms-library` with the custom domain `gkms-library.tia.run`, and of the private bucket `gkms-library-masters` (a job on the board, kind `run`; Concrete Steps has the commands). The session puts one WebP image and one JSON file under the prefix `probe/`, and a CORS policy allowing `GET` and `HEAD` from any origin. It then fetches each file 500 times and has the account's numbers read before and after: the Workers request count for the day, and the bucket's Class A and Class B operation counts (the Cloudflare dashboard shows both; they lag by some minutes, so each reading waits ten). It repeats the JSON fetches after adding a Cache Rule that makes the address's JSON eligible for Cloudflare's cache. It fetches the JSON from a page on another origin (a local file served by `bunx serve` is enough) and sees the response carry `Access-Control-Allow-Origin`. And it asks for a file that does not exist, uploads it, and asks again every 30 seconds, to learn how long a 404 is remembered (L21). The results go into Surprises & Discoveries and ADR 0003. If the Workers request count rises with the fetches, the work stops there: L3 and ADR 0003 are reopened with the user, and Milestones 2 and 3 wait. If a remembered 404 lasts longer than ten minutes, L21 is revisited before Milestone 2. The probe objects are deleted at the end.

The second question is which schema library the formats are written in (L7). A schema library is a small TypeScript library with which one writes a description of a value that is at once its type and a function that checks an unknown value against it. In a scratch directory `prototypes/schema/` the session writes the `idols` format (Interfaces and Dependencies) three times, with Valibot, with Zod's small build (`zod/mini`), and with ArkType, after reading each one's current documentation rather than relying on memory. For each it records: the bytes a minimal page that imports the format and checks a fetched file adds when built with Vite, minified and gzipped; the message for a file in which the third idol's `name` is a number, which must say where the bad value is; whether the rule "each idol id once" can be written inside the schema; whether it type-checks under TypeScript 7 with this repository's strict settings; and its licence and dependencies. The smallest candidate whose message names the place and that passes the other points is chosen; the choice and the numbers are recorded as a decision here and in ADR 0005, and `prototypes/` is deleted in the same pull request.

Acceptance: this plan records the measured counts and the chosen library with its numbers; `https://gkms-library.tia.run/probe/…` answered 200 during the trial and the probe objects are gone after it; the Workers request count did not rise.

### Milestone 1 (#3): the data, generated here

At the end of this milestone, `bun run generate` reads the game's tables and writes the four data files as releases, with the pointer and the format files, into `out/site/`, a directory that mirrors the public bucket; `bun run compare --site out/site` reports no unexpected difference from gakumas-supportcards' live files; and nothing has been uploaded.

The project is set up first: `package.json` (scripts `generate`, `compare`, `test`, `type-check`, `lint`), `tsconfig.json` and `oxlint.config.ts` adapted from gakumas-supportcards without the parts for its page and Worker, `bun.lock`, a `.gitignore` for `node_modules`, `.cache`, `out`, and the Python working directories, and `.github/workflows/check.yml`, which runs the tests, the type check and the lint on every pull request into `develop` with read-only permissions and states at its top what it guards.

The formats come next, each one file under `formats/` written with the library Milestone 0 chose and importing nothing else: `idols.v1.ts`, `support-cards.v1.ts`, `skill-cards.v1.ts`, `items.v1.ts` and `latest.v1.ts`. Each exports the schema, the type derived from it, and a `parse` function that returns the checked value or throws naming the place of the first bad value. The rules beyond shape live in the schema: no empty list of entries, each id once (each id and upgrade level once for skill cards), a pointer path that matches its format, version and release name. Until the first release is published at the public address in Milestone 3 a format may still change; from then on it never does (ADR 0005), and `formats/pinned.test.ts` pins each published file's SHA-256.

The builders are copied and adapted under `src/`. `src/tables.ts` is `scripts/lib/tables.ts` with the item fields the items file needs added and every table's fields typed. `src/support-cards/` holds `build.ts`, `parse-trigger.ts` and `effect-types.ts`, changed in three ways: the types come from `formats/support-cards.v1.ts`; an effect that cannot be read is reported as an `unread` entry instead of a held card; and a final `for_<word>` is always read as a scenario restriction carrying the word (L15). `src/skill-cards/build.ts` keeps `isReleased`, the label rules and the idol and ability builders, and replaces the pool rule with "every released row" (L16). `src/idols/build.ts` and `src/items/build.ts` are small and new. `src/release.ts` is pure: the deterministic text of a file, its SHA-256, a release's name from a clock passed in, and the next pointer given the previous one (L18). `src/generate.ts` is the command: it loads the tables, builds the four files, checks each against its format and against the previous pointer's counts (L24), and only then writes. Where the previous pointer comes from is an argument, `--previous <directory or address>`, by default `out/site`.

`src/compare/` is the comparison check (L26): `compare.ts` is pure, taking the two sites' parsed files and returning the differences, each either expected, with a name and a count, or unexpected; `src/compare/main.ts` fetches `https://gakumas-supportcards.tia.run/data/cards.v2.json` and `skillcards.v1.json` and reads the library's side from `--site`. What it compares is in Validation and Acceptance.

The tests of the copied modules come with them and are adapted; each new rule gets a test that is first seen to fail with the rule broken.

Acceptance: from a clean checkout, `bun install`, then `bun run generate` writes four releases and a pointer and prints their counts; a second run writes nothing new and leaves the pointer identical; a run against a copy of the tables with one support card's name changed writes exactly one new release, of `support-cards`; `bun run compare --site out/site` exits 0; `bun test`, `bun run type-check` and `bun run lint` pass.

### Milestone 2 (#4): the images, extracted here

At the end of this milestone, the public bucket holds a display-size copy of every image the newest local release names, the private bucket holds each one's master, and `bun run sync-masters` brings masters to a directory for an app's own image build. The data is still not published; the address serves images only.

`images/` is `scripts/images/` copied and adapted, with its tests: `extract.py`, `decode.py`, `renditions.py` (today's `thumbnail.py`: the naming patterns and image rules, with the kinds `sup` and `acc` added to the skill card pattern and the face given a public copy), `wanted.py` (which file names the data names, read from the release files the pointer in `--site` names, replacing `skillcards.py` and the regular expressions over TypeScript source), `stored.py` (asks the library's address by `HEAD`, several at a time, replacing `deployed_site.py`), `uploads.py` and `upload.py` (planning and the master-first order, writing to the two buckets instead of two prefixes of one), `r2.py`, `fetch-vendor.sh`, `GkmasObjectManager.sha`, `pyproject.toml` and `README.md`. The sheet modules are not copied.

The rules that change. What may be published is exactly what the data names: card art for each support card, an icon for each item, a face for each idol, and an icon for each skill card, one per idol where its art varies (pending job #6). If the data names an image whose name no pattern recognises, the run stops, so a new kind of asset is noticed instead of skipped. An image the manifest does not offer is listed in the summary and does not stop anything; one it offers that fails to download, decode or upload stops the run (L23). `extract.py` and `upload.py` write a summary file, `out/images-summary.json`, with the counts and the names not offered, for the daily run's report.

The first upload is done from a person's machine, not by the unattended run: about 2,900 files, each a master and a public copy. The session times the first fifty puts, writes the estimate here, and runs the rest with several puts at a time.

`src/sync-masters.ts` is the sync command (L9): for each image the newest published data names, or those matching `--only`, it downloads the master from `gkms-library-masters` with `bunx wrangler r2 object get`, skipping files already in the destination, using the person's Wrangler login.

Acceptance: `uv run pytest` passes in `images/`; `uv run upload.py --dry-run` reports nothing missing after the upload; `curl -I https://gkms-library.tia.run/img/w192/img_general_csprt-3-0110_full.webp` answers 200 with `content-type: image/webp` and the immutable Cache-Control, and the same for one item icon, one face and one skill card icon; a master's name at the public address answers 404; `bun run sync-masters -- --dest /tmp/masters --only 'img_sd_'` leaves 13 files there, and a second run downloads none.

### Milestone 3 (#5): the unattended run

At the end of this milestone the library publishes by itself. `src/publish.ts` uploads what `out/site/` holds and the public address lacks, in the order of L22: format files, releases, the pointer last, each with its Cache-Control (L18), then fetches the pointer back from the address, past the cache, and checks that it and every release it names parse and hash as expected. `src/daily.ts`, run as `bun run daily`, is the whole run in order: generate with the previous pointer read from the public address; the image steps of Milestone 2; publish; then the comparison check with `--images`, whose result is reported but does not undo anything (L26). It writes a short summary for the report: which formats got a new release, with counts; images uploaded; images not offered; the comparison's verdict.

`.github/workflows/update.yml` runs it at 11:50 and 20:50 Japan time and by hand (with an `allow-fewer` input), on `develop` as the default branch, checking out `main` (L25). Its job has no permissions beyond reading the repository; the Cloudflare token and account id come from secrets (L27). A second job, `notify`, with only `id-token: write`, posts to nudge when the run failed or was cancelled, when anything was published, when the comparison found an unexpected difference, when the run was started by hand, and on Monday's morning run regardless. The file states at its top what it guards. A test, as in gakumas-supportcards, pins the order of `daily`'s steps, so that a later edit cannot move the pointer before the releases.

The user creates the token and the two secrets (a job on the board, kind `run`), and approves the release merge of `develop` into `main` that puts the code where the schedule runs it. The first run is started by hand. `README.md` is written: what the library publishes and where, how an app reads the pointer and a release, how it copies a format file, and how to run each command. `CLAUDE.md`'s Architecture, Setup, Build and Test sections are filled in. When the acceptance below has passed, the plan is closed out with the `close-out` skill.

Acceptance: the plan's own, in Validation and Acceptance.

## Concrete Steps

Commands are run from the repository root, `~/Developer/gkms-library`, unless a directory is given. This section is extended with real transcripts as each milestone runs.

Starting any milestone:

    python3 -I ~/.claude/skills/task-board/board.py check
    python3 -I ~/.claude/skills/task-board/board.py sync
    git fetch origin
    git switch -c <branch> origin/develop
    python3 -I ~/.claude/skills/task-board/board.py claim <N> --branch <branch> --worktree .

Milestone 0, the buckets (after the user's approval; `<zone id>` is the id of the `tia.run` zone, shown on its overview page in the Cloudflare dashboard):

    bunx wrangler whoami
    bunx wrangler r2 bucket create gkms-library
    bunx wrangler r2 bucket create gkms-library-masters
    bunx wrangler r2 bucket domain add gkms-library --domain gkms-library.tia.run --zone-id <zone id>
    bunx wrangler r2 bucket cors set gkms-library --file infra/cors.json
    bunx wrangler r2 bucket cors list gkms-library

`infra/cors.json` allows `GET` and `HEAD` from any origin; its exact shape is the one `wrangler r2 bucket cors set --help` documents at that time, and the file is committed. Putting and fetching the probe:

    bunx wrangler r2 object put gkms-library/probe/a.webp --file <any small webp> --content-type image/webp --cache-control "public, max-age=31536000, immutable" --remote
    bunx wrangler r2 object put gkms-library/probe/a.json --file <any small json> --content-type application/json --cache-control "public, max-age=300" --remote
    for i in $(seq 500); do curl -s -o /dev/null -w "%{http_code} %header{cf-cache-status}\n" https://gkms-library.tia.run/probe/a.webp; done | sort | uniq -c

The last line prints how many answers were 200 and how many came from Cloudflare's cache (`HIT`) or from the bucket (`MISS`, `DYNAMIC`). The same loop is run for `a.json`, before and after the Cache Rule.

Milestone 1:

    bun install
    bun run generate
    bun run generate
    bun run compare --site out/site
    bun test && bun run type-check && bun run lint

The first `generate` is expected to print, with counts near these (the tables of 2026-11-07 and the live files of 2026-11-10):

    idols v1: 13 idols — new release 20261110T0300Z-xxxxxxxx
    support-cards v1: 212 cards, 0 unread — new release …
    skill-cards v1: 1817 cards (476 ids), 585 abilities — new release …
    items v1: 1075 items — new release …
    wrote out/site/data/latest.v1.json

and the second, `unchanged` for each format and `pointer unchanged`. `compare` is expected to end with `no unexpected difference` after listing the expected ones with their counts, and to exit 0.

Milestone 2, in `images/`:

    ./fetch-vendor.sh
    uv sync
    uv run pytest
    uv run extract.py --site ../out/site
    uv run upload.py --site ../out/site --dry-run
    uv run upload.py --site ../out/site

and from the root:

    bun run sync-masters -- --dest /tmp/masters --only 'img_sd_'

Milestone 3:

    bun run daily -- --dry-run
    gh workflow run update.yml
    gh run watch

`--dry-run` does everything but upload and prints what it would write.

## Validation and Acceptance

Each milestone's acceptance is in Plan of Work. At the end of the plan, all of the following hold.

The address serves a pointer, the releases it names and the images they name. `curl -s https://gkms-library.tia.run/data/latest.v1.json` returns a file that `formats/latest.v1.ts` accepts and that names one release for each of the four formats; each named path answers 200 with `content-type: application/json` and the immutable Cache-Control, and its SHA-256 is the one the pointer gives; `https://gkms-library.tia.run/formats/idols.v1.ts` returns the file in the repository byte for byte. For every image name the releases give, the public address answers 200, except those the last run's summary lists as not offered by the game.

Two consecutive scheduled runs succeed with no person involved, and the Monday message arrives.

The comparison check reports no unexpected difference. It checks that: the level limits are equal; the two sites list the same support card ids, and each card is equal once the library's scenario tokens are mapped as gakumas-supportcards maps them (`hif` and `hif_memory` to `hif`, `hajime_legend` and `hajime_legend_ssr` to `hajime-legend`, `nia_master` to itself); every reason in gakumas-supportcards' `held` list is either one of the library's `unread` entries or a scoring reason (it says `no route profile number`), and every `unread` entry appears there; the idol lists are equal in ids, names and order; every skill card of gakumas-supportcards' file, by id and upgrade level, is in the library's and equal in name, plan, rarity, type, order, guide labels, art and customization; every H.I.F. ability there is in the library's with the same card and the group `produce_group-003`; every item a support card grants is in the items file with the same name and icon; and, with `--images`, every card art and item icon gakumas-supportcards' site serves for its data is served under the same name by the library. The expected differences it names and counts are the skill cards and abilities only the library has, the absence of `held`, and the scenario tokens. Because the two sites read the tables at different times, a difference is unexpected only when a second run still shows it.

The account's Workers request count does not rise with requests to the address (measured in Milestone 0).

No app has changed: no commit in gakumas-supportcards, gkms-hif-final-stats or gkms-memomemo belongs to this plan, and nothing was written to the bucket `tia-assets`.

## Idempotence and Recovery

Every command can be run again. `generate` writes a release only for content the previous pointer does not already name, so a second run writes nothing. An upload sends only what the address lacks, and writing the same object twice is harmless. Releases never change and the pointer moves last, so a run that fails partway leaves the last good release in place and can simply run again; what it had already uploaded is reused.

A bad release that did get published is undone by putting back the pointer: write a pointer naming the previous release of that format (its name is in the bucket's listing in the dashboard, and in the run summaries) and put it at `data/latest.v1.json`. The bad release file stays, unnamed. If a format file was published wrong before any app copied it, it may be replaced once; after an app has copied it, never (ADR 0005).

Nothing in this plan writes to the shared bucket `tia-assets` or changes gakumas-supportcards. Removing the library's two buckets, its domain, its token and its two repository secrets undoes the plan.

## Artifacts and Notes

The counts the milestones' numbers come from, read 2026-11-10: tables cached 2026-11-07 — `SupportCard` 204 rows, `ProduceCard` 1,817 rows (476 ids; 141 ids drawn per idol; levels 0–3), `MemoryAbility` 585, `ProduceItem` 1,075 (521 icons), `Character` 24 (13 playable); live files — `cards.v2.json` 212 cards, 0 held, 56 distinct granted items; `skillcards.v1.json` 13 idols, 361 cards, 115 H.I.F. abilities. Expected public images under A of job #6: 212 card art, 521 item icons, 13 faces, and 335 + 141 × 13 = 2,168 skill card icons, about 2,900 in all.

## Interfaces and Dependencies

The public address, as bucket keys of `gkms-library`:

    data/latest.v1.json                          the pointer; the only object that changes under its name
    data/<format>/v<N>/<release>.json            a release, e.g. data/support-cards/v1/20261110T0300Z-1a2b3c4d.json
    formats/<format>.v<N>.ts                     the format's schema file, as in the repository
    img/w192/img_general_<assetId>_full.webp     support card art, 192 × 108
    img/w48/<assetId>.webp                       item icon, 48 × 48, e.g. img_general_pitem_2-004.webp
    img/w112/img_sd_<idol id>_face-00.webp       idol's face, 112 × 112
    img/w112/<asset>[-<idol id>].webp            skill card icon, 112 × 112 (pending job #6)

The private bucket `gkms-library-masters` holds each image's master under its file name, with no prefix, stored `private, no-cache`.

The formats, as TypeScript shapes; the schema files in `formats/` are their source once written, and may refine names until first publication.

    // formats/latest.v1.ts
    interface Latest { pointerVersion: 1; files: readonly LatestFile[] }           // one per format and version, sorted
    interface LatestFile { format: "idols" | "support-cards" | "skill-cards" | "items"; formatVersion: number;
                           release: string; path: string; sha256: string; entries: number }

    // formats/idols.v1.ts
    interface IdolsFile { formatVersion: 1; idols: readonly Idol[] }               // the game's order
    interface Idol { id: string; name: string }                                    // "hski", "花海咲季"

    // formats/support-cards.v1.ts — Card, Breakpoint, ClassifiedEffect, ParsedTrigger, FilterRef, ConditionRef,
    // ItemGrant and LevelLimits as in gakumas-supportcards' src/engine/types.ts at f8be2dd, except that
    // ParsedTrigger.scenario is the game's token
    interface SupportCardsFile { formatVersion: 1; levelLimits: LevelLimits; cards: readonly Card[]; unread: readonly Unread[] }
    interface Unread { cardId: string; cardName: string; reason: string }

    // formats/skill-cards.v1.ts — SkillCard as in gakumas-supportcards' data/skillcard-data-file.ts, with
    // type "active" | "mental" | "trouble" and the added field origin
    interface SkillCardsFile { formatVersion: 1; cards: readonly SkillCard[]; memoryAbilities: readonly MemoryAbility[] }
    interface Origin { tag: "none" | "starter" | "idolUnique"; supportCard: string | null; idolCard: string | null }
    interface MemoryAbility { id: string; groups: readonly string[]; card?: string }

    // formats/items.v1.ts
    interface ItemsFile { formatVersion: 1; items: readonly Item[] }               // by id
    interface Item { id: string; name: string; assetId: string; rarity: "N" | "R" | "SR" | "SSR";
                     plan: "free" | "sense" | "logic" | "anomaly"; cap?: number;
                     originSupportCard: string | null; originIdolCard: string | null }

Functions that must exist at the end of Milestone 1:

    // src/release.ts
    export function fileText(file: unknown): string                               // deterministic JSON
    export function sha256Hex(text: string): string
    export function releaseName(now: Date, sha256: string): string                // "20261110T0300Z-1a2b3c4d"
    export function nextPointer(previous: Latest | null, built: readonly Built[], now: Date): { pointer: Latest; fresh: readonly Built[] }

    // src/compare/compare.ts
    export function compare(theirs: TheirFiles, ours: OurFiles): readonly Difference[]
    export interface Difference { kind: "expected" | "unexpected"; name: string; count: number; examples: readonly string[] }

The commands: `bun run generate [--previous <directory or address>] [--allow-fewer]`; `bun run compare --site <directory or address> [--images]`; `bun run publish [--dry-run]`; `bun run daily [--dry-run] [--allow-fewer]`; `bun run sync-masters -- --dest <directory> [--only <regular expression>]`; in `images/`, `uv run extract.py --site <directory>` and `uv run upload.py --site <directory> [--dry-run]`.

Dependencies: Bun 1.3.5, TypeScript 7, Oxlint with tsgolint, `js-yaml`, and the schema library Milestone 0 chooses, which each app will also need at the same major version to use a copied format file; Python 3.11 or 3.12 with uv, Pillow, UnityPy 1.10.18 or older, and GkmasObjectManager at a pinned commit, fetched and never committed (GPL-3.0; it is run, not distributed); Wrangler 4 through `bunx`; the GitHub Actions `actions/checkout`, `oven-sh/setup-bun`, `astral-sh/setup-uv` and `Taka499/nudge/actions/notify`, each pinned to a commit as in gakumas-supportcards' workflows.

---

Revision note, 2026-11-10 (#1): the milestones, Concrete Steps, Validation, Recovery and Interfaces were written out from a full reading of gakumas-supportcards at `f8be2dd`, replacing the outline of the draft. Surprises gained seven observations from that reading; decisions L13–L27 were added, all the agent's and for the user's review, among them the six points the design session had left to this plan (image sizes, images before data, a failed run publishing nothing, nudge, the schedule, sheets and plain skill card icons). The pointer's path became `data/latest.v1.json`, since the pointer has a format of its own. One question stays open as job #6.
