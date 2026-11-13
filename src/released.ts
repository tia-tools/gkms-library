/**
 * Whether a row of the game's tables is released: the library publishes nothing the game has not
 * shown yet (docs/adr/0001, docs/adr/0002). Pure: the clock is passed in.
 */

/** True when `viewStartTime` is "0" (always) or epoch milliseconds not later than `now`; anything else throws, naming `where`. */
export function isReleased(viewStartTime: string, now: number, where: string): boolean {
  if (viewStartTime === "0") return true;
  if (!/^\d+$/.test(viewStartTime)) throw new Error(`${where}: viewStartTime "${viewStartTime}" is neither "0" nor epoch milliseconds`);
  return Number(viewStartTime) <= now;
}
