---
status: accepted
---

# Data is published as immutable releases with a `latest` pointer; each app gates its own intake

Each update of a data file is published as a release, a file that never changes once published, and a small `latest` file points at the newest. An app that shows data live (gkms-memomemo, gkms-hif-final-stats) follows `latest`. gakumas-supportcards, which builds its data into its page and must check that no card's score moved without its data changing, fetches the newest release in its own daily job, runs its own gates, and commits it only if they pass; otherwise it stays on its last good release and reports. The library knows nothing of any app's gates; its own tests guard the facts and the effect reading.

The alternatives were one moving file for everyone (supportcards' score check would no longer stand in front of what its page shows) and running that check inside the library (scoring knowledge in a neutral service, against ADR 0001). The cost: after a bad update, live apps may briefly show data supportcards has refused, so the library's own tests must be strong enough alone; the releases give every app something to roll back to.

Source: the user's decision 5 of the design session of 2026-11-10 (`docs/plans/EXECPLAN_LIBRARY_ALONE.md` § Decision Log, L5); evidence level: user decision; that supportcards gates a data update on its tests and score stability check before merging was read in its `update-data.yml` the same day.
