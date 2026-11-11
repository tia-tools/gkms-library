import { describe, expect, test } from "bun:test";
import { parse as parseLatest, type Latest } from "../formats/latest.v1.ts";
import { type Built, fewerEntries, fileText, nextPointer, pointerText, releaseName, releasePath, sha256Hex } from "./release.ts";

const NOW = new Date("2026-11-10T03:00:59.999Z");
const idols = (text: string, entries = 13): Built => ({ format: "idols", formatVersion: 1, text, entries });
const items = (text: string, entries = 1075): Built => ({ format: "items", formatVersion: 1, text, entries });

describe("a release's name and path", () => {
  test("the name is the UTC minute and the first 8 hex digits of the SHA-256", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(releaseName(NOW, sha256Hex("abc"))).toBe("20261110T0300Z-ba7816bf");
    expect(releaseName(new Date("2027-01-02T15:04:00+09:00"), sha256Hex("abc"))).toBe("20270102T0604Z-ba7816bf");
  });

  test("the path is data/<format>/v<version>/<release>.json", () => {
    expect(releasePath("support-cards", 1, "20261110T0300Z-ba7816bf")).toBe("data/support-cards/v1/20261110T0300Z-ba7816bf.json");
  });

  test("a file's text does not depend on anything but the value", () => {
    expect(fileText({ formatVersion: 1, idols: [{ id: "hski", name: "花海咲季" }] })).toBe('{"formatVersion":1,"idols":[{"id":"hski","name":"花海咲季"}]}');
  });
});

describe("nextPointer", () => {
  test("with no previous pointer every built file is a new release, and the pointer the format accepts names them, sorted", () => {
    const { pointer, fresh } = nextPointer(null, [items("B"), idols("A")], NOW);
    expect(fresh.map((f) => f.format)).toEqual(["items", "idols"]);
    expect(pointer.files.map((f) => f.format)).toEqual(["idols", "items"]);
    expect(pointer.files[0]).toEqual({ format: "idols", formatVersion: 1, release: `20261110T0300Z-${sha256Hex("A").slice(0, 8)}`, path: `data/idols/v1/20261110T0300Z-${sha256Hex("A").slice(0, 8)}.json`, sha256: sha256Hex("A"), entries: 13 });
    expect(parseLatest(JSON.parse(pointerText(pointer)))).toEqual(pointer);
  });

  test("content that hashes as the previous release makes no new release and keeps the old entry, name and time included", () => {
    const first = nextPointer(null, [idols("A"), items("B")], NOW).pointer;
    const later = new Date("2026-11-11T03:00:00Z");
    const { pointer, fresh } = nextPointer(first, [idols("A"), items("B")], later);
    expect(fresh).toEqual([]);
    expect(pointerText(pointer)).toBe(pointerText(first));
  });

  test("only the format whose content changed gets a new release", () => {
    const first = nextPointer(null, [idols("A"), items("B")], NOW).pointer;
    const { pointer, fresh } = nextPointer(first, [idols("A"), items("B2", 1076)], new Date("2026-11-11T03:00:00Z"));
    expect(fresh.map((f) => f.entry.path)).toEqual([`data/items/v1/20261111T0300Z-${sha256Hex("B2").slice(0, 8)}.json`]);
    expect(pointer.files.find((f) => f.format === "idols")).toEqual(first.files.find((f) => f.format === "idols"));
    expect(pointer.files.find((f) => f.format === "items")?.entries).toBe(1076);
  });

  test("an entry for a format or version this run did not build stays in the pointer", () => {
    const first = nextPointer(null, [idols("A"), items("B")], NOW).pointer;
    const { pointer } = nextPointer(first, [{ ...idols("A2"), formatVersion: 2 }], NOW);
    expect(pointer.files.map((f) => `${f.format} v${f.formatVersion}`)).toEqual(["idols v1", "idols v2", "items v1"]);
  });
});

describe("fewerEntries", () => {
  const previous: Latest = nextPointer(null, [idols("A", 13), items("B", 1075)], NOW).pointer;

  test("names a format that would list fewer entries than its previous release", () => {
    expect(fewerEntries(previous, [idols("A2", 12), items("B", 1075)])).toEqual([`idols v1 would list 12 entries, fewer than the 13 of 20261110T0300Z-${sha256Hex("A").slice(0, 8)}`]);
  });

  test("says nothing for the same or more entries, a format with no previous release, or no previous pointer", () => {
    expect(fewerEntries(previous, [idols("A2", 13), items("B2", 1080)])).toEqual([]);
    expect(fewerEntries(previous, [{ format: "skill-cards", formatVersion: 1, text: "C", entries: 1 }])).toEqual([]);
    expect(fewerEntries(null, [idols("A", 1)])).toEqual([]);
  });
});
