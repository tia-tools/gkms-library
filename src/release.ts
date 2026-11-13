/**
 * Releases and the pointer (docs/adr/0004; docs/plans/EXECPLAN_LIBRARY_ALONE.md, L18, L24). Pure:
 * the clock and the previous pointer are passed in.
 *
 * A release is one update's content in a format, stored under a name that never gets other content.
 * The pointer names each format's newest release. Content that hashes the same as the release the
 * pointer already names makes no new release.
 */

import { createHash } from "node:crypto";
import type { Latest, LatestFile } from "../formats/latest.v1.ts";
import { byCodeUnit } from "./order.ts";

export type FormatName = LatestFile["format"];

/** One format's content as a run built it. */
export interface Built {
  format: FormatName;
  formatVersion: number;
  /** The file's exact text. */
  text: string;
  /** How many entries it lists; what the pointer records and the fewer-entries guard compares. */
  entries: number;
}

/** A built file that needs a new release, with the pointer entry naming it. */
export interface Fresh extends Built {
  entry: LatestFile;
}

/** A file's text: deterministic, since it depends only on the value (no timestamps, no key reordering). */
export function fileText(file: unknown): string {
  return JSON.stringify(file);
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** `20261110T0300Z-1a2b3c4d`: the UTC minute the release was made and the first 8 hex digits of its SHA-256. */
export function releaseName(now: Date, sha256: string): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").slice(0, 13);
  return `${stamp}Z-${sha256.slice(0, 8)}`;
}

export function releasePath(format: FormatName, formatVersion: number, release: string): string {
  return `data/${format}/v${formatVersion}/${release}.json`;
}

const sameFormat = (a: { format: string; formatVersion: number }, b: { format: string; formatVersion: number }): boolean => a.format === b.format && a.formatVersion === b.formatVersion;

/**
 * The pointer after this run, the built files that need a new release (`fresh`), and every built
 * file with the pointer entry that names it, new or kept (`named`). A format whose content
 * hashes as the previous pointer's release keeps that entry; an entry of the previous pointer for a
 * format and version this run did not build is kept too, so an older version stays named while it
 * is still published.
 */
export function nextPointer(previous: Latest | null, built: readonly Built[], now: Date): { pointer: Latest; fresh: Fresh[]; named: Fresh[] } {
  const fresh: Fresh[] = [];
  const named: Fresh[] = [];
  const files: LatestFile[] = (previous?.files ?? []).filter((old) => !built.some((b) => sameFormat(b, old)));
  for (const b of built) {
    const sha256 = sha256Hex(b.text);
    const old = previous?.files.find((f) => sameFormat(f, b));
    if (old?.sha256 === sha256) {
      files.push(old);
      named.push({ ...b, entry: old });
      continue;
    }
    const release = releaseName(now, sha256);
    const entry: LatestFile = { format: b.format, formatVersion: b.formatVersion, release, path: releasePath(b.format, b.formatVersion, release), sha256, entries: b.entries };
    files.push(entry);
    fresh.push({ ...b, entry });
    named.push({ ...b, entry });
  }
  files.sort((a, b) => byCodeUnit(a.format, b.format) || a.formatVersion - b.formatVersion);
  return { pointer: { pointerVersion: 1, files }, fresh, named };
}

/** The pointer's text: indented, since a person opens this file; deterministic like every other. */
export function pointerText(pointer: Latest): string {
  return `${JSON.stringify(pointer, null, 2)}\n`;
}

/** One line per format that would list fewer entries than the release the previous pointer names; empty when none does. */
export function fewerEntries(previous: Latest | null, built: readonly Built[]): string[] {
  const out: string[] = [];
  for (const b of built) {
    const old = previous?.files.find((f) => sameFormat(f, b));
    if (old !== undefined && b.entries < old.entries) out.push(`${b.format} v${b.formatVersion} would list ${b.entries} entries, fewer than the ${old.entries} of ${old.release}`);
  }
  return out;
}
