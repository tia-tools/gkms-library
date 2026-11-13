/**
 * Compares what the library publishes with what gakumas-supportcards publishes today, and exits 1
 * on a difference that is not expected (docs/plans/EXECPLAN_LIBRARY_ALONE.md, L6 step 1, L26).
 *
 * Usage: bun run compare --site <directory or address> [--theirs <directory or address>]
 *                        [--images] [--address https://gkms-library.tia.run] [--summary <file>]
 *
 * `--site` is the library's side: out/site, or https://gkms-library.tia.run. `--theirs` defaults to
 * the live site. `--images` also asks the library's address for the card art and the item icon of
 * everything gakumas-supportcards' data names, under the names that site serves them by.
 */

import { parse as parseIdols } from "../../formats/idols.v1.ts";
import { parse as parseItems } from "../../formats/items.v1.ts";
import type { Latest } from "../../formats/latest.v1.ts";
import { parse as parseSkillCards } from "../../formats/skill-cards.v1.ts";
import { parse as parseSupportCards } from "../../formats/support-cards.v1.ts";
import { writeFileSync } from "node:fs";
import { hasFlag, option } from "../args.ts";
import type { FormatName } from "../release.ts";
import { readPointer, readSiteText } from "../site.ts";
import { compare, type Difference, missingImages, theirImagePaths, type Ours, type Theirs } from "./compare.ts";
import { parseTheirCards, parseTheirSkillCards, THEIR_BASE, THEIR_CARDS_PATH, THEIR_SKILL_CARDS_PATH } from "./theirs.ts";

async function mustRead(site: string, path: string): Promise<unknown> {
  const text = await readSiteText(site, path);
  if (text === null) throw new Error(`${site}/${path} is not there`);
  return JSON.parse(text);
}

async function release(site: string, pointer: Latest, format: FormatName): Promise<unknown> {
  const file = pointer.files.find((f) => f.format === format && f.formatVersion === 1);
  if (file === undefined) throw new Error(`${site}: the pointer names no release of ${format} v1`);
  return mustRead(site, file.path);
}

async function readOurs(site: string): Promise<Ours> {
  const pointer = await readPointer(site);
  if (pointer === null) throw new Error(`${site} has no pointer; run \`bun run generate\` first`);
  const [supportCards, skillCards, idols, items] = await Promise.all([release(site, pointer, "support-cards"), release(site, pointer, "skill-cards"), release(site, pointer, "idols"), release(site, pointer, "items")]);
  return { supportCards: parseSupportCards(supportCards), skillCards: parseSkillCards(skillCards), idols: parseIdols(idols), items: parseItems(items) };
}

async function readTheirs(site: string): Promise<Theirs> {
  const [cards, skillCards] = await Promise.all([mustRead(site, THEIR_CARDS_PATH), mustRead(site, THEIR_SKILL_CARDS_PATH)]);
  return { cards: parseTheirCards(cards), skillCards: parseTheirSkillCards(skillCards) };
}

/** The paths the address does not serve, asked sixteen at a time; only 200 and 404 are answers. */
async function notServed(address: string, paths: readonly string[]): Promise<string[]> {
  const missing: string[] = [];
  const run = String(Date.now());
  for (let i = 0; i < paths.length; i += 16) {
    const answers = await Promise.all(
      paths.slice(i, i + 16).map(async (path): Promise<[string, number]> => [path, (await fetch(`${address.replace(/\/$/, "")}/${path}?run=${run}`, { method: "HEAD" })).status]),
    );
    for (const [path, status] of answers) {
      if (status === 404) missing.push(path);
      else if (status !== 200) throw new Error(`${address}/${path}: HTTP ${status}`);
    }
  }
  return missing;
}

async function main(argv: readonly string[]): Promise<void> {
  const site = option(argv, "site", "out/site");
  const [theirs, ours] = await Promise.all([readTheirs(option(argv, "theirs", THEIR_BASE)), readOurs(site)]);
  const differences: Difference[] = compare(theirs, ours);
  if (hasFlag(argv, "images")) differences.push(...missingImages(await notServed(option(argv, "address", "https://gkms-library.tia.run"), theirImagePaths(theirs.cards))));
  for (const d of differences) {
    console.log(`${d.kind === "expected" ? "expected  " : "UNEXPECTED"} ${d.count} × ${d.name}`);
    if (d.kind === "unexpected") for (const example of d.examples) console.log(`             ${example}`);
  }
  const unexpected = differences.filter((d) => d.kind === "unexpected");
  // For the daily run's report: `--summary <file>`.
  const summary = option(argv, "summary", "");
  if (summary !== "") writeFileSync(summary, `${JSON.stringify({ unexpected: unexpected.map((d) => `${d.count} × ${d.name}`), expected: differences.filter((d) => d.kind === "expected").map((d) => `${d.count} × ${d.name}`) }, null, 2)}\n`);
  if (unexpected.length > 0) {
    console.log(`${unexpected.length} unexpected kind(s) of difference between ${site} and gakumas-supportcards`);
    process.exit(1);
  }
  console.log("no unexpected difference");
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
