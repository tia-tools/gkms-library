import { describe, expect, test } from "bun:test";
import type { RawItemFacts } from "../tables.ts";
import { buildItems } from "./build.ts";

const NOW = 1_800_000_000_000;

function row(id: string, over: Partial<RawItemFacts> = {}): RawItemFacts {
  return { id, name: `item ${id}`, assetId: `img_general_pitem_${id.slice(-5)}`, rarity: "ProduceItemRarity_Sr", planType: "ProducePlanType_Plan1", fireLimit: 0, originSupportCardId: "", originIdolCardId: "", viewStartTime: "0", ...over };
}

describe("buildItems", () => {
  test("lists every released row exactly once, by id, and no row released later", () => {
    const rows = [row("pitem_01-3-002"), row("pitem_01-3-001"), row("pitem_01-3-003", { viewStartTime: String(NOW) }), row("pitem_01-3-004", { viewStartTime: String(NOW + 1) })];
    expect(buildItems(rows, NOW).map((i) => i.id)).toEqual(["pitem_01-3-001", "pitem_01-3-002", "pitem_01-3-003"]);
  });

  test("maps rarity and plan, keeps name and icon, and gives origins as an id or null", () => {
    const [item] = buildItems([row("pitem_01-3-001", { rarity: "ProduceItemRarity_Ssr", planType: "ProducePlanType_Common", originSupportCardId: "s_card-3-0001", fireLimit: 2 })], NOW);
    expect(item).toEqual({ id: "pitem_01-3-001", name: "item pitem_01-3-001", assetId: "img_general_pitem_3-001", rarity: "SSR", plan: "free", cap: 2, originSupportCard: "s_card-3-0001", originIdolCard: null });
  });

  test("leaves the cap out for an item that fires without limit", () => {
    expect(buildItems([row("pitem_01-3-001", { originIdolCardId: "i_card-hski-3-000" })], NOW)[0]).toEqual({
      id: "pitem_01-3-001",
      name: "item pitem_01-3-001",
      assetId: "img_general_pitem_3-001",
      rarity: "SR",
      plan: "sense",
      originSupportCard: null,
      originIdolCard: "i_card-hski-3-000",
    });
  });

  test("stops, naming the row, on an unknown rarity or plan, a release time of another form, or an id listed twice", () => {
    expect(() => buildItems([row("pitem_x", { rarity: "ProduceItemRarity_Ur" })], NOW)).toThrow('ProduceItem pitem_x: unknown rarity "ProduceItemRarity_Ur"');
    expect(() => buildItems([row("pitem_x", { planType: "ProducePlanType_Plan4" })], NOW)).toThrow('ProduceItem pitem_x: unknown plan "ProducePlanType_Plan4"');
    expect(() => buildItems([row("pitem_x", { viewStartTime: "2026-11-10" })], NOW)).toThrow('ProduceItem pitem_x: viewStartTime "2026-11-10"');
    expect(() => buildItems([row("pitem_x"), row("pitem_x")], NOW)).toThrow("ProduceItem pitem_x appears twice");
  });

  test("gives an empty list for no rows, which the format then refuses", () => {
    expect(buildItems([], NOW)).toEqual([]);
  });
});
