import { describe, expect, test } from "bun:test";
import type { RawCharacter } from "../tables.ts";
import { buildIdols } from "./build.ts";

const CHARACTERS: RawCharacter[] = [
  { id: "ttmr", lastName: "月村", firstName: "手毬", isPlayable: true, order: 20 },
  { id: "nasr", lastName: "根緒", firstName: "亜紗里", isPlayable: false, order: 9999 },
  { id: "hski", lastName: "花海", firstName: "咲季", isPlayable: true, order: 10 },
];

describe("buildIdols", () => {
  test("lists the playable characters in the game's order, with their full names, and no one else", () => {
    expect(buildIdols(CHARACTERS)).toEqual([
      { id: "hski", name: "花海咲季" },
      { id: "ttmr", name: "月村手毬" },
    ]);
  });

  test("stops when two playable idols share an order", () => {
    expect(() => buildIdols(CHARACTERS.map((c) => ({ ...c, order: 10 })))).toThrow(/hski and ttmr share order 10|ttmr and hski share order 10/);
  });

  test("gives an empty list for no playable character, which the format then refuses", () => {
    expect(buildIdols(CHARACTERS.filter((c) => !c.isPlayable))).toEqual([]);
  });
});
