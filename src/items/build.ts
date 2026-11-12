/**
 * Builds the items file's entries (formats/items.v1.ts) from ProduceItem: every released row, as
 * plain facts, by id. Pure: the rows and the clock are passed in. Throws, naming the row, on an
 * enum value it does not know or an id listed twice, so a broken dump stops the run.
 */

import type { Item } from "../../formats/items.v1.ts";
import { byCodeUnit } from "../order.ts";
import { isReleased } from "../released.ts";
import type { RawItemFacts } from "../tables.ts";

const RARITIES = new Map<string, Item["rarity"]>([
  ["ProduceItemRarity_N", "N"],
  ["ProduceItemRarity_R", "R"],
  ["ProduceItemRarity_Sr", "SR"],
  ["ProduceItemRarity_Ssr", "SSR"],
]);
const PLANS = new Map<string, Item["plan"]>([
  ["ProducePlanType_Common", "free"],
  ["ProducePlanType_Plan1", "sense"],
  ["ProducePlanType_Plan2", "logic"],
  ["ProducePlanType_Plan3", "anomaly"],
]);

function known<T>(map: Map<string, T>, value: string, what: string, where: string): T {
  const mapped = map.get(value);
  if (mapped === undefined) throw new Error(`${where}: unknown ${what} "${value}"`);
  return mapped;
}

function toItem(row: RawItemFacts): Item {
  const where = `ProduceItem ${row.id}`;
  const item: Item = {
    id: row.id,
    name: row.name,
    assetId: row.assetId,
    rarity: known(RARITIES, row.rarity, "rarity", where),
    plan: known(PLANS, row.planType, "plan", where),
    originSupportCard: row.originSupportCardId === "" ? null : row.originSupportCardId,
    originIdolCard: row.originIdolCardId === "" ? null : row.originIdolCardId,
  };
  if (row.fireLimit > 0) item.cap = row.fireLimit;
  return item;
}

export function buildItems(rows: readonly RawItemFacts[], now: number): Item[] {
  const items = rows.filter((row) => isReleased(row.viewStartTime, now, `ProduceItem ${row.id}`)).map(toItem);
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new Error(`ProduceItem ${item.id} appears twice`);
    seen.add(item.id);
  }
  return items.sort((a, b) => byCodeUnit(a.id, b.id));
}
