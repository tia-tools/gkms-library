---
status: accepted
---

# The library describes the game; an app's rules live in the app

gkms-library owns everything the `tia.run` apps take from 学園アイドルマスター beyond the raw public tables: the images pulled from the game's servers and the data files generated from the game's tables (support cards, skill cards, items, the idol list). What it publishes is complete and neutral: every released entry, with the facts an app needs to filter, plus a structured reading of each effect (what kind it is, when it fires) and the list of effects it could not read. It carries no app's rules: no scoring, no "held" cards, no card pool chosen for one app. Before it, all of this lived in gakumas-supportcards, a score table, which grew a section for each app that asked (the skill card file shaped as gkms-memomemo's card pool, the idols' faces).

The alternatives were images only (which images are published follows from the data, and both come from one daily run), a mirror of the raw tables as well (the two projects that read them directly have no problem today), data files shaped per app (every rule change becomes a request to another repository again), and facts without the effect reading (two apps already share that reading, and it is where a game update breaks first).

Source: the user's decisions 1, 2 and 8 of the design session of 2026-11-10 (`docs/plans/EXECPLAN_LIBRARY_ALONE.md` § Decision Log, L1, L2, L8); evidence level: user decision; that the published card file holds no scores but does hold the effect reading and a held list was read in gakumas-supportcards' `data/card-data-file.ts` the same day.
