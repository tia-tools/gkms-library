/**
 * Builds the skill card file's entries (formats/skill-cards.v1.ts) from the game's tables: every
 * released ProduceCard row at every upgrade level, and every memory ability. Pure: tables, the
 * ProduceSkill rows and the clock are passed in. Throws, naming the row, on anything the format
 * cannot represent, so a broken dump stops the run.
 *
 * Adapted from gakumas-supportcards' scripts/lib/build-skillcards.ts, which kept only the cards
 * that can be a produce memory, gkms-memomemo's pool. Here nothing is left out; `origin`, `type`
 * and `rarity` are the facts that app's rule needs to cut its pool again
 * (docs/plans/EXECPLAN_LIBRARY_ALONE.md, L8, L16).
 */

import type { MemoryAbility, SkillCard } from "../../formats/skill-cards.v1.ts";
import { byCodeUnit } from "../order.ts";
import { isReleased } from "../released.ts";
import type { RawCardCustomize, RawMemoryAbility, RawProduceCard, RawProduceSkill, SkillCardTables } from "../tables.ts";

const PLANS = new Map<string, SkillCard["plan"]>([
  ["ProducePlanType_Plan1", "sense"],
  ["ProducePlanType_Plan2", "logic"],
  ["ProducePlanType_Plan3", "anomaly"],
  ["ProducePlanType_Common", "free"],
]);
const RARITIES = new Map<string, SkillCard["rarity"]>([
  ["ProduceCardRarity_N", "N"],
  ["ProduceCardRarity_R", "R"],
  ["ProduceCardRarity_Sr", "SR"],
  ["ProduceCardRarity_Ssr", "SSR"],
  ["ProduceCardRarity_Legend", "Legend"],
]);
const TYPES = new Map<string, SkillCard["type"]>([
  ["ProduceCardCategory_ActiveSkill", "active"],
  ["ProduceCardCategory_MentalSkill", "mental"],
  ["ProduceCardCategory_Trouble", "trouble"],
]);
const TAGS = new Map<string, SkillCard["origin"]["tag"]>([
  ["", "none"],
  ["starter", "starter"],
  ["idol-unique", "idolUnique"],
]);

/** The scenario group of 初星アイドルフェスティバル (H.I.F.) in MemoryAbility.produceGroupIds. */
export const HIF_PRODUCE_GROUP = "produce_group-003";
/** An H.I.F. ability's card appears only inside its skill's effect id. */
const HIF_EFFECT = /^p_effect-exam_status_enchant-enchant-p_ef-hif_memory-(p_card-.+)-enc02$/;
/** No grow-effect type: the overwrite field is unset. */
const NO_OVERWRITE = "ProduceCardGrowEffectType_Unknown";

function known<T>(map: Map<string, T>, value: string, what: string, where: string): T {
  const mapped = map.get(value);
  if (mapped === undefined) throw new Error(`${where}: unknown ${what} "${value}"`);
  return mapped;
}

function rowReleased(card: Pick<RawProduceCard, "id" | "upgradeCount" | "viewStartTime">, now: number): boolean {
  return isReleased(card.viewStartTime, now, `${card.id} level ${card.upgradeCount}`);
}

/** The game's escape for a line break, backslash and `n`, becomes a real one. */
function gameText(text: string): string {
  return text.replaceAll("\\n", "\n");
}

interface LabelSources {
  growTypeById: Map<string, string>;
  labelByGrowType: Map<string, string>;
}

/**
 * A step's label: its description, else the generic label of its first grow effect's type. Stops
 * when the step's overwrite type would label it differently, since nothing says which of the two
 * the game shows.
 */
export function stepLabel(row: RawCardCustomize, sources: LabelSources): string {
  const where = `ProduceCardCustomize ${row.id} step ${row.customizeCount}`;
  const firstGrowId = row.produceCardGrowEffectIds[0];
  const growType = firstGrowId === undefined ? undefined : sources.growTypeById.get(firstGrowId);
  if (firstGrowId !== undefined && growType === undefined) throw new Error(`${where}: missing ProduceCardGrowEffect ${firstGrowId}`);
  if (row.description !== "") return gameText(row.description);
  const generic = growType === undefined ? undefined : sources.labelByGrowType.get(growType);
  if (row.overwriteProduceCardGrowEffectType !== NO_OVERWRITE) {
    const overwritten = sources.labelByGrowType.get(row.overwriteProduceCardGrowEffectType);
    if (overwritten !== generic) {
      throw new Error(`${where}: no description, and its overwrite type ${row.overwriteProduceCardGrowEffectType} (${overwritten ?? "no label"}) and its first grow effect's type ${growType ?? "none"} (${generic ?? "no label"}) would label it differently`);
    }
  }
  if (generic === undefined || generic === "") throw new Error(`${where}: no description and no label for grow effect type ${growType ?? "(no grow effect)"}`);
  return gameText(generic);
}

interface CardSources extends LabelSources {
  stepsByKind: Map<string, RawCardCustomize[]>;
  guideLabelsByCard: Map<string, string[]>;
}

function customizationOf(card: RawProduceCard, sources: CardSources): SkillCard["customization"] {
  const kinds = card.produceCardCustomizeIds.map((kindId) => {
    const rows = sources.stepsByKind.get(kindId);
    if (rows === undefined) throw new Error(`${card.id} level ${card.upgradeCount}: missing ProduceCardCustomize ${kindId}`);
    const steps = [...rows].sort((a, b) => a.customizeCount - b.customizeCount).map((row) => ({ step: row.customizeCount, label: stepLabel(row, sources) }));
    return { id: kindId, steps };
  });
  return { limit: card.maxCustomizeCount, kinds };
}

function toSkillCard(card: RawProduceCard, sources: CardSources): SkillCard {
  const where = `${card.id} level ${card.upgradeCount}`;
  return {
    id: card.id,
    upgrade: card.upgradeCount,
    name: card.name,
    plan: known(PLANS, card.planType, "plan", where),
    rarity: known(RARITIES, card.rarity, "rarity", where),
    type: known(TYPES, card.category, "category", where),
    order: card.order,
    guideLabels: sources.guideLabelsByCard.get(card.id) ?? [],
    art: { asset: card.assetId, perIdol: card.isCharacterAsset },
    customization: customizationOf(card, sources),
    origin: {
      tag: known(TAGS, card.searchTag, "search tag", where),
      supportCard: card.originSupportCardId === "" ? null : card.originSupportCardId,
      idolCard: card.originIdolCardId === "" ? null : card.originIdolCardId,
    },
  };
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) out.set(key(row), [...(out.get(key(row)) ?? []), row]);
  return out;
}

/** Each card id's guide labels, in the order the categories are listed, without repeats. */
function guideLabelsByCard(tables: SkillCardTables): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const category of tables.guideCategories) {
    for (const cardId of category.produceCardIds) {
      const labels = out.get(cardId) ?? [];
      if (!labels.includes(category.label)) out.set(cardId, [...labels, category.label]);
    }
  }
  return out;
}

function cardSources(tables: SkillCardTables): CardSources {
  return {
    growTypeById: new Map(tables.growEffects.map((g) => [g.id, g.effectType])),
    labelByGrowType: new Map(tables.growEffectDescriptions.map((d) => [d.type, d.produceCardCustomizeDescription])),
    stepsByKind: groupBy(tables.customizes, (row) => row.id),
    guideLabelsByCard: guideLabelsByCard(tables),
  };
}

/**
 * Every released row, in the game's order (`order`, then id, so two cards sharing an order stay
 * apart) and lower upgrade levels first. A row listed twice means the dump is broken.
 */
export function buildSkillCards(tables: SkillCardTables, now: number): SkillCard[] {
  const sources = cardSources(tables);
  const cards = tables.cards.filter((card) => rowReleased(card, now)).map((card) => toSkillCard(card, sources));
  const seen = new Set<string>();
  for (const card of cards) {
    const key = `${card.id} level ${card.upgrade}`;
    if (seen.has(key)) throw new Error(`ProduceCard ${key} appears twice`);
    seen.add(key);
  }
  return cards.sort((a, b) => byCodeUnit(a.order, b.order) || byCodeUnit(a.id, b.id) || a.upgrade - b.upgrade);
}

/** The card id named by an H.I.F. ability's skill, or a thrown error naming the ability. */
function hifCardOf(abilityId: string, skillRows: readonly RawProduceSkill[]): string {
  if (skillRows.length === 0) throw new Error(`MemoryAbility ${abilityId}: missing ProduceSkill`);
  const cards = new Set<string>();
  for (const skill of skillRows) {
    const effects = [skill.produceEffectId1, skill.produceEffectId2, skill.produceEffectId3].filter((id) => typeof id === "string" && id !== "");
    const match = effects.length === 1 ? HIF_EFFECT.exec(effects[0] ?? "") : null;
    const card = match?.[1];
    if (card === undefined) throw new Error(`MemoryAbility ${abilityId}: its skill ${skill.id} level ${skill.level} should have exactly one effect p_effect-exam_status_enchant-enchant-p_ef-hif_memory-<card id>-enc02, has ${JSON.stringify(effects)}`);
    cards.add(card);
  }
  if (cards.size > 1) throw new Error(`MemoryAbility ${abilityId}: its skill's levels name different cards: ${[...cards].join(", ")}`);
  return [...cards][0] ?? "";
}

/**
 * Every memory ability, by id, with its scenario groups as the game lists them. An H.I.F. ability
 * also names its card, read from its skill; one whose card is not released yet is left out, and one
 * naming a card that does not exist stops the run. No other ability's skill is read.
 */
export function buildMemoryAbilities(abilities: readonly RawMemoryAbility[], cards: readonly RawProduceCard[], skills: readonly RawProduceSkill[], now: number): MemoryAbility[] {
  const skillsById = groupBy(skills, (s) => s.id);
  const baseRows = new Map(cards.filter((c) => c.upgradeCount === 0).map((c) => [c.id, c]));
  const out: MemoryAbility[] = [];
  const seen = new Set<string>();
  for (const ability of abilities) {
    if (seen.has(ability.id)) throw new Error(`MemoryAbility ${ability.id} appears twice`);
    seen.add(ability.id);
    if (!ability.produceGroupIds.includes(HIF_PRODUCE_GROUP)) {
      out.push({ id: ability.id, groups: ability.produceGroupIds });
      continue;
    }
    const card = hifCardOf(ability.id, skillsById.get(ability.skillId) ?? []);
    const base = baseRows.get(card);
    if (base === undefined) throw new Error(`MemoryAbility ${ability.id}: names ${card}, which is not a ProduceCard`);
    if (rowReleased(base, now)) out.push({ id: ability.id, groups: ability.produceGroupIds, card });
  }
  return out.sort((a, b) => byCodeUnit(a.id, b.id));
}
