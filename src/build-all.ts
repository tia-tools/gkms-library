/**
 * Builds the four data files from the game's tables and checks each against its format. Pure:
 * tables and the clock are passed in. Throws before anything is returned when a builder cannot
 * represent a row or a file fails its format, so such a run writes nothing
 * (docs/plans/EXECPLAN_LIBRARY_ALONE.md, L22).
 */

import { parse as parseIdols, type IdolsFile } from "../formats/idols.v1.ts";
import { parse as parseItems, type ItemsFile } from "../formats/items.v1.ts";
import { parse as parseSkillCards, type SkillCardsFile } from "../formats/skill-cards.v1.ts";
import { parse as parseSupportCards, type SupportCardsFile } from "../formats/support-cards.v1.ts";
import { buildIdols } from "./idols/build.ts";
import { buildItems } from "./items/build.ts";
import { type Built, fileText } from "./release.ts";
import { isReleased } from "./released.ts";
import { buildMemoryAbilities, buildSkillCards } from "./skill-cards/build.ts";
import { buildCards, buildLevelLimits } from "./support-cards/build.ts";
import type { RawItemFacts, SkillCardTables, Tables } from "./tables.ts";

export interface Sources {
  tables: Tables;
  skillCardTables: SkillCardTables;
  itemFacts: RawItemFacts[];
}

export interface BuiltAll {
  built: Built[];
  /** One line per format for the run's output: what it lists, beside its table's row count. */
  lines: string[];
  /** The effects that could not be read, for the run's output. */
  unread: SupportCardsFile["unread"];
}

function supportCards(tables: Tables, now: number): { file: SupportCardsFile; line: string } {
  const released: Tables = { ...tables, cards: tables.cards.filter((c) => isReleased(c.viewStartTime, now, `SupportCard ${c.id}`)) };
  const { cards, report } = buildCards(released);
  const file: SupportCardsFile = { formatVersion: 1, levelLimits: buildLevelLimits(released), cards, unread: report.unread };
  return { file, line: `support-cards v1: ${cards.length} cards of ${tables.cards.length} rows, ${report.unread.length} unread` };
}

function skillCards(sources: Sources, now: number): { file: SkillCardsFile; line: string } {
  const { skillCardTables: t } = sources;
  const cards = buildSkillCards(t, now);
  const memoryAbilities = buildMemoryAbilities(t.memoryAbilities, t.cards, sources.tables.skills, now);
  const file: SkillCardsFile = { formatVersion: 1, cards, memoryAbilities };
  const ids = new Set(cards.map((c) => c.id)).size;
  return { file, line: `skill-cards v1: ${cards.length} cards (${ids} ids) of ${t.cards.length} rows, ${memoryAbilities.length} abilities of ${t.memoryAbilities.length} rows` };
}

export function buildAll(sources: Sources, now: number): BuiltAll {
  const idolsFile: IdolsFile = { formatVersion: 1, idols: buildIdols(sources.skillCardTables.characters) };
  const itemsFile: ItemsFile = { formatVersion: 1, items: buildItems(sources.itemFacts, now) };
  const support = supportCards(sources.tables, now);
  const skill = skillCards(sources, now);
  // Each file is checked as it will be read: from its text, by its format.
  const texts = { idols: fileText(idolsFile), items: fileText(itemsFile), support: fileText(support.file), skill: fileText(skill.file) };
  parseIdols(JSON.parse(texts.idols));
  parseItems(JSON.parse(texts.items));
  parseSupportCards(JSON.parse(texts.support));
  parseSkillCards(JSON.parse(texts.skill));
  return {
    built: [
      { format: "idols", formatVersion: 1, text: texts.idols, entries: idolsFile.idols.length },
      { format: "items", formatVersion: 1, text: texts.items, entries: itemsFile.items.length },
      { format: "skill-cards", formatVersion: 1, text: texts.skill, entries: skill.file.cards.length },
      { format: "support-cards", formatVersion: 1, text: texts.support, entries: support.file.cards.length },
    ],
    lines: [
      `idols v1: ${idolsFile.idols.length} idols of ${sources.skillCardTables.characters.length} rows`,
      `items v1: ${itemsFile.items.length} items of ${sources.itemFacts.length} rows`,
      skill.line,
      support.line,
    ],
    unread: support.file.unread,
  };
}
