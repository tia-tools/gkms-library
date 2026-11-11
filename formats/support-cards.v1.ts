/**
 * Format `support-cards`, version 1: every released support card of 学園アイドルマスター with the
 * effects that raise Vocal, Dance or Visual, read into a structure, and the list of effects that
 * could not be read.
 *
 * Vocabulary. A card's skills change value at certain card levels ("breakpoints"); a 凸 (limit
 * break, 0–4) sets the card's maximum level. An effect fires on a trigger, read here as an occasion
 * (something that happens in a run), filters (which of its occurrences qualify) and conditions
 * (what state of the run must hold at that moment).
 *
 * A format is the shape of a published file; this file is both its types and its check, and it never
 * changes once published: a change of shape is a new version number in a new file
 * (docs/adr/0005). An app copies this file verbatim and checks downloaded data with `parse`.
 * It imports nothing but Valibot (major version 1).
 */

import * as v from "valibot";

const Stat = v.picklist(["vocal", "dance", "visual"]);
export type Stat = v.InferOutput<typeof Stat>;
const CardType = v.picklist(["vocal", "dance", "visual", "assist"]);
export type CardType = v.InferOutput<typeof CardType>;
const Rarity = v.picklist(["r", "sr", "ssr"]);
export type Rarity = v.InferOutput<typeof Rarity>;
const Plan = v.picklist(["common", "sense", "logic", "anomaly"]);
export type Plan = v.InferOutput<typeof Plan>;

/**
 * Which occurrences of an occasion qualify: a Vocal lesson, an SP lesson, a mental skill card, an
 * SSR card, a card named 「基本」, a 好印象 card, a ロジック card.
 */
export const FILTER_FAMILIES = ["lessonStat", "lessonKind", "cardType", "rarity", "cardName", "effectGroup", "plan"] as const;
export const FilterRef = v.strictObject({ family: v.picklist(FILTER_FAMILIES), member: v.pipe(v.string(), v.minLength(1)) });
export type FilterRef = v.InferOutput<typeof FilterRef>;

/** A state of the run that must hold when the occasion happens: a stat, stamina, or a number of held cards within a range. */
export const ConditionRef = v.strictObject({
  /** The game's own word: `vocal`, `stamina_ratio`, `produce_card_count`, `produce_card_search_count`, … */
  kind: v.pipe(v.string(), v.minLength(1)),
  /** `produce_card_search_count` only: which held cards are counted; absent = all of them. */
  subject: v.optional(v.array(FilterRef)),
  /** Inclusive bounds as written in the trigger id (`0500` for 50% stamina); 0 = unbounded on that side. */
  min: v.number(),
  max: v.number(),
});
export type ConditionRef = v.InferOutput<typeof ConditionRef>;

/** A trigger id read as occasion, filters and conditions. */
export const ParsedTrigger = v.strictObject({
  /** `ProduceTrigger.phaseType` without its `ProducePhaseType_` prefix, e.g. `EndLesson`. */
  occasion: v.pipe(v.string(), v.minLength(1)),
  filters: v.optional(v.array(FilterRef)),
  conditions: v.optional(v.array(ConditionRef)),
  /**
   * Set when the trigger fires in one scenario only: the game's own token, the word after `for_`
   * in the trigger id (`hif`, `hif_memory`, `hajime_legend`, `hajime_legend_ssr`, `nia_master`, …).
   * Which scenario a token belongs to is for the app to say.
   */
  scenario: v.optional(v.pipe(v.string(), v.minLength(1))),
});
export type ParsedTrigger = v.InferOutput<typeof ParsedTrigger>;

export const ClassifiedEffect = v.strictObject({
  stat: Stat,
  /** Flat points, or tenths of a percent for パラメータボーナス+ (85 = 8.5%). */
  value: v.number(),
  /** A skill of the card, a reward of one of its own events, or an effect of a P-item it grants. */
  kind: v.picklist(["skill", "event", "item"]),
  /** Per-run cap on occurrences: `ProduceSkill.activationCount` for skills, `ProduceItem.fireLimit` for items. Absent = unlimited. */
  cap: v.optional(v.number()),
  /** Items only: the granting P-item. */
  itemId: v.optional(v.string()),
  itemName: v.optional(v.string()),
  /** The effect's trigger; absent for `kind: "event"`, a card's own サポートイベント reward, which has no trigger. */
  trigger: v.optional(ParsedTrigger),
  /** True for パラメータボーナス+: `value` is tenths of a percent of the stat's gain over the run, not points per occurrence. */
  bonus: v.optional(v.literal(true)),
});
export type ClassifiedEffect = v.InferOutput<typeof ClassifiedEffect>;

export const Breakpoint = v.strictObject({
  minLevel: v.pipe(v.number(), v.integer(), v.minValue(1)),
  effects: v.array(ClassifiedEffect),
  /** Own-event parameter multiplier at this level in permil (500 = +50%), 0 when none. */
  eventBonusPermil: v.number(),
});
export type Breakpoint = v.InferOutput<typeof Breakpoint>;

/**
 * A P-item one of the card's events grants, listed when the item has a readable stat effect (those
 * effects sit in the breakpoints with `itemId`) or grants P-drinks. Level-independent.
 */
export const ItemGrant = v.strictObject({
  itemId: v.string(),
  itemName: v.string(),
  /** The game's icon asset, e.g. `img_general_pitem_2-004`; the published icon is `<assetId>.webp`. */
  assetId: v.string(),
  /** `ProduceItem.fireLimit`; absent = unlimited. */
  cap: v.optional(v.number()),
  /** Set when a fire grants P-drinks: how many, and on which trigger. */
  drinks: v.optional(v.strictObject({ perFire: v.number(), trigger: ParsedTrigger })),
});
export type ItemGrant = v.InferOutput<typeof ItemGrant>;

export const Card = v.strictObject({
  id: v.pipe(v.string(), v.minLength(1)),
  name: v.string(),
  /** The art's asset id (`csprt-3-0110`); the published art is `img_general_<assetId>_full.webp`. */
  assetId: v.pipe(v.string(), v.minLength(1)),
  type: CardType,
  rarity: Rarity,
  plan: Plan,
  /** Sorted by minLevel ascending; the first entry is the card at level 1. */
  breakpoints: v.pipe(v.array(Breakpoint), v.minLength(1, "a card has no breakpoint")),
  /** P-items the card grants that count for something, sorted by item id; absent when none. */
  items: v.optional(v.array(ItemGrant)),
  /** The card has an SP発生率+ skill from level 1. It is not among the effects. */
  spRate: v.optional(v.literal(true)),
});
export type Card = v.InferOutput<typeof Card>;

const FiveLevels = v.tuple([v.number(), v.number(), v.number(), v.number(), v.number()]);
/** Card level at 凸0..凸4, per rarity. */
export const LevelLimits = v.strictObject({ r: FiveLevels, sr: FiveLevels, ssr: FiveLevels });
export type LevelLimits = v.InferOutput<typeof LevelLimits>;

/**
 * An effect of a card that could not be read, and is therefore left out of the card: a trigger with
 * a piece of unknown kind, or an effect type that neither raises a parameter nor is known not to.
 * `reason` names the skill, event or item and what was not understood.
 */
export const Unread = v.strictObject({ cardId: v.string(), cardName: v.string(), reason: v.pipe(v.string(), v.minLength(1)) });
export type Unread = v.InferOutput<typeof Unread>;

export const SupportCardsFile = v.strictObject({
  formatVersion: v.literal(1),
  levelLimits: LevelLimits,
  /** By id. */
  cards: v.pipe(
    v.array(Card),
    v.minLength(1, "the list is empty"),
    v.check((cards) => new Set(cards.map((card) => card.id)).size === cards.length, "a card id appears twice"),
  ),
  /** One entry per card and distinct reason, by card id and then reason; empty when every effect was read. */
  unread: v.array(Unread),
});
export type SupportCardsFile = v.InferOutput<typeof SupportCardsFile>;

/** The checked file, or a thrown error naming the place of the first bad value. */
export function parse(data: unknown): SupportCardsFile {
  const result = v.safeParse(SupportCardsFile, data);
  if (result.success) return result.output;
  const issue = result.issues[0];
  throw new Error(`support-cards v1: ${v.getDotPath(issue) ?? "(file)"}: ${issue.message}`);
}
