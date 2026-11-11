/**
 * Loading of the game's tables, the YAML dumps public at `vertesan/gakumasu-diff`.
 * Adapted from gakumas-supportcards' scripts/lib/tables.ts (docs/plans/EXECPLAN_LIBRARY_ALONE.md, L13).
 *
 * Each table is read from `<cacheDir>/<Table>.yaml` when present, otherwise
 * fetched from `<baseUrl><Table>.yaml` and written to the cache. Only the
 * fields the builders read are declared, and each row must give them their types.
 */

import { load as loadYaml } from "js-yaml";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_BASE_URL = "https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/";
export const DEFAULT_CACHE_DIR = ".cache/gakumasu-diff";

export interface RawSupportCard {
  id: string;
  name: string;
  type: string;
  rarity: string;
  planType: string;
  assetId: string;
  supportCardLevelLimitId: string;
  /** Epoch milliseconds as a string, or "0" for always. */
  viewStartTime: string;
}
export interface RawSkillLevel {
  supportCardId: string;
  produceSkillId: string;
  produceSkillLevel: number;
  supportCardLevel: number;
}
export interface RawProduceSkill {
  id: string;
  level: number;
  activationCount: number;
  produceEffectId1: string;
  produceTriggerId1: string;
  produceEffectId2: string;
  produceTriggerId2: string;
  produceEffectId3: string;
  produceTriggerId3: string;
}
export interface RawProduceReward {
  resourceType: string;
  resourceId: string;
}
export interface RawProduceEffect {
  id: string;
  produceEffectType: string;
  effectValueMin: number;
  effectValueMax: number;
  produceRewards: RawProduceReward[];
}
export interface RawProduceTrigger {
  id: string;
  phaseType: string;
}
export interface RawLevelLimit {
  id: string;
  rank: string;
  levelLimit: number;
}
export interface RawEventSupportCard {
  supportCardId: string;
  number: number;
  supportCardLevel: number;
  produceStepEventDetailId: string;
}
export interface RawEventDetail {
  id: string;
  produceEffectIds: string[];
}
export interface RawProduceItemSkill {
  produceTriggerId: string;
  produceItemEffectId: string;
}
export interface RawProduceItem {
  id: string;
  name: string;
  assetId: string;
  fireLimit: number;
  produceTriggerId: string;
  skills: RawProduceItemSkill[];
}
export interface RawProduceItemEffect {
  id: string;
  effectType: string;
  produceEffectId: string;
}

/** One skill card at one upgrade level (ProduceCard.yaml has one row per id and upgradeCount). */
export interface RawProduceCard {
  id: string;
  upgradeCount: number;
  name: string;
  assetId: string;
  isCharacterAsset: boolean;
  rarity: string;
  planType: string;
  category: string;
  searchTag: string;
  originIdolCardId: string;
  originSupportCardId: string;
  produceCardCustomizeIds: string[];
  maxCustomizeCount: number;
  /** Epoch milliseconds as a string, or "0" for always. */
  viewStartTime: string;
  order: string;
}
/** One step of a customization kind; the kind's rows share its id. */
export interface RawCardCustomize {
  id: string;
  customizeCount: number;
  description: string;
  overwriteProduceCardGrowEffectType: string;
  produceCardGrowEffectIds: string[];
}
export interface RawGrowEffect {
  id: string;
  effectType: string;
}
export interface RawGrowEffectDescription {
  type: string;
  produceCardCustomizeDescription: string;
}
export interface RawMemoryAbility {
  id: string;
  skillId: string;
  produceGroupIds: string[];
}
export interface RawGuideCategory {
  label: string;
  produceCardIds: string[];
}
/** One P-item as the items file needs it (ProduceItem.yaml), beside `RawProduceItem`, which the support cards read. */
export interface RawItemFacts {
  id: string;
  name: string;
  assetId: string;
  rarity: string;
  planType: string;
  fireLimit: number;
  originSupportCardId: string;
  originIdolCardId: string;
  /** Epoch milliseconds as a string, or "0" for always. */
  viewStartTime: string;
}
export interface RawCharacter {
  id: string;
  lastName: string;
  firstName: string;
  isPlayable: boolean;
  order: number;
}

/** The tables the skill card data is built from, besides ProduceSkill. */
export interface SkillCardTables {
  cards: RawProduceCard[];
  customizes: RawCardCustomize[];
  growEffects: RawGrowEffect[];
  growEffectDescriptions: RawGrowEffectDescription[];
  memoryAbilities: RawMemoryAbility[];
  guideCategories: RawGuideCategory[];
  characters: RawCharacter[];
}

export interface Tables {
  cards: RawSupportCard[];
  skillLevels: RawSkillLevel[];
  skills: RawProduceSkill[];
  effects: RawProduceEffect[];
  triggers: RawProduceTrigger[];
  levelLimits: RawLevelLimit[];
  eventCards: RawEventSupportCard[];
  eventDetails: RawEventDetail[];
  items: RawProduceItem[];
  itemEffects: RawProduceItemEffect[];
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

export interface LoadOptions {
  cacheDir?: string;
  baseUrl?: string;
}

async function readTableText(name: string, opts: LoadOptions): Promise<string> {
  // GAKUMASU_DIFF_CACHE lets a test point the generators at a modified copy of the tables.
  const cacheDir = opts.cacheDir ?? process.env["GAKUMASU_DIFF_CACHE"] ?? DEFAULT_CACHE_DIR;
  const path = join(cacheDir, `${name}.yaml`);
  if (existsSync(path)) return readFileSync(path, "utf8");
  const res = await fetch(`${opts.baseUrl ?? DEFAULT_BASE_URL}${name}.yaml`);
  if (!res.ok) throw new Error(`fetch ${name}.yaml: HTTP ${res.status}`);
  const text = await res.text();
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(path, text);
  return text;
}

/** The YAML type a field must have, checked by `loadTypedTable`. */
export type FieldType = "string" | "number" | "boolean" | "string[]" | "list";
export type FieldTypes<T> = Readonly<Record<keyof T & string, FieldType>>;

function hasType(value: unknown, type: FieldType): boolean {
  if (type === "string[]") return Array.isArray(value) && value.every((v) => typeof v === "string");
  if (type === "list") return Array.isArray(value);
  return typeof value === type;
}

/** How an error names a row: its id, else its type (the key of ProduceDescriptionProduceCardGrowEffect). */
function rowName(row: Record<string, unknown>): string {
  const name = row["id"] ?? row["type"];
  return typeof name === "string" ? name : "no id";
}

/** The first field of the first row whose value lacks its type, described for an error; null when every row is well typed. */
export function firstMistyped(rows: readonly unknown[], fields: Readonly<Record<string, FieldType | undefined>>): string | null {
  for (const [i, row] of rows.entries()) {
    if (!isRecord(row)) return `row ${i} is not a mapping`;
    for (const [field, type] of Object.entries(fields)) {
      if (type !== undefined && !hasType(row[field], type)) return `row ${i} (${rowName(row)}): ${field} should be ${type}, is ${JSON.stringify(row[field]) ?? "missing"}`;
    }
  }
  return null;
}

function isTypedRows<T>(rows: unknown, fields: Readonly<Record<string, FieldType | undefined>>): rows is T[] {
  return Array.isArray(rows) && firstMistyped(rows, fields) === null;
}

/**
 * A table's rows, each of which must give every declared field its type. A value of another type
 * would not fail a comparison but silently fail it: an upgradeCount of "1" would never equal the number 1.
 */
export async function loadTypedTable<T>(name: string, fields: FieldTypes<T>, opts: LoadOptions = {}): Promise<T[]> {
  return loadPartlyTypedTable<T>(name, fields, opts);
}

/**
 * Like `loadTypedTable`, for a row type with fields that cannot be declared here: a list of nested
 * mappings is checked to be a list (`"list"`) and no deeper, and a field the game may leave out is
 * not declared at all. The builders read those defensively.
 */
export async function loadPartlyTypedTable<T>(name: string, fields: Readonly<Partial<Record<keyof T & string, FieldType>>>, opts: LoadOptions = {}): Promise<T[]> {
  const parsed: unknown = loadYaml(await readTableText(name, opts));
  if (!Array.isArray(parsed)) throw new Error(`${name}.yaml: expected a list of rows`);
  if (!isTypedRows<T>(parsed, fields)) throw new Error(`${name}.yaml: ${firstMistyped(parsed, fields) ?? "malformed"}`);
  return parsed;
}

const SKILL_LEVEL_FIELDS: FieldTypes<RawSkillLevel> = { supportCardId: "string", produceSkillId: "string", produceSkillLevel: "number", supportCardLevel: "number" };
/** ProduceSkill's second and third effect and trigger are not declared here: a skill with one effect may leave them out. */
const PRODUCE_SKILL_FIELDS = { id: "string", level: "number", activationCount: "number", produceEffectId1: "string", produceTriggerId1: "string" } as const;

/** The tables the support cards are built from, each declared field typed. */
export async function loadTables(opts: LoadOptions = {}): Promise<Tables> {
  const [cards, slVocal, slDance, slVisual, slAssist, skills, effects, triggers, levelLimits, eventCards, eventDetails, items, itemEffects] = await Promise.all([
    loadTypedTable<RawSupportCard>("SupportCard", { id: "string", name: "string", type: "string", rarity: "string", planType: "string", assetId: "string", supportCardLevelLimitId: "string", viewStartTime: "string" }, opts),
    loadTypedTable<RawSkillLevel>("SupportCardProduceSkillLevelVocal", SKILL_LEVEL_FIELDS, opts),
    loadTypedTable<RawSkillLevel>("SupportCardProduceSkillLevelDance", SKILL_LEVEL_FIELDS, opts),
    loadTypedTable<RawSkillLevel>("SupportCardProduceSkillLevelVisual", SKILL_LEVEL_FIELDS, opts),
    loadTypedTable<RawSkillLevel>("SupportCardProduceSkillLevelAssist", SKILL_LEVEL_FIELDS, opts),
    loadPartlyTypedTable<RawProduceSkill>("ProduceSkill", PRODUCE_SKILL_FIELDS, opts),
    loadPartlyTypedTable<RawProduceEffect>("ProduceEffect", { id: "string", produceEffectType: "string", effectValueMin: "number", effectValueMax: "number", produceRewards: "list" }, opts),
    loadTypedTable<RawProduceTrigger>("ProduceTrigger", { id: "string", phaseType: "string" }, opts),
    loadTypedTable<RawLevelLimit>("SupportCardLevelLimit", { id: "string", rank: "string", levelLimit: "number" }, opts),
    loadTypedTable<RawEventSupportCard>("ProduceEventSupportCard", { supportCardId: "string", number: "number", supportCardLevel: "number", produceStepEventDetailId: "string" }, opts),
    loadTypedTable<RawEventDetail>("ProduceStepEventDetail", { id: "string", produceEffectIds: "string[]" }, opts),
    loadPartlyTypedTable<RawProduceItem>("ProduceItem", { id: "string", name: "string", assetId: "string", fireLimit: "number", produceTriggerId: "string", skills: "list" }, opts),
    loadTypedTable<RawProduceItemEffect>("ProduceItemEffect", { id: "string", effectType: "string", produceEffectId: "string" }, opts),
  ]);
  return {
    cards,
    skillLevels: [...slVocal, ...slDance, ...slVisual, ...slAssist],
    skills,
    effects,
    triggers,
    levelLimits,
    eventCards,
    eventDetails,
    items,
    itemEffects,
  };
}

const PRODUCE_CARD_FIELDS: FieldTypes<RawProduceCard> = {
  id: "string",
  upgradeCount: "number",
  name: "string",
  assetId: "string",
  isCharacterAsset: "boolean",
  rarity: "string",
  planType: "string",
  category: "string",
  searchTag: "string",
  originIdolCardId: "string",
  originSupportCardId: "string",
  produceCardCustomizeIds: "string[]",
  maxCustomizeCount: "number",
  viewStartTime: "string",
  order: "string",
};

/**
 * The skill card tables, each field typed. ProduceSkill is not among them: `loadTables` already
 * reads it, with the fields the H.I.F. abilities need.
 */
export async function loadSkillCardTables(opts: LoadOptions = {}): Promise<SkillCardTables> {
  const [cards, customizes, growEffects, growEffectDescriptions, memoryAbilities, guideCategories, characters] = await Promise.all([
    loadTypedTable<RawProduceCard>("ProduceCard", PRODUCE_CARD_FIELDS, opts),
    loadTypedTable<RawCardCustomize>("ProduceCardCustomize", { id: "string", customizeCount: "number", description: "string", overwriteProduceCardGrowEffectType: "string", produceCardGrowEffectIds: "string[]" }, opts),
    loadTypedTable<RawGrowEffect>("ProduceCardGrowEffect", { id: "string", effectType: "string" }, opts),
    loadTypedTable<RawGrowEffectDescription>("ProduceDescriptionProduceCardGrowEffect", { type: "string", produceCardCustomizeDescription: "string" }, opts),
    loadTypedTable<RawMemoryAbility>("MemoryAbility", { id: "string", skillId: "string", produceGroupIds: "string[]" }, opts),
    loadTypedTable<RawGuideCategory>("ProduceGuideProduceCardCategory", { label: "string", produceCardIds: "string[]" }, opts),
    loadTypedTable<RawCharacter>("Character", { id: "string", lastName: "string", firstName: "string", isPlayable: "boolean", order: "number" }, opts),
  ]);
  return { cards, customizes, growEffects, growEffectDescriptions, memoryAbilities, guideCategories, characters };
}

/** ProduceItem's rows with the plain facts the items file publishes, each field typed. */
export async function loadItemFacts(opts: LoadOptions = {}): Promise<RawItemFacts[]> {
  return loadTypedTable<RawItemFacts>(
    "ProduceItem",
    { id: "string", name: "string", assetId: "string", rarity: "string", planType: "string", fireLimit: "number", originSupportCardId: "string", originIdolCardId: "string", viewStartTime: "string" },
    opts,
  );
}
