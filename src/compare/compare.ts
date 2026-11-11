/**
 * The comparison check: does the library publish everything gakumas-supportcards publishes today?
 * Pure: both sites' parsed files are passed in. Each difference is expected, named and counted
 * here, or unexpected, for a person to read (docs/plans/EXECPLAN_LIBRARY_ALONE.md, L26).
 *
 * The two sites read the game's tables at different times, and gakumas-supportcards stays an update
 * behind when one of its gates refuses it. So an entry only the library has is expected, and a
 * card that differs may be such a lag rather than a loss.
 */

import type { IdolsFile } from "../../formats/idols.v1.ts";
import type { ItemsFile } from "../../formats/items.v1.ts";
import type { SkillCardsFile } from "../../formats/skill-cards.v1.ts";
import type { Card, ParsedTrigger, SupportCardsFile } from "../../formats/support-cards.v1.ts";
import { HIF_PRODUCE_GROUP } from "../skill-cards/build.ts";
import type { TheirCards, TheirSkillCards } from "./theirs.ts";

export interface Theirs {
  cards: TheirCards;
  skillCards: TheirSkillCards;
}
export interface Ours {
  supportCards: SupportCardsFile;
  skillCards: SkillCardsFile;
  idols: IdolsFile;
  items: ItemsFile;
}
export interface Difference {
  kind: "expected" | "unexpected";
  name: string;
  count: number;
  /** At most five, naming where. */
  examples: readonly string[];
}

/**
 * The scenario id gakumas-supportcards writes for each of the game's tokens (its SCENARIO_TOKENS,
 * scripts/lib/parse-trigger.ts at f8be2dd). `nia_master` keeps its underscore: that site has no id
 * of its own for it. A token missing here is compared as it is.
 */
export const THEIR_SCENARIO_IDS: Readonly<Record<string, string>> = {
  hif: "hif",
  hif_memory: "hif",
  hajime_legend: "hajime-legend",
  hajime_legend_ssr: "hajime-legend",
  nia_master: "nia_master",
};
/** What every reason of their `held` list says when it is a scoring matter, not an unread effect. */
const SCORING_REASON = "no route profile number";

function difference(kind: Difference["kind"], name: string, where: readonly string[]): Difference[] {
  return where.length === 0 ? [] : [{ kind, name, count: where.length, examples: where.slice(0, 5) }];
}

/** JSON with every object's keys in order, so two values compare equal whatever order their keys were written in. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function asTheirTrigger(trigger: ParsedTrigger, mapped: string[], where: string): ParsedTrigger {
  if (trigger.scenario === undefined) return trigger;
  const theirs = THEIR_SCENARIO_IDS[trigger.scenario] ?? trigger.scenario;
  if (theirs !== trigger.scenario) mapped.push(`${where}: ${trigger.scenario} → ${theirs}`);
  return { ...trigger, scenario: theirs };
}

/** The library's card with each scenario token replaced as gakumas-supportcards writes it; `mapped` collects what changed. */
export function asTheirCard(card: Card, mapped: string[]): Card {
  const out: Card = {
    ...card,
    breakpoints: card.breakpoints.map((bp) => ({
      ...bp,
      effects: bp.effects.map((e) => (e.trigger === undefined ? e : { ...e, trigger: asTheirTrigger(e.trigger, mapped, `${card.id} level ${bp.minLevel}`) })),
    })),
  };
  if (card.items !== undefined) {
    out.items = card.items.map((grant) => (grant.drinks === undefined ? grant : { ...grant, drinks: { ...grant.drinks, trigger: asTheirTrigger(grant.drinks.trigger, mapped, `${card.id} item ${grant.itemId}`) } }));
  }
  return out;
}

function supportCards(theirs: TheirCards, ours: SupportCardsFile): Difference[] {
  const oursById = new Map(ours.cards.map((c) => [c.id, c]));
  const theirIds = new Set(theirs.cards.map((c) => c.id));
  const missing: string[] = [];
  const differs: string[] = [];
  const mapped: string[] = [];
  for (const their of theirs.cards) {
    const our = oursById.get(their.id);
    if (our === undefined) missing.push(`${their.id} ${their.name}`);
    else if (canonical(asTheirCard(our, mapped)) !== canonical(their)) differs.push(`${their.id} ${their.name}`);
  }
  return [
    ...difference("unexpected", "level limits differ", canonical(theirs.levelLimits) === canonical(ours.levelLimits) ? [] : [canonical(ours.levelLimits)]),
    ...difference("unexpected", "support cards missing here", missing),
    ...difference("unexpected", "support cards that differ", differs),
    ...difference("expected", "support cards only here (gakumas-supportcards is an update behind)", ours.cards.filter((c) => !theirIds.has(c.id)).map((c) => `${c.id} ${c.name}`)),
    ...difference("expected", "scenario tokens that site writes as its own ids", mapped),
  ];
}

/** Their `held` list against the library's `unread`: every held reason is an unread effect here or a scoring reason, and every unread effect is held there. */
function held(theirs: TheirCards, ours: SupportCardsFile): Difference[] {
  const key = (cardId: string, reason: string): string => `${cardId}\n${reason}`;
  const unread = new Set(ours.unread.map((u) => key(u.cardId, u.reason)));
  const theirReasons = new Set(theirs.held.flatMap((h) => h.reasons.map((r) => key(h.id, r))));
  const theirIds = new Set(theirs.cards.map((c) => c.id));
  const unexplained: string[] = [];
  const scoring: string[] = [];
  for (const h of theirs.held) {
    for (const reason of h.reasons) {
      if (unread.has(key(h.id, reason))) continue;
      (reason.includes(SCORING_REASON) ? scoring : unexplained).push(`${h.id}: ${reason}`);
    }
  }
  const notHeld = ours.unread.filter((u) => theirIds.has(u.cardId) && !theirReasons.has(key(u.cardId, u.reason))).map((u) => `${u.cardId}: ${u.reason}`);
  return [
    ...difference("unexpected", "held there for an effect that is not unread here", unexplained),
    ...difference("unexpected", "unread here but not held there", notHeld),
    ...difference("expected", "held there for a scoring reason (the library has no held list)", scoring),
  ];
}

function idols(theirs: TheirSkillCards, ours: IdolsFile): Difference[] {
  return difference("unexpected", "the idol list differs", canonical(theirs.idols) === canonical(ours.idols) ? [] : [`theirs ${theirs.idols.map((i) => i.id).join(",")}; ours ${ours.idols.map((i) => i.id).join(",")}`]);
}

function skillCards(theirs: TheirSkillCards, ours: SkillCardsFile): Difference[] {
  const key = (c: { id: string; upgrade: number }): string => `${c.id} level ${c.upgrade}`;
  const oursByKey = new Map(ours.cards.map((c) => [key(c), c]));
  const theirKeys = new Set(theirs.cards.map(key));
  const missing: string[] = [];
  const differs: string[] = [];
  for (const their of theirs.cards) {
    const our = oursByKey.get(key(their));
    if (our === undefined) {
      missing.push(key(their));
      continue;
    }
    const { origin: _onlyHere, ...shared } = our;
    if (canonical(shared) !== canonical(their)) differs.push(key(their));
  }
  return [
    ...difference("unexpected", "skill cards missing here", missing),
    ...difference("unexpected", "skill cards that differ", differs),
    ...difference("expected", "skill cards only here (that site publishes one app's pool)", ours.cards.filter((c) => !theirKeys.has(key(c))).map(key)),
  ];
}

function hifAbilities(theirs: TheirSkillCards, ours: SkillCardsFile): Difference[] {
  const oursById = new Map(ours.memoryAbilities.map((a) => [a.id, a]));
  const theirIds = new Set(theirs.hifAbilities.map((a) => a.id));
  const wrong = theirs.hifAbilities.filter((their) => {
    const our = oursById.get(their.id);
    return our === undefined || our.card !== their.card || !our.groups.includes(HIF_PRODUCE_GROUP);
  });
  return [
    ...difference("unexpected", "H.I.F. abilities missing or different here", wrong.map((a) => `${a.id} → ${a.card}`)),
    ...difference("expected", "memory abilities only here (that site publishes H.I.F.'s, of its pool)", ours.memoryAbilities.filter((a) => !theirIds.has(a.id)).map((a) => a.id)),
  ];
}

/** Every P-item a support card grants, on either site, is in the items file with the same name and icon. */
function grantedItems(theirs: TheirCards, ours: Ours): Difference[] {
  const items = new Map(ours.items.items.map((i) => [i.id, i]));
  const wrong = new Set<string>();
  for (const card of [...theirs.cards, ...ours.supportCards.cards]) {
    for (const grant of card.items ?? []) {
      const item = items.get(grant.itemId);
      if (item === undefined || item.name !== grant.itemName || item.assetId !== grant.assetId) wrong.add(`${grant.itemId} ${grant.itemName} (granted by ${card.id})`);
    }
  }
  return difference("unexpected", "granted items missing from the items file, or with another name or icon", [...wrong]);
}

export function compare(theirs: Theirs, ours: Ours): Difference[] {
  return [
    ...supportCards(theirs.cards, ours.supportCards),
    ...held(theirs.cards, ours.supportCards),
    ...idols(theirs.skillCards, ours.idols),
    ...skillCards(theirs.skillCards, ours.skillCards),
    ...hifAbilities(theirs.skillCards, ours.skillCards),
    ...grantedItems(theirs.cards, ours),
  ];
}
