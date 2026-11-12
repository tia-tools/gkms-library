/** Builds the idol list (formats/idols.v1.ts) from the Character table. Pure. */

import type { Idol } from "../../formats/idols.v1.ts";
import type { RawCharacter } from "../tables.ts";

/** The playable idols in the game's order; two sharing an order stop the run, since their order would be undefined. */
export function buildIdols(characters: readonly RawCharacter[]): Idol[] {
  const playable = characters.filter((c) => c.isPlayable).sort((a, b) => a.order - b.order);
  playable.forEach((c, i) => {
    const prev = playable[i - 1];
    if (prev !== undefined && prev.order === c.order) throw new Error(`Character ${prev.id} and ${c.id} share order ${c.order}; the idols' order would be undefined`);
  });
  return playable.map((c) => ({ id: c.id, name: `${c.lastName}${c.firstName}` }));
}
