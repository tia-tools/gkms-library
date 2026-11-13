import { describe, expect, test } from "bun:test";
import type { Latest } from "../formats/latest.v1.ts";
import { IMMUTABLE, planPublication, POINTER_CACHE_CONTROL, publicationKeys } from "./publish-plan.ts";
import { nextPointer, pointerText } from "./release.ts";

const NOW = new Date("2026-11-10T03:00:00Z");
const pointer: Latest = nextPointer(null, [{ format: "idols", formatVersion: 1, text: "IDOLS", entries: 13 }, { format: "items", formatVersion: 1, text: "ITEMS", entries: 1104 }], NOW).pointer;
const [idolsPath, itemsPath] = pointer.files.map((f) => f.path);
const FORMAT_FILES = ["items.v1.ts", "idols.v1.ts"];
const LOCAL: Record<string, string> = { "formats/idols.v1.ts": "schema idols", "formats/items.v1.ts": "schema items", [idolsPath ?? ""]: "IDOLS", [itemsPath ?? ""]: "ITEMS", "data/latest.v1.json": pointerText(pointer) };
const local = (key: string): string => LOCAL[key] ?? "";

/** What the address holds: nothing, unless `held` says otherwise. */
function remote(held: Record<string, string | null> = {}): Map<string, string | null> {
  return new Map(Object.keys(LOCAL).map((key) => [key, held[key] ?? null]));
}
const keys = (held?: Record<string, string | null>): string[] => planPublication({ pointer, formatFiles: FORMAT_FILES, local, remote: remote(held) }).map((u) => u.key);

describe("planPublication", () => {
  test("uploads the format files, then the releases, then the pointer last", () => {
    expect(publicationKeys(pointer, FORMAT_FILES)).toEqual(["formats/idols.v1.ts", "formats/items.v1.ts", idolsPath ?? "", itemsPath ?? "", "data/latest.v1.json"]);
    expect(keys()).toEqual(publicationKeys(pointer, FORMAT_FILES));
  });

  test("gives each kind of file its content type and how long it may be kept", () => {
    const uploads = planPublication({ pointer, formatFiles: FORMAT_FILES, local, remote: remote() });
    expect(uploads[0]).toEqual({ key: "formats/idols.v1.ts", contentType: "text/plain; charset=utf-8", cacheControl: IMMUTABLE });
    expect(uploads[2]).toEqual({ key: idolsPath ?? "", contentType: "application/json", cacheControl: IMMUTABLE });
    expect(uploads[4]).toEqual({ key: "data/latest.v1.json", contentType: "application/json", cacheControl: POINTER_CACHE_CONTROL });
    expect(IMMUTABLE).toBe("public, max-age=31536000, immutable");
    expect(POINTER_CACHE_CONTROL).toBe("public, max-age=300");
  });

  test("skips what the address already holds with the same text; nothing to do when all of it is there", () => {
    expect(keys({ "formats/idols.v1.ts": "schema idols", [idolsPath ?? ""]: "IDOLS" })).toEqual(["formats/items.v1.ts", itemsPath ?? "", "data/latest.v1.json"]);
    expect(keys(LOCAL)).toEqual([]);
  });

  test("replaces the pointer when the address holds another one", () => {
    expect(keys({ ...LOCAL, "data/latest.v1.json": "an older pointer" })).toEqual(["data/latest.v1.json"]);
  });

  test("never replaces a published format file or release: other text under the same name stops it before any upload", () => {
    expect(() => keys({ "formats/idols.v1.ts": "schema idols, changed" })).toThrow("formats/idols.v1.ts is already published with other content; a published file is never replaced");
    expect(() => keys({ [itemsPath ?? ""]: "OTHER" })).toThrow(`${itemsPath} is already published with other content`);
  });

  test("stops when the address was not asked about a key, instead of taking silence for absence", () => {
    const partial = remote();
    partial.delete("formats/items.v1.ts");
    expect(() => planPublication({ pointer, formatFiles: FORMAT_FILES, local, remote: partial })).toThrow("formats/items.v1.ts: the address was not asked about it");
  });
});
