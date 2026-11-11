/**
 * Format `latest`, version 1: the pointer, the one published file that changes under its name. It
 * names, for each data format and version, the newest release.
 *
 * A release is one update's content in a format, stored under a name that never gets other content:
 * `data/<format>/v<version>/<release>.json`, where `<release>` is the UTC time it was made and the
 * first 8 hex digits of the file's SHA-256 (`20261110T0300Z-1a2b3c4d`). An app that shows data
 * live fetches this pointer and then the path it gives (docs/adr/0004).
 *
 * This file is both the pointer's types and its check, and it never changes once published
 * (docs/adr/0005). It imports nothing but Valibot (major version 1).
 */

import * as v from "valibot";

export const FORMATS = ["idols", "items", "skill-cards", "support-cards"] as const;

export const LatestFile = v.pipe(
  v.strictObject({
    format: v.picklist(FORMATS),
    formatVersion: v.pipe(v.number(), v.integer(), v.minValue(1)),
    release: v.pipe(v.string(), v.regex(/^\d{8}T\d{4}Z-[0-9a-f]{8}$/, "a release is named <YYYYMMDDTHHMM>Z-<8 hex digits>")),
    /** Where the release is, relative to the address's root. */
    path: v.string(),
    /** The SHA-256 of the release's bytes, as 64 hex digits. */
    sha256: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/, "a SHA-256 is 64 lowercase hex digits")),
    /** How many entries the release lists: idols, items, skill card rows or support cards. */
    entries: v.pipe(v.number(), v.integer(), v.minValue(1)),
  }),
  v.check((file) => file.path === `data/${file.format}/v${file.formatVersion}/${file.release}.json`, "the path is not data/<format>/v<version>/<release>.json"),
  v.check((file) => file.release.endsWith(`-${file.sha256.slice(0, 8)}`), "the release's name does not end with the first 8 digits of its SHA-256"),
);
export type LatestFile = v.InferOutput<typeof LatestFile>;

export const Latest = v.strictObject({
  pointerVersion: v.literal(1),
  /** One entry per format and version, sorted by format and then version. */
  files: v.pipe(
    v.array(LatestFile),
    v.minLength(1, "the pointer names no release"),
    v.checkItems(
      (file, index, all) => all.findIndex((other) => other.format === file.format && other.formatVersion === file.formatVersion) === index,
      "this format and version appear earlier in the list",
    ),
  ),
});
export type Latest = v.InferOutput<typeof Latest>;

/** The checked pointer, or a thrown error naming the place of the first bad value. */
export function parse(data: unknown): Latest {
  const result = v.safeParse(Latest, data);
  if (result.success) return result.output;
  const issue = result.issues[0];
  throw new Error(`latest v1: ${v.getDotPath(issue) ?? "(file)"}: ${issue.message}`);
}
