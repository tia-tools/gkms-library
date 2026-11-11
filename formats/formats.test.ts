import { describe, expect, test } from "bun:test";
import { parse as parseIdols } from "./idols.v1.ts";
import { parse as parseItems } from "./items.v1.ts";
import { parse as parseLatest } from "./latest.v1.ts";
import { parse as parseSkillCards } from "./skill-cards.v1.ts";
import { parse as parseSupportCards } from "./support-cards.v1.ts";

/** The message `parse` throws for `data`, or "accepted". */
function refusal(parse: (data: unknown) => unknown, data: unknown): string {
  try {
    parse(data);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return "accepted";
}

describe("idols v1", () => {
  const good = { formatVersion: 1, idols: [{ id: "hski", name: "花海咲季" }, { id: "ttmr", name: "月村手毬" }, { id: "fktn", name: "藤田ことね" }] };

  test("accepts a list of idols and returns it", () => {
    expect<unknown>(parseIdols(good)).toEqual(good);
  });

  test("names the place of a bad value", () => {
    expect(refusal(parseIdols, { ...good, idols: [good.idols[0], good.idols[1], { id: "fktn", name: 3 }] })).toBe("idols v1: idols.2.name: Invalid type: Expected string but received 3");
  });

  test("refuses an id listed twice, an empty list, a key it does not name, another version, an id of another shape", () => {
    expect(refusal(parseIdols, { ...good, idols: [good.idols[0], good.idols[1], { id: "hski", name: "another" }] })).toBe("idols v1: idols.2: this id appears earlier in the list");
    expect(refusal(parseIdols, { ...good, idols: [] })).toBe("idols v1: idols: the list is empty");
    expect(refusal(parseIdols, { ...good, extra: true })).toContain("idols v1: extra:");
    expect(refusal(parseIdols, { ...good, formatVersion: 2 })).toContain("idols v1: formatVersion:");
    expect(refusal(parseIdols, { ...good, idols: [{ id: "HSKI", name: "x" }] })).toContain("idols.0.id: an idol id is four lowercase letters or digits");
    expect(refusal(parseIdols, null)).toContain("idols v1: (file):");
  });
});

describe("items v1", () => {
  const item = { id: "pitem_01-3-001", name: "アイテム", assetId: "img_general_pitem_3-001", rarity: "SSR", plan: "free", originSupportCard: null, originIdolCard: "i_card-hski-3-000" };
  const good = { formatVersion: 1, items: [item, { ...item, id: "pitem_01-3-002", cap: 2 }] };

  test("accepts items with and without a cap", () => {
    expect<unknown>(parseItems(good)).toEqual(good);
  });

  test("refuses an id listed twice, an empty list, an unknown rarity, a cap of 0, a missing origin", () => {
    expect(refusal(parseItems, { ...good, items: [item, item] })).toBe("items v1: items.1: this id appears earlier in the list");
    expect(refusal(parseItems, { ...good, items: [] })).toBe("items v1: items: the list is empty");
    expect(refusal(parseItems, { ...good, items: [{ ...item, rarity: "UR" }] })).toContain("items v1: items.0.rarity:");
    expect(refusal(parseItems, { ...good, items: [{ ...item, cap: 0 }] })).toContain("items v1: items.0.cap:");
    const { originSupportCard: _dropped, ...withoutOrigin } = item;
    expect(refusal(parseItems, { ...good, items: [withoutOrigin] })).toContain("items v1: items.0.originSupportCard:");
  });
});

describe("skill-cards v1", () => {
  const card = {
    id: "p_card-01-act-1_002",
    upgrade: 0,
    name: "カード",
    plan: "sense",
    rarity: "R",
    type: "active",
    order: "21010020000002",
    guideLabels: ["好調を増加するスキルカード"],
    art: { asset: "img_general_skillcard_act-1_002", perIdol: false },
    customization: { limit: 0, kinds: [] },
    origin: { tag: "none", supportCard: null, idolCard: null },
  };
  const good = {
    formatVersion: 1,
    cards: [card, { ...card, upgrade: 1, customization: { limit: 2, kinds: [{ id: "k", steps: [{ step: 1, label: "好調+" }] }] } }],
    memoryAbilities: [{ id: "a", groups: ["produce_group-003"], card: "p_card-01-act-1_002" }, { id: "b", groups: [] }],
  };

  test("accepts cards at several levels and abilities with and without a card", () => {
    expect<unknown>(parseSkillCards(good)).toEqual(good);
  });

  test("refuses a card listed twice at one level, an ability listed twice, an unknown type or tag, an empty card list", () => {
    expect(refusal(parseSkillCards, { ...good, cards: [card, card] })).toBe("skill-cards v1: cards: a card id appears twice at one upgrade level");
    expect(refusal(parseSkillCards, { ...good, memoryAbilities: [{ id: "a", groups: [] }, { id: "a", groups: [] }] })).toBe("skill-cards v1: memoryAbilities: an ability id appears twice");
    expect(refusal(parseSkillCards, { ...good, cards: [{ ...card, type: "support" }] })).toContain("skill-cards v1: cards.0.type:");
    expect(refusal(parseSkillCards, { ...good, cards: [{ ...card, origin: { ...card.origin, tag: "idol-unique" } }] })).toContain("skill-cards v1: cards.0.origin.tag:");
    expect(refusal(parseSkillCards, { ...good, cards: [] })).toBe("skill-cards v1: cards: the list is empty");
  });
});

describe("support-cards v1", () => {
  const card = {
    id: "s_card-3-0001",
    name: "カード",
    assetId: "csprt-3-0001",
    type: "vocal",
    rarity: "ssr",
    plan: "sense",
    breakpoints: [
      {
        minLevel: 1,
        effects: [
          { stat: "vocal", value: 30, kind: "item", itemId: "pitem-x", itemName: "アイテム", cap: 2, trigger: { occasion: "StartShop", conditions: [{ kind: "vocal", min: 400, max: 0 }], scenario: "hif_memory" } },
          { stat: "vocal", value: 85, kind: "skill", trigger: { occasion: "EndLesson", filters: [{ family: "lessonStat", member: "vocal" }] }, bonus: true },
          { stat: "dance", value: 20, kind: "event" },
        ],
        eventBonusPermil: 500,
      },
    ],
    items: [{ itemId: "pitem-x", itemName: "アイテム", assetId: "img_general_pitem_9-999", cap: 2, drinks: { perFire: 1, trigger: { occasion: "StartShop" } } }],
    spRate: true,
  };
  const good = { formatVersion: 1, levelLimits: { r: [20, 25, 30, 35, 40], sr: [30, 35, 40, 45, 50], ssr: [40, 45, 50, 55, 60] }, cards: [card], unread: [{ cardId: "s_card-3-0001", cardName: "カード", reason: "s_card-3-0001 sk: trigger x has a piece of unknown kind: y" }] };

  test("accepts a card with every kind of effect, a granted item, the SP-rate mark, and an unread effect", () => {
    expect<unknown>(parseSupportCards(good)).toEqual(good);
  });

  test("names the place of a bad value deep in a card", () => {
    const bad = structuredClone(good);
    Object.assign(bad.cards[0]?.breakpoints[0]?.effects[1]?.trigger?.filters?.[0] ?? {}, { family: "weather" });
    expect(refusal(parseSupportCards, bad)).toContain("support-cards v1: cards.0.breakpoints.0.effects.1.trigger.filters.0.family:");
  });

  test("refuses a card listed twice, an empty list, a card without a breakpoint, four level limits, spRate false", () => {
    expect(refusal(parseSupportCards, { ...good, cards: [card, card] })).toBe("support-cards v1: cards: a card id appears twice");
    expect(refusal(parseSupportCards, { ...good, cards: [] })).toBe("support-cards v1: cards: the list is empty");
    expect(refusal(parseSupportCards, { ...good, cards: [{ ...card, breakpoints: [] }] })).toBe("support-cards v1: cards.0.breakpoints: a card has no breakpoint");
    expect(refusal(parseSupportCards, { ...good, levelLimits: { ...good.levelLimits, r: [20, 25, 30, 35] } })).toContain("support-cards v1: levelLimits.r");
    expect(refusal(parseSupportCards, { ...good, cards: [{ ...card, spRate: false }] })).toContain("support-cards v1: cards.0.spRate:");
  });
});

describe("latest v1", () => {
  const sha256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  const file = { format: "idols", formatVersion: 1, release: "20261110T0300Z-ba7816bf", path: "data/idols/v1/20261110T0300Z-ba7816bf.json", sha256, entries: 13 };
  const good = { pointerVersion: 1, files: [file, { ...file, format: "items", path: "data/items/v1/20261110T0300Z-ba7816bf.json" }] };

  test("accepts a pointer naming one release per format", () => {
    expect<unknown>(parseLatest(good)).toEqual(good);
  });

  test("refuses a path that is not the release's, a name that does not carry the hash, a format twice, an empty pointer", () => {
    expect(refusal(parseLatest, { ...good, files: [{ ...file, path: "data/items/v1/20261110T0300Z-ba7816bf.json" }] })).toBe("latest v1: files.0: the path is not data/<format>/v<version>/<release>.json");
    expect(refusal(parseLatest, { ...good, files: [{ ...file, release: "20261110T0300Z-00000000", path: "data/idols/v1/20261110T0300Z-00000000.json" }] })).toBe("latest v1: files.0: the release's name does not end with the first 8 digits of its SHA-256");
    expect(refusal(parseLatest, { ...good, files: [file, file] })).toBe("latest v1: files.1: this format and version appear earlier in the list");
    expect(refusal(parseLatest, { ...good, files: [] })).toBe("latest v1: files: the pointer names no release");
    expect(refusal(parseLatest, { ...good, files: [{ ...file, format: "scores" }] })).toContain("latest v1: files.0.format:");
    expect(refusal(parseLatest, { ...good, files: [{ ...file, entries: 0 }] })).toContain("latest v1: files.0.entries:");
  });
});
