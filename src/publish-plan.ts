/**
 * What a publication uploads, in which order, and what it refuses. Pure: what the address already
 * holds is passed in (docs/plans/EXECPLAN_LIBRARY_ALONE.md, L18, L22).
 *
 * The order is the format files, then the releases, then the pointer: the pointer is the one thing
 * an app follows, so everything it names is stored before it moves. A format file or a release
 * already at the address is never replaced: with the same text it is skipped, with another the
 * publication stops (docs/adr/0004, docs/adr/0005).
 */

import type { Latest } from "../formats/latest.v1.ts";
import { POINTER_PATH } from "./site.ts";

export const IMMUTABLE = "public, max-age=31536000, immutable";
/** The pointer is the one object rewritten under its name: a browser may keep it five minutes. */
export const POINTER_CACHE_CONTROL = "public, max-age=300";

export interface Upload {
  /** The key in the public bucket, which is also the path under the output directory. */
  key: string;
  contentType: string;
  cacheControl: string;
}

export interface PublishInput {
  pointer: Latest;
  /** The format files' names, as in formats/: `idols.v1.ts`. */
  formatFiles: readonly string[];
  /** The text of a key under the output directory. */
  local(key: string): string;
  /** The text of a key at the address, or null when it is not there. */
  remote: ReadonlyMap<string, string | null>;
}

/** Every key a publication may write, in order: format files, releases, the pointer. */
export function publicationKeys(pointer: Latest, formatFiles: readonly string[]): string[] {
  return [...[...formatFiles].sort().map((name) => `formats/${name}`), ...pointer.files.map((f) => f.path), POINTER_PATH];
}

function uploadFor(key: string): Upload {
  if (key === POINTER_PATH) return { key, contentType: "application/json", cacheControl: POINTER_CACHE_CONTROL };
  // A .ts file would otherwise be served as a video stream, which is what that extension means to a browser.
  return { key, contentType: key.endsWith(".ts") ? "text/plain; charset=utf-8" : "application/json", cacheControl: IMMUTABLE };
}

/**
 * The uploads to make, in order. Throws, before any is made, when the address holds a format file
 * or a release under the same name with other text.
 */
export function planPublication(input: PublishInput): Upload[] {
  const uploads: Upload[] = [];
  for (const key of publicationKeys(input.pointer, input.formatFiles)) {
    const remote = input.remote.get(key);
    if (remote === undefined) throw new Error(`${key}: the address was not asked about it`);
    const local = input.local(key);
    if (remote === local) continue;
    if (remote !== null && key !== POINTER_PATH) throw new Error(`${key} is already published with other content; a published file is never replaced`);
    uploads.push(uploadFor(key));
  }
  return uploads;
}
