---
status: accepted
---

# Each format is one schema-as-code file that never changes, copied verbatim by the apps

A format is the shape of a published file; a release is one update's content in a format. Each format is described by one TypeScript file written with a small schema library, which is both the types and the check, and carries the rules beyond shape (each idol once, no empty card list). The file is published beside the data and never changes once published: any change of shape, however small, is a new format number, published beside the old one while an app still reads it. Each app copies the file verbatim and checks downloaded data with it, with a test pinning the copy's hash; the library checks every release against its format before publishing, and a test pins each published format's hash.

The alternatives were copying a types file as before (each app hand-writes the reader that checks a file, 125 to 200 lines with their tests, and a reader can disagree with a perfect copy of the types), a package (a registry and a release process for three readers), and a JSON Schema file (a checker and a type generator in every app, and the rules beyond shape still hand-written). The cost is one small dependency in each app's page and the loss of the hand-written readers' error messages unless the library's choice keeps them naming where the bad value is; which library is settled by a trial in the plan's first milestone.

Source: the user's decision 7 of the design session of 2026-11-10 (`docs/plans/EXECPLAN_LIBRARY_ALONE.md` § Decision Log, L7); evidence level: user decision; the readers' sizes were counted in gkms-memomemo and gkms-hif-final-stats that day. No drift between copies had been observed; the rule that a format never changes is what removes the dangerous case, a shape changed without a new number, which the apps' strict readers would refuse whole.
