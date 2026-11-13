import { describe, expect, test } from "bun:test";
import type { SkillCard } from "../../formats/skill-cards.v1.ts";
import type { Card } from "../../formats/support-cards.v1.ts";
import { canonical, compare, type Difference, missingImages, type Ours, theirImagePaths, type Theirs } from "./compare.ts";

const HIF = "produce_group-003";
const LIMITS = { r: [20, 25, 30, 35, 40], sr: [30, 35, 40, 45, 50], ssr: [40, 45, 50, 55, 60] } satisfies Ours["supportCards"]["levelLimits"];

function supportCard(id: string, scenario?: string): Card {
  const trigger = scenario === undefined ? { occasion: "EndLesson" } : { occasion: "EndLesson", scenario };
  return {
    id,
    name: `card ${id}`,
    assetId: id.replace("s_card", "csprt"),
    type: "vocal",
    rarity: "ssr",
    plan: "sense",
    breakpoints: [{ minLevel: 1, effects: [{ stat: "vocal", value: 10, kind: "skill", trigger }], eventBonusPermil: 0 }],
    items: [{ itemId: "pitem-x", itemName: "アイテム", assetId: "img_general_pitem_9-999", drinks: { perFire: 1, trigger } }],
  };
}

function skillCard(id: string, upgrade = 0): SkillCard {
  return {
    id,
    upgrade,
    name: `${id}${"+".repeat(upgrade)}`,
    plan: "sense",
    rarity: "R",
    type: "active",
    order: "2100",
    guideLabels: [],
    art: { asset: `img_general_skillcard_${id.slice(-9)}`, perIdol: false },
    customization: { limit: 0, kinds: [] },
    origin: { tag: "none", supportCard: null, idolCard: null },
  };
}
const withoutOrigin = ({ origin: _origin, ...rest }: SkillCard): Theirs["skillCards"]["cards"][number] => rest;

/** Two sites that publish the same things: one support card, one skill card at two levels, one H.I.F. ability. */
function sites(): { theirs: Theirs; ours: Ours } {
  const idols = (): Ours["idols"]["idols"] => [{ id: "hski", name: "花海咲季" }, { id: "ttmr", name: "月村手毬" }];
  const skill = [skillCard("p_card-01-act-1_002"), skillCard("p_card-01-act-1_002", 1)];
  return {
    theirs: {
      cards: { formatVersion: 2, levelLimits: LIMITS, cards: [supportCard("s_card-3-0001")], held: [] },
      skillCards: { formatVersion: 1, idols: idols(), cards: skill.map(withoutOrigin), hifAbilities: [{ id: "ability-a", card: "p_card-01-act-1_002" }] },
    },
    ours: {
      supportCards: { formatVersion: 1, levelLimits: LIMITS, cards: [supportCard("s_card-3-0001")], unread: [] },
      skillCards: { formatVersion: 1, cards: skill.map((c) => ({ ...c })), memoryAbilities: [{ id: "ability-a", groups: [HIF], card: "p_card-01-act-1_002" }] },
      idols: { formatVersion: 1, idols: idols() },
      items: { formatVersion: 1, items: [{ id: "pitem-x", name: "アイテム", assetId: "img_general_pitem_9-999", rarity: "SR", plan: "free", originSupportCard: "s_card-3-0001", originIdolCard: null }] },
    },
  };
}

function run(edit: (s: { theirs: Theirs; ours: Ours }) => void = () => undefined): Difference[] {
  const s = sites();
  edit(s);
  return compare(s.theirs, s.ours);
}
const names = (differences: readonly Difference[], kind: Difference["kind"]): string[] => differences.filter((d) => d.kind === kind).map((d) => `${d.count} × ${d.name}`);
/** The fixture card, or a thrown error, so a test fails where the gap is. */
function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("missing from the fixture");
  return value;
}

describe("compare", () => {
  test("two sites publishing the same things have no difference at all", () => {
    expect(run()).toEqual([]);
  });

  test("the order keys were written in does not make two values differ", () => {
    expect(canonical({ b: 1, a: [{ d: 2, c: undefined }] })).toBe(canonical({ a: [{ d: 2 }], b: 1 }));
    expect(canonical({ a: 1 })).not.toBe(canonical({ a: 2 }));
  });

  test("what only the library has is expected, and counted", () => {
    const differences = run((s) => {
      s.ours.supportCards.cards.push(supportCard("s_card-3-0002"));
      s.ours.skillCards.cards.push(skillCard("p_card-01-ido-3_001"), skillCard("p_card-01-act-1_002", 2));
      s.ours.skillCards.memoryAbilities.push({ id: "ability-nia", groups: ["produce_group-002"] });
    });
    expect(names(differences, "unexpected")).toEqual([]);
    expect(names(differences, "expected")).toEqual([
      "1 × support cards only here (gakumas-supportcards is an update behind)",
      "2 × skill cards only here (that site publishes one app's pool)",
      "1 × memory abilities only here (that site publishes H.I.F.'s, of its pool)",
    ]);
  });

  test("a support card they have and the library lacks, or one that differs, is unexpected and named", () => {
    const missing = run((s) => s.theirs.cards.cards.push(supportCard("s_card-3-0009")));
    expect(missing).toEqual([{ kind: "unexpected", name: "support cards missing here", count: 1, examples: ["s_card-3-0009 card s_card-3-0009"] }]);
    const differs = run((s) => (must(must(s.ours.supportCards.cards[0]).breakpoints[0]).eventBonusPermil = 500));
    expect(names(differs, "unexpected")).toEqual(["1 × support cards that differ"]);
    expect(names(run((s) => (s.ours.supportCards.levelLimits = { ...LIMITS, r: [1, 2, 3, 4, 5] })), "unexpected")).toEqual(["1 × level limits differ"]);
  });

  test("a scenario token is compared as that site writes it, on effects and on drink grants, and counted as expected", () => {
    const differences = run((s) => {
      s.theirs.cards.cards = [supportCard("s_card-3-0001", "hajime-legend")];
      s.ours.supportCards.cards = [supportCard("s_card-3-0001", "hajime_legend_ssr")];
    });
    expect(names(differences, "unexpected")).toEqual([]);
    expect(names(differences, "expected")).toEqual(["2 × scenario tokens that site writes as its own ids"]);
  });

  test("a token that maps to another scenario than theirs, or one the table does not know, is a card that differs", () => {
    const other = run((s) => {
      s.theirs.cards.cards = [supportCard("s_card-3-0001", "hif")];
      s.ours.supportCards.cards = [supportCard("s_card-3-0001", "hajime_legend")];
    });
    expect(names(other, "unexpected")).toEqual(["1 × support cards that differ"]);
    const unknownToken = run((s) => {
      s.theirs.cards.cards = [supportCard("s_card-3-0001", "hif")];
      s.ours.supportCards.cards = [supportCard("s_card-3-0001", "new_scenario")];
    });
    expect(names(unknownToken, "unexpected")).toEqual(["1 × support cards that differ"]);
  });

  test("their held list: an unread effect on both sides is no difference, a scoring reason is expected", () => {
    const reason = "s_card-3-0001 sk: trigger x has a piece of unknown kind: y";
    const differences = run((s) => {
      s.theirs.cards.held = [{ id: "s_card-3-0001", name: "card", reasons: [reason, "s_card-3-0001: no route profile number for occasions.NewPhase (hif/a)"] }];
      s.ours.supportCards.unread = [{ cardId: "s_card-3-0001", cardName: "card", reason }];
    });
    expect(names(differences, "unexpected")).toEqual([]);
    expect(names(differences, "expected")).toEqual(["1 × held there for a scoring reason (the library has no held list)"]);
  });

  test("their held list: a reason the library does not report, or an unread effect they do not hold, is unexpected", () => {
    const reason = "s_card-3-0001 sk: effect type ProduceEffectType_New is neither a stat nor audited as non-parameter";
    expect(names(run((s) => (s.theirs.cards.held = [{ id: "s_card-3-0001", name: "card", reasons: [reason] }])), "unexpected")).toEqual(["1 × held there for an effect that is not unread here"]);
    expect(names(run((s) => (s.ours.supportCards.unread = [{ cardId: "s_card-3-0001", cardName: "card", reason }])), "unexpected")).toEqual(["1 × unread here but not held there"]);
  });

  test("an unread effect of a card only the library has is not held against them", () => {
    const differences = run((s) => {
      s.ours.supportCards.cards.push(supportCard("s_card-3-0002"));
      s.ours.supportCards.unread = [{ cardId: "s_card-3-0002", cardName: "card", reason: "r" }];
    });
    expect(names(differences, "unexpected")).toEqual([]);
  });

  test("the idol list must be equal in ids, names and order", () => {
    expect(names(run((s) => s.ours.idols.idols.reverse()), "unexpected")).toEqual(["1 × the idol list differs"]);
    expect(names(run((s) => s.ours.idols.idols.pop()), "unexpected")).toEqual(["1 × the idol list differs"]);
  });

  test("a skill card of theirs must be here, equal on everything they publish; origin is the library's alone", () => {
    expect(names(run((s) => s.ours.skillCards.cards.pop()), "unexpected")).toEqual(["1 × skill cards missing here"]);
    expect(names(run((s) => (must(s.ours.skillCards.cards[1]).name = "another")), "unexpected")).toEqual(["1 × skill cards that differ"]);
    expect(run((s) => (must(s.ours.skillCards.cards[0]).origin = { tag: "starter", supportCard: null, idolCard: null }))).toEqual([]);
  });

  test("an H.I.F. ability of theirs must be here with the same card and the H.I.F. group", () => {
    const wrong = ["1 × H.I.F. abilities missing or different here"];
    expect(names(run((s) => (s.ours.skillCards.memoryAbilities = [])), "unexpected")).toEqual(wrong);
    expect(names(run((s) => (s.ours.skillCards.memoryAbilities = [{ id: "ability-a", groups: [HIF], card: "p_card-09" }])), "unexpected")).toEqual(wrong);
    expect(names(run((s) => (s.ours.skillCards.memoryAbilities = [{ id: "ability-a", groups: ["produce_group-001"], card: "p_card-01-act-1_002" }])), "unexpected")).toEqual(wrong);
  });

  test("every item a support card grants must be in the items file with the same name and icon", () => {
    const wrong = ["1 × granted items missing from the items file, or with another name or icon"];
    expect(names(run((s) => (s.ours.items.items = [])), "unexpected")).toEqual(wrong);
    expect(names(run((s) => (must(s.ours.items.items[0]).assetId = "img_general_pitem_0-000")), "unexpected")).toEqual(wrong);
  });

  test("a difference carries at most five examples and the full count", () => {
    const [d] = run((s) => {
      for (let i = 10; i < 17; i++) s.theirs.cards.cards.push(supportCard(`s_card-3-00${i}`));
    });
    expect(d?.count).toBe(7);
    expect(d?.examples).toHaveLength(5);
  });
});

describe("the images their data names", () => {
  test("are each card's art and each granted item's icon, once, under the names that site serves them by", () => {
    const { theirs } = sites();
    theirs.cards.cards.push(supportCard("s_card-3-0002"));
    expect(theirImagePaths(theirs.cards)).toEqual(["img/w192/img_general_csprt-3-0001_full.webp", "img/w192/img_general_csprt-3-0002_full.webp", "img/w48/img_general_pitem_9-999.webp"]);
  });

  test("one the library does not serve is unexpected; none missing is no difference", () => {
    expect(missingImages(["img/w48/img_general_pitem_9-999.webp"])).toEqual([{ kind: "unexpected", name: "images that site's data names and the library does not serve", count: 1, examples: ["img/w48/img_general_pitem_9-999.webp"] }]);
    expect(missingImages([])).toEqual([]);
  });
});
