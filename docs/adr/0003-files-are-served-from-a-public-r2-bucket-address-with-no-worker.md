---
status: accepted
---

# Files are served from a public R2 bucket's own address, with no Worker

The apps load the library's data and images straight from its own public address, an R2 bucket on a custom domain (`gkms-library.tia.run`), with no Worker in front. Until now each app's Worker proxied the data file and served images from the shared bucket `tia-assets`, and every such request counted toward the account's Workers Free allowance of 100,000 requests a day, shared by every `tia.run` app; that limit is the only reason sprite sheets existed. Served this way, single small images cost no Worker request, so the library builds no sheets.

The alternatives were keeping the per-app Workers (the daily limit stays in the way) and a Worker of the library's own (it could apply rules, but every request counts). The costs: a public bucket is public as a whole (see ADR 0002 for the masters); the apps fetch across origins, so the bucket needs a CORS policy and each app's offline cache must handle that address; and JSON is not cached at Cloudflare's edge by default, so the data files need a Cache Rule to be.

Source: the user's decision 3 of the design session of 2026-11-10 (`docs/plans/EXECPLAN_LIBRARY_ALONE.md` § Decision Log, L3); evidence level: user decision, checked against Cloudflare's documentation that day: R2's free tier is 10 GB-month, 1 million Class A and 10 million Class B operations a month, a GetObject is Class B, egress is free; "Only requests that hit a Worker will count against your limits and your bill"; WebP is cached by default and JSON is not. Two points the documentation does not state and the plan's first milestone measures: that a request to the bucket's custom domain runs no Worker (inferred from the rule quoted), and whether a cache hit counts as a Class B operation.
