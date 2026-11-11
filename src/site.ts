/**
 * Reads a published file from a site: the public address, or a local directory that mirrors the
 * public bucket (out/site). The only module the commands read published files through.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseLatest, type Latest } from "../formats/latest.v1.ts";

export const POINTER_PATH = "data/latest.v1.json";

function isAddress(site: string): boolean {
  return site.startsWith("https://") || site.startsWith("http://");
}

/**
 * The text of `path` at `site`, or null when it is not there. At an address, only 200 and 404 are
 * answers, and the request carries a query string of its own, because the address's cache remembers
 * a 404 for minutes after the file is uploaded (docs/adr/0003, addendum of 2026-11-10).
 */
export async function readSiteText(site: string, path: string, bust: string = String(Date.now())): Promise<string | null> {
  if (!isAddress(site)) {
    const file = join(site, path);
    return existsSync(file) ? readFileSync(file, "utf8") : null;
  }
  const res = await fetch(`${site.replace(/\/$/, "")}/${path}?run=${bust}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${site}/${path}: HTTP ${res.status}`);
  return res.text();
}

/** The site's pointer, checked against its format; null when the site has none yet. */
export async function readPointer(site: string): Promise<Latest | null> {
  const text = await readSiteText(site, POINTER_PATH);
  return text === null ? null : parseLatest(JSON.parse(text));
}
