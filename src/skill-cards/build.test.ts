import { describe, expect, test } from "bun:test";
import type { MemoryAbility, SkillCard } from "../../formats/skill-cards.v1.ts";
import type { RawCardCustomize, RawProduceCard, RawProduceSkill, SkillCardTables } from "../tables.ts";
import { buildMemoryAbilities, buildSkillCards, stepLabel } from "./build.ts";

const NOW = 1_800_000_000_000;
const HIF = "produce_group-003";

function card(id: string, upgradeCount: number, over: Partial<RawProduceCard> = {}): RawProduceCard {
  return {
    id,
    upgradeCount,
    name: `${id}${"+".repeat(upgradeCount)}`,
    assetId: `img_general_skillcard_${id.slice(10)}`,
    isCharacterAsset: false,
    rarity: "ProduceCardRarity_R",
    planType: "ProducePlanType_Plan1",
    category: "ProduceCardCategory_ActiveSkill",
    searchTag: "",
    originIdolCardId: "",
    originSupportCardId: "",
    produceCardCustomizeIds: [],
    maxCustomizeCount: 0,
    viewStartTime: "0",
    order: `2${id.slice(-3)}000`,
    ...over,
  };
}

function step(id: string, customizeCount: number, description: string, grow: string, overwrite = "ProduceCardGrowEffectType_Unknown"): RawCardCustomize {
  return { id, customizeCount, description, overwriteProduceCardGrowEffectType: overwrite, produceCardGrowEffectIds: [grow] };
}

function skill(id: string, effect: string): RawProduceSkill {
  return { id, level: 1, activationCount: 1, produceEffectId1: effect, produceTriggerId1: "p_trigger-start_audition-for_hif_memory", produceEffectId2: "", produceTriggerId2: "", produceEffectId3: "", produceTriggerId3: "" };
}

const hifEffect = (cardId: string): string => `p_effect-exam_status_enchant-enchant-p_ef-hif_memory-${cardId}-enc02`;

/**
 * Two plan cards at several levels, a free card, starter cards, and one card of each kind an app
 * may want to leave out (unique to a P-idol, from a support card's event, trouble, Legend), one
 * card released exactly now and one released a millisecond later; two customization kinds (one
 * labelled by its rows, one by its grow effect), two guide categories, three characters and four
 * memory abilities (two H.I.F. abilities of released cards, one of a card not released yet, one
 * of another scenario).
 */
function fixture(): { tables: SkillCardTables; skills: RawProduceSkill[] } {
  const withKinds = { produceCardCustomizeIds: ["k-desc", "k-generic"], maxCustomizeCount: 2 };
  const tables: SkillCardTables = {
    cards: [
      card("p_card-01-act-1_002", 0, { order: "21010020000002" }),
      card("p_card-01-act-1_002", 1, { order: "21010020000002", ...withKinds }),
      card("p_card-01-act-1_002", 2, { order: "21010020000002", ...withKinds }),
      card("p_card-02-men-2_001", 0, { order: "21010020000001", rarity: "ProduceCardRarity_Sr", planType: "ProducePlanType_Plan2", category: "ProduceCardCategory_MentalSkill", isCharacterAsset: true }),
      card("p_card-02-men-2_001", 1, { order: "21010020000001", rarity: "ProduceCardRarity_Sr", planType: "ProducePlanType_Plan2", category: "ProduceCardCategory_MentalSkill", isCharacterAsset: true }),
      card("p_card-00-act-0_001", 0, { planType: "ProducePlanType_Common", rarity: "ProduceCardRarity_N", viewStartTime: String(NOW) }),
      card("p_card-00-men-0_003", 0, { searchTag: "starter", planType: "ProducePlanType_Common", rarity: "ProduceCardRarity_N" }),
      card("p_card-00-men-0_003", 1, { searchTag: "starter", planType: "ProducePlanType_Common", rarity: "ProduceCardRarity_N" }),
      card("p_card-00-act-0_002", 0, { searchTag: "starter", planType: "ProducePlanType_Common" }),
      card("p_card-01-ido-3_001", 0, { searchTag: "idol-unique", originIdolCardId: "i_card-hski-3-000" }),
      card("p_card-01-sup-3_001", 0, { originSupportCardId: "s_card-3-0001" }),
      card("p_card-00-acc-0_002", 0, { category: "ProduceCardCategory_Trouble", planType: "ProducePlanType_Common" }),
      card("p_card-01-act-100_003", 0, { rarity: "ProduceCardRarity_Legend" }),
      card("p_card-01-act-3_900", 0, { viewStartTime: String(NOW + 1) }),
    ],
    customizes: [
      step("k-desc", 2, "レッスン中1回\\nの制限削除", "g-lesson"),
      step("k-desc", 1, "好調追加", "g-effect", "ProduceCardGrowEffectType_ParameterBuffTurnAdd"),
      step("k-generic", 1, "", "g-lesson"),
    ],
    growEffects: [
      { id: "g-lesson", effectType: "ProduceCardGrowEffectType_LessonAdd" },
      { id: "g-effect", effectType: "ProduceCardGrowEffectType_EffectAdd" },
      { id: "g-count", effectType: "ProduceCardGrowEffectType_LessonCountAdd" },
    ],
    growEffectDescriptions: [
      { type: "ProduceCardGrowEffectType_LessonAdd", produceCardCustomizeDescription: "パラメータ+" },
      { type: "ProduceCardGrowEffectType_EffectAdd", produceCardCustomizeDescription: "効果追加" },
      { type: "ProduceCardGrowEffectType_ParameterBuffTurnAdd", produceCardCustomizeDescription: "好調+" },
      { type: "ProduceCardGrowEffectType_LessonCountAdd", produceCardCustomizeDescription: "パラメータ\\n上昇回数+" },
    ],
    memoryAbilities: [
      { id: "memory_ability-hif-b", skillId: "sk-hif-b", produceGroupIds: [HIF] },
      { id: "memory_ability-hif-a", skillId: "sk-hif-a", produceGroupIds: [HIF] },
      { id: "memory_ability-hif-future", skillId: "sk-hif-future", produceGroupIds: [HIF] },
      { id: "memory_ability-nia", skillId: "sk-nia", produceGroupIds: ["produce_group-002"] },
    ],
    guideCategories: [
      { label: "好調を増加するスキルカード", produceCardIds: ["p_card-01-act-1_002"] },
      { label: "その他のスキルカード", produceCardIds: ["p_card-02-men-2_001", "p_card-01-act-1_002"] },
      { label: "好調を増加するスキルカード", produceCardIds: ["p_card-01-act-1_002"] },
    ],
    characters: [
      { id: "ttmr", lastName: "月村", firstName: "手毬", isPlayable: true, order: 20 },
      { id: "nasr", lastName: "根緒", firstName: "亜紗里", isPlayable: false, order: 9999 },
      { id: "hski", lastName: "花海", firstName: "咲季", isPlayable: true, order: 10 },
    ],
  };
  const skills = [
    skill("sk-hif-a", hifEffect("p_card-01-act-1_002")),
    skill("sk-hif-b", hifEffect("p_card-02-men-2_001")),
    skill("sk-hif-future", hifEffect("p_card-01-act-3_900")),
    skill("sk-nia", "p_effect-something-else"),
  ];
  return { tables, skills };
}

function build(edit: (f: { tables: SkillCardTables; skills: RawProduceSkill[] }) => void = () => undefined): { cards: SkillCard[]; abilities: MemoryAbility[] } {
  const f = fixture();
  edit(f);
  return { cards: buildSkillCards(f.tables, NOW), abilities: buildMemoryAbilities(f.tables.memoryAbilities, f.tables.cards, f.skills, NOW) };
}
const find = (cards: readonly SkillCard[], id: string, upgrade = 0): SkillCard | undefined => cards.find((c) => c.id === id && c.upgrade === upgrade);

describe("the cards", () => {
  test("are every released row exactly once, at every upgrade level, and no row released later", () => {
    const { tables } = fixture();
    const released = tables.cards.filter((c) => c.id !== "p_card-01-act-3_900");
    const built = build().cards.map((c) => `${c.id}:${c.upgrade}`);
    expect(built.toSorted()).toEqual(released.map((c) => `${c.id}:${c.upgradeCount}`).toSorted());
    expect(built).toHaveLength(13);
    expect(built).toContain("p_card-01-act-1_002:2");
    expect(built).toContain("p_card-00-act-0_001:0"); // released exactly now
  });

  test("are listed in the game's order, lower upgrade levels first", () => {
    const orders = build().cards.map((c) => `${c.order}:${c.id}:${c.upgrade}`);
    expect(orders).toEqual(orders.toSorted());
  });

  test("keep a card's levels together when another card shares its order", () => {
    const shared = { order: "21010020000001" };
    const cards = build((f) => f.tables.cards.unshift(card("p_card-02-men-2_009", 1, shared), card("p_card-02-men-2_009", 0, shared))).cards;
    expect(cards.filter((c) => c.order === shared.order).map((c) => `${c.id}:${c.upgrade}`)).toEqual(["p_card-02-men-2_001:0", "p_card-02-men-2_001:1", "p_card-02-men-2_009:0", "p_card-02-men-2_009:1"]);
  });

  test("map plan, rarity, type and art, and keep the game's name and order", () => {
    expect(find(build().cards, "p_card-02-men-2_001", 1)).toEqual({
      id: "p_card-02-men-2_001",
      upgrade: 1,
      name: "p_card-02-men-2_001+",
      plan: "logic",
      rarity: "SR",
      type: "mental",
      order: "21010020000001",
      guideLabels: ["その他のスキルカード"],
      art: { asset: "img_general_skillcard_men-2_001", perIdol: true },
      customization: { limit: 0, kinds: [] },
      origin: { tag: "none", supportCard: null, idolCard: null },
    });
    expect(find(build().cards, "p_card-00-act-0_001")?.plan).toBe("free");
  });

  test("carry the facts an app filters by: the search tag, the origin cards, trouble and Legend", () => {
    const { cards } = build();
    expect(find(cards, "p_card-00-men-0_003")?.origin).toEqual({ tag: "starter", supportCard: null, idolCard: null });
    expect(find(cards, "p_card-01-ido-3_001")?.origin).toEqual({ tag: "idolUnique", supportCard: null, idolCard: "i_card-hski-3-000" });
    expect(find(cards, "p_card-01-sup-3_001")?.origin).toEqual({ tag: "none", supportCard: "s_card-3-0001", idolCard: null });
    expect(find(cards, "p_card-00-acc-0_002")?.type).toBe("trouble");
    expect(find(cards, "p_card-01-act-100_003")?.rarity).toBe("Legend");
  });

  test("give each card its guide labels in the order the categories are listed, without repeats", () => {
    expect(find(build().cards, "p_card-01-act-1_002")?.guideLabels).toEqual(["好調を増加するスキルカード", "その他のスキルカード"]);
  });

  test("give a + card its customization kinds, steps in order, each labelled", () => {
    expect(find(build().cards, "p_card-01-act-1_002", 1)?.customization).toEqual({
      limit: 2,
      kinds: [
        { id: "k-desc", steps: [{ step: 1, label: "好調追加" }, { step: 2, label: "レッスン中1回\nの制限削除" }] },
        { id: "k-generic", steps: [{ step: 1, label: "パラメータ+" }] },
      ],
    });
  });
});

describe("customization labels", () => {
  const { tables } = fixture();
  const sources = {
    growTypeById: new Map(tables.growEffects.map((g) => [g.id, g.effectType])),
    labelByGrowType: new Map(tables.growEffectDescriptions.map((d) => [d.type, d.produceCardCustomizeDescription])),
  };

  test("fall back to the grow effect's generic label, the game's \\n becoming a line break", () => {
    expect(stepLabel(step("k", 1, "", "g-count"), sources)).toBe("パラメータ\n上昇回数+");
  });

  test("stop when an overwrite type would label a step without description differently", () => {
    expect(() => stepLabel(step("k-x", 1, "", "g-effect", "ProduceCardGrowEffectType_ParameterBuffTurnAdd"), sources)).toThrow(/k-x step 1: no description, and its overwrite type/);
    expect(stepLabel(step("k-y", 1, "", "g-lesson", "ProduceCardGrowEffectType_LessonAdd"), sources)).toBe("パラメータ+");
  });

  test("stop when neither the step nor its grow effect gives a label, or the grow effect is missing", () => {
    expect(() => stepLabel(step("k-z", 1, "", "g-none"), sources)).toThrow(/k-z step 1: missing ProduceCardGrowEffect g-none/);
    const unlabelled = { ...sources, labelByGrowType: new Map<string, string>() };
    expect(() => stepLabel(step("k-z", 1, "", "g-lesson"), unlabelled)).toThrow(/k-z step 1: no description and no label/);
  });
});

describe("memory abilities", () => {
  test("are every ability by id with its groups; an H.I.F. one names its card, and one whose card is not released yet is left out", () => {
    expect(build().abilities).toEqual([
      { id: "memory_ability-hif-a", groups: [HIF], card: "p_card-01-act-1_002" },
      { id: "memory_ability-hif-b", groups: [HIF], card: "p_card-02-men-2_001" },
      { id: "memory_ability-nia", groups: ["produce_group-002"] },
    ]);
  });

  test("keep an ability of no scenario group, and never read the skill of an ability outside H.I.F.", () => {
    const { abilities } = build((f) => f.tables.memoryAbilities.push({ id: "ability-common", skillId: "sk-not-there", produceGroupIds: [] }));
    expect(abilities).toContainEqual({ id: "ability-common", groups: [] });
  });

  test("name an H.I.F. card of any kind, since no card is left out any more", () => {
    const { abilities } = build((f) => f.skills.splice(0, 1, skill("sk-hif-a", hifEffect("p_card-01-ido-3_001"))));
    expect(abilities).toContainEqual({ id: "memory_ability-hif-a", groups: [HIF], card: "p_card-01-ido-3_001" });
  });

  test("stop, naming the ability, when its effect id has another form or its skill is missing", () => {
    expect(() => build((f) => f.skills.splice(0, 1, skill("sk-hif-a", "p_effect-other")))).toThrow(/memory_ability-hif-a: its skill sk-hif-a/);
    expect(() => build((f) => f.skills.splice(0, 1))).toThrow(/memory_ability-hif-a: missing ProduceSkill/);
  });

  test("accept a skill with several levels naming one card, and stop when its levels name different cards", () => {
    const levelTwo = (cardId: string): RawProduceSkill => ({ ...skill("sk-hif-a", hifEffect(cardId)), level: 2 });
    expect(build((f) => f.skills.push(levelTwo("p_card-01-act-1_002"))).abilities).toContainEqual({ id: "memory_ability-hif-a", groups: [HIF], card: "p_card-01-act-1_002" });
    expect(() => build((f) => f.skills.push(levelTwo("p_card-02-men-2_001")))).toThrow(/memory_ability-hif-a: its skill's levels name different cards/);
  });

  test("stop, naming the ability, when the card does not exist, or when an ability is listed twice", () => {
    expect(() => build((f) => f.skills.splice(0, 1, skill("sk-hif-a", hifEffect("p_card-09-act-9_999"))))).toThrow(/memory_ability-hif-a: names p_card-09-act-9_999, which is not a ProduceCard/);
    expect(() => build((f) => f.tables.memoryAbilities.push({ id: "memory_ability-nia", skillId: "sk-nia", produceGroupIds: [] }))).toThrow(/MemoryAbility memory_ability-nia appears twice/);
  });
});

describe("a dump that looks broken stops the run", () => {
  test("an unknown rarity, plan, category or search tag, naming the row, whatever kind of card it is", () => {
    expect(() => build((f) => f.tables.cards.push(card("p_card-01-act-1_050", 0, { rarity: "ProduceCardRarity_Ur" })))).toThrow(/p_card-01-act-1_050 level 0: unknown rarity "ProduceCardRarity_Ur"/);
    expect(() => build((f) => f.tables.cards.push(card("p_card-01-act-1_050", 0, { planType: "ProducePlanType_Plan4" })))).toThrow(/unknown plan/);
    expect(() => build((f) => f.tables.cards.push(card("p_card-01-act-1_050", 0, { category: "ProduceCardCategory_X" })))).toThrow(/unknown category/);
    expect(() => build((f) => f.tables.cards.push(card("p_card-01-act-1_050", 0, { searchTag: "event-limited" })))).toThrow(/unknown search tag "event-limited"/);
    expect(() => build((f) => f.tables.cards.push(card("p_card-01-ido-3_050", 0, { searchTag: "idol-unique", rarity: "ProduceCardRarity_Ur" })))).toThrow(/unknown rarity/);
  });

  test("a row listed twice", () => {
    expect(() => build((f) => f.tables.cards.push(card("p_card-01-act-1_002", 1)))).toThrow(/ProduceCard p_card-01-act-1_002 level 1 appears twice/);
  });

  test("a customization kind that resolves to nothing", () => {
    expect(() => build((f) => f.tables.cards.push(card("p_card-01-act-1_050", 1, { produceCardCustomizeIds: ["k-gone"] })))).toThrow(/p_card-01-act-1_050 level 1: missing ProduceCardCustomize k-gone/);
  });

  test("a release time that is neither \"0\" nor epoch milliseconds", () => {
    expect(() => build((f) => f.tables.cards.push(card("p_card-01-act-1_050", 0, { viewStartTime: "2026-10-31" })))).toThrow(/viewStartTime "2026-10-31"/);
  });
});
