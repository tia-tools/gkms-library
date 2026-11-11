/**
 * The two files gakumas-supportcards publishes, as the comparison check reads them
 * (https://gakumas-supportcards.tia.run/data/cards.v2.json and skillcards.v1.json). Their card and
 * skill card shapes are the ones the library's formats were made from, so those schemas are reused;
 * unlike a format, these accept keys they do not name, since that site may add to its files.
 * Delete this module with the comparison, when gakumas-supportcards stops publishing them
 * (docs/plans/EXECPLAN_LIBRARY_ALONE.md, L6 step 4).
 */

import * as v from "valibot";
import { Idol } from "../../formats/idols.v1.ts";
import { SkillCard } from "../../formats/skill-cards.v1.ts";
import { Card, LevelLimits } from "../../formats/support-cards.v1.ts";

export const THEIR_BASE = "https://gakumas-supportcards.tia.run";
export const THEIR_CARDS_PATH = "data/cards.v2.json";
export const THEIR_SKILL_CARDS_PATH = "data/skillcards.v1.json";

const TheirCards = v.object({
  formatVersion: v.literal(2),
  levelLimits: LevelLimits,
  cards: v.array(Card),
  /** The cards that site's table hides: for an effect it could not read, or for a number its scoring lacks. */
  held: v.array(v.object({ id: v.string(), name: v.string(), reasons: v.array(v.string()) })),
});
export type TheirCards = v.InferOutput<typeof TheirCards>;

/** Their skill card is the library's without `origin`. */
const TheirSkillCard = v.omit(SkillCard, ["origin"]);
export type TheirSkillCard = v.InferOutput<typeof TheirSkillCard>;

const TheirSkillCards = v.object({
  formatVersion: v.literal(1),
  idols: v.array(Idol),
  cards: v.array(TheirSkillCard),
  hifAbilities: v.array(v.object({ id: v.string(), card: v.string() })),
});
export type TheirSkillCards = v.InferOutput<typeof TheirSkillCards>;

function parseWith<T extends v.GenericSchema>(schema: T, data: unknown, what: string): v.InferOutput<T> {
  const result = v.safeParse(schema, data);
  if (result.success) return result.output;
  const issue = result.issues[0];
  throw new Error(`${what}: ${v.getDotPath(issue) ?? "(file)"}: ${issue.message}`);
}

export const parseTheirCards = (data: unknown): TheirCards => parseWith(TheirCards, data, THEIR_CARDS_PATH);
export const parseTheirSkillCards = (data: unknown): TheirSkillCards => parseWith(TheirSkillCards, data, THEIR_SKILL_CARDS_PATH);
