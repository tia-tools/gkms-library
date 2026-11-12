/**
 * Format `skill-cards`, version 1: every released skill card of 学園アイドルマスター at every upgrade
 * level, and every memory ability, as facts an app can filter by. The file does not read a skill
 * card's effects.
 *
 * The orders the comments below name are how the library writes the file; `parse` checks shape and
 * uniqueness, not order.
 *
 * A format is the shape of a published file; this file is both its types and its check, and it never
 * changes once published: a change of shape is a new version number in a new file
 * (docs/adr/0005). An app copies this file verbatim and checks downloaded data with `parse`.
 * It imports nothing but Valibot (major version 1).
 */

import * as v from "valibot";

/**
 * One step of a customization kind: its `customizeCount` and its Japanese label, the step's own
 * description when the game gives one (好調追加), else the generic label of its grow effect
 * (好調+). A label may contain a line break where the game breaks it.
 */
export const CustomizationStep = v.strictObject({ step: v.pipe(v.number(), v.integer()), label: v.pipe(v.string(), v.minLength(1)) });

/** One customization kind of a card: a ProduceCardCustomize id and its steps, in step order. */
export const CustomizationKind = v.strictObject({ id: v.string(), steps: v.array(CustomizationStep) });

/** Where a card comes from, for an app that keeps only some cards. */
export const Origin = v.strictObject({
  /** The game's search tag: a starter card, a card unique to one P-idol, or neither. */
  tag: v.picklist(["none", "starter", "idolUnique"]),
  /** The support card whose event gives the card, or null. */
  supportCard: v.nullable(v.string()),
  /** The idol card the card belongs to, or null. */
  idolCard: v.nullable(v.string()),
});

/** One skill card at one upgrade level: a ProduceCard id at upgradeCount 0 (base), 1 (+), 2 (++), … */
export const SkillCard = v.strictObject({
  id: v.pipe(v.string(), v.minLength(1)),
  upgrade: v.pipe(v.number(), v.integer(), v.minValue(0)),
  /** As the game writes it at that level (成就+). */
  name: v.string(),
  /** センス, ロジック, アノマリー, or a card of no plan. */
  plan: v.picklist(["sense", "logic", "anomaly", "free"]),
  rarity: v.picklist(["N", "R", "SR", "SSR", "Legend"]),
  /** アクティブ, メンタル, or a trouble card. */
  type: v.picklist(["active", "mental", "trouble"]),
  /** The game's sort key: sorting these strings gives the game's order. */
  order: v.string(),
  /** Labels of the game's guide categories that list this card, in the order the categories are listed. */
  guideLabels: v.array(v.string()),
  /**
   * The icon: `asset` is the game's asset id (img_general_skillcard_act-3_029). When `perIdol`, each
   * idol of the format `idols` has a variant named `<asset>-<idol id>`; otherwise the one image is `<asset>`.
   */
  art: v.strictObject({ asset: v.pipe(v.string(), v.minLength(1)), perIdol: v.boolean() }),
  /** `limit` is the card's maxCustomizeCount; a card that cannot be customized has `{ limit: 0, kinds: [] }`. */
  customization: v.strictObject({ limit: v.pipe(v.number(), v.integer(), v.minValue(0)), kinds: v.array(CustomizationKind) }),
  origin: Origin,
});
export type SkillCard = v.InferOutput<typeof SkillCard>;

/**
 * A memory ability (a MemoryAbility id) with the scenario groups it belongs to, as the game names
 * them (`produce_group-003` is 初星アイドルフェスティバル, H.I.F.; an empty list is an ability of no
 * one scenario). `card` is set only for an H.I.F. ability: the ProduceCard id of the card it belongs to.
 */
export const MemoryAbility = v.strictObject({ id: v.pipe(v.string(), v.minLength(1)), groups: v.array(v.string()), card: v.optional(v.string()) });
export type MemoryAbility = v.InferOutput<typeof MemoryAbility>;

export const SkillCardsFile = v.strictObject({
  formatVersion: v.literal(1),
  /** In the game's order (by `order`, then id), lower upgrade levels first for each card. */
  cards: v.pipe(
    v.array(SkillCard),
    v.minLength(1, "the list is empty"),
    v.check((cards) => new Set(cards.map((card) => `${card.id} ${card.upgrade}`)).size === cards.length, "a card id appears twice at one upgrade level"),
  ),
  /** By id. */
  memoryAbilities: v.pipe(
    v.array(MemoryAbility),
    v.check((abilities) => new Set(abilities.map((ability) => ability.id)).size === abilities.length, "an ability id appears twice"),
  ),
});
export type SkillCardsFile = v.InferOutput<typeof SkillCardsFile>;

/** The checked file, or a thrown error naming the place of the first bad value. */
export function parse(data: unknown): SkillCardsFile {
  const result = v.safeParse(SkillCardsFile, data);
  if (result.success) return result.output;
  const issue = result.issues[0];
  throw new Error(`skill-cards v1: ${v.getDotPath(issue) ?? "(file)"}: ${issue.message}`);
}
