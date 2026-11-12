/**
 * Format `items`, version 1: every released P-item of 学園アイドルマスター, as plain facts.
 *
 * The file does not read an item's effects. The effects of the items support cards grant are read
 * in the format `support-cards`, on the card that grants them.
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

export const Item = v.strictObject({
  /** The game's ProduceItem id. */
  id: v.pipe(v.string(), v.minLength(1)),
  name: v.string(),
  /** The icon's asset id (`img_general_pitem_2-004`); the published icon is `<assetId>.webp`. */
  assetId: v.pipe(v.string(), v.minLength(1)),
  rarity: v.picklist(["N", "R", "SR", "SSR"]),
  /** センス, ロジック, アノマリー, or an item of no plan. */
  plan: v.picklist(["free", "sense", "logic", "anomaly"]),
  /** How many times the item fires in one run (ProduceItem.fireLimit); absent when unlimited. */
  cap: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  /** The support card whose event grants the item, or null. */
  originSupportCard: v.nullable(v.string()),
  /** The idol card the item belongs to, or null. */
  originIdolCard: v.nullable(v.string()),
});
export type Item = v.InferOutput<typeof Item>;

export const ItemsFile = v.strictObject({
  formatVersion: v.literal(1),
  /** By id. */
  items: v.pipe(
    v.array(Item),
    v.minLength(1, "the list is empty"),
    v.checkItems((item, index, all) => all.findIndex((other) => other.id === item.id) === index, "this id appears earlier in the list"),
  ),
});
export type ItemsFile = v.InferOutput<typeof ItemsFile>;

/** The checked file, or a thrown error naming the place of the first bad value. */
export function parse(data: unknown): ItemsFile {
  const result = v.safeParse(ItemsFile, data);
  if (result.success) return result.output;
  const issue = result.issues[0];
  throw new Error(`items v1: ${v.getDotPath(issue) ?? "(file)"}: ${issue.message}`);
}
