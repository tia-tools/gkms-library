/** The two ways the commands write a file under the output directory. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Writes `text` at `path` unless the file already holds exactly it; true when it wrote. For the pointer and the format files. */
export function writeIfDifferent(path: string, text: string): boolean {
  if (existsSync(path) && readFileSync(path, "utf8") === text) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return true;
}

/**
 * Writes a release: a name never gets other content (docs/adr/0004). A file already there with the
 * same text is left alone; one with another text stops the run, since a release's name holds only
 * the minute and 8 digits of its hash and two contents could, however unlikely, share one.
 */
export function writeRelease(path: string, text: string): void {
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== text) throw new Error(`${path} already exists with other content; a release is never overwritten`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}
