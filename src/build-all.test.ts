import { describe, expect, test } from "bun:test";
import { parse as parseSupportCards } from "../formats/support-cards.v1.ts";
import { buildAll, type Sources } from "./build-all.ts";

const NOW = 1_800_000_000_000;

/** The smallest set of tables every builder accepts: one support card of each rarity, one skill card, one item, one idol. */
function sources(): Sources {
  const rank = (i: number): string => (i === 0 ? "SupportCardLevelLimitRank_Unknown" : `SupportCardLevelLimitRank__${i}`);
  const supportCard = (n: number, rarity: string, viewStartTime = "0") => ({ id: `s_card-${n}-0001`, name: `card ${n}`, type: "SupportCardType_Vocal", rarity, planType: "ProducePlanType_Common", assetId: `csprt-${n}-0001`, supportCardLevelLimitId: `lim-${n}`, viewStartTime });
  return {
    tables: {
      cards: [supportCard(1, "SupportCardRarity_R"), supportCard(2, "SupportCardRarity_Sr"), supportCard(3, "SupportCardRarity_Ssr")],
      skillLevels: [],
      skills: [],
      effects: [],
      triggers: [],
      levelLimits: [1, 2, 3].flatMap((n) => [10, 20, 30, 40, 50].map((levelLimit, i) => ({ id: `lim-${n}`, rank: rank(i), levelLimit }))),
      eventCards: [],
      eventDetails: [],
      items: [],
      itemEffects: [],
    },
    skillCardTables: {
      cards: [{ id: "p_card-01-act-1_002", upgradeCount: 0, name: "カード", assetId: "img_general_skillcard_act-1_002", isCharacterAsset: false, rarity: "ProduceCardRarity_R", planType: "ProducePlanType_Plan1", category: "ProduceCardCategory_ActiveSkill", searchTag: "", originIdolCardId: "", originSupportCardId: "", produceCardCustomizeIds: [], maxCustomizeCount: 0, viewStartTime: "0", order: "2100" }],
      customizes: [],
      growEffects: [],
      growEffectDescriptions: [],
      memoryAbilities: [],
      guideCategories: [],
      characters: [{ id: "hski", lastName: "花海", firstName: "咲季", isPlayable: true, order: 10 }],
    },
    itemFacts: [{ id: "pitem_01-3-001", name: "アイテム", assetId: "img_general_pitem_3-001", rarity: "ProduceItemRarity_Sr", planType: "ProducePlanType_Common", fireLimit: 0, originSupportCardId: "", originIdolCardId: "", viewStartTime: "0" }],
  };
}

describe("buildAll", () => {
  test("builds the four formats, each with its entry count and a line saying what it lists of how many rows", () => {
    const all = buildAll(sources(), NOW);
    expect(all.built.map((b) => `${b.format} v${b.formatVersion}: ${b.entries}`)).toEqual(["idols v1: 1", "items v1: 1", "skill-cards v1: 1", "support-cards v1: 3"]);
    expect(all.lines).toEqual(["idols v1: 1 idols of 1 rows", "items v1: 1 items of 1 rows", "skill-cards v1: 1 cards (1 ids) of 1 rows, 0 abilities of 0 rows", "support-cards v1: 3 cards of 3 rows, 0 unread"]);
    expect(all.unread).toEqual([]);
  });

  test("gives the same text for the same tables, whatever the time, as long as nothing is released in between", () => {
    expect(buildAll(sources(), NOW + 1_000_000).built).toEqual(buildAll(sources(), NOW).built);
  });

  test("leaves out a support card that is not released yet", () => {
    const s = sources();
    s.tables.cards.push({ ...s.tables.cards[2], id: "s_card-3-0002", name: "later", type: "SupportCardType_Vocal", rarity: "SupportCardRarity_Ssr", planType: "ProducePlanType_Common", assetId: "csprt-3-0002", supportCardLevelLimitId: "lim-3", viewStartTime: String(NOW + 1) });
    const all = buildAll(s, NOW);
    const text = all.built.find((b) => b.format === "support-cards")?.text ?? "";
    expect(parseSupportCards(JSON.parse(text)).cards.map((c) => c.id)).toEqual(["s_card-1-0001", "s_card-2-0001", "s_card-3-0001"]);
    expect(all.lines[3]).toBe("support-cards v1: 3 cards of 4 rows, 0 unread");
    expect(buildAll(s, NOW + 1).built.find((b) => b.format === "support-cards")?.entries).toBe(4);
  });

  test("stops before returning anything when a file fails its format: no playable idol, no item", () => {
    const noIdol = sources();
    noIdol.skillCardTables.characters = [];
    expect(() => buildAll(noIdol, NOW)).toThrow("idols v1: idols: the list is empty");
    const noItem = sources();
    noItem.itemFacts = [];
    expect(() => buildAll(noItem, NOW)).toThrow("items v1: items: the list is empty");
  });
});
