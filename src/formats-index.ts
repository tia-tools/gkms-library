/** Each data format's check, by name and version: what a release must pass to be published or compared. */

import { parse as parseIdols } from "../formats/idols.v1.ts";
import { parse as parseItems } from "../formats/items.v1.ts";
import { parse as parseSkillCards } from "../formats/skill-cards.v1.ts";
import { parse as parseSupportCards } from "../formats/support-cards.v1.ts";
import type { FormatName } from "./release.ts";

const CHECKS: Readonly<Record<string, (data: unknown) => unknown>> = {
  "idols v1": parseIdols,
  "items v1": parseItems,
  "skill-cards v1": parseSkillCards,
  "support-cards v1": parseSupportCards,
};

/** Checks `text` as a release of `format` at `formatVersion`; throws naming the bad value, or the format it does not know. */
export function checkRelease(format: FormatName, formatVersion: number, text: string): void {
  const check = CHECKS[`${format} v${formatVersion}`];
  if (check === undefined) throw new Error(`no check for ${format} v${formatVersion}`);
  check(JSON.parse(text));
}
