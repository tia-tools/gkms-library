/**
 * Generates the data files from the game's tables and writes them as releases, with the pointer
 * and the format files, into a directory that mirrors the public bucket.
 *
 * Usage: bun run generate [--out out/site] [--previous <directory or address>] [--allow-fewer]
 *
 * `--previous` is the site whose pointer says what is already released: content that hashes as the
 * release it names gets no new release, and a format that would list fewer entries than that
 * release stops the run unless `--allow-fewer` is given (a real removal in the game). It defaults
 * to `--out`. Everything is built and checked before the first write, and the pointer is written
 * last: a run that stops before then leaves the pointer naming the last good releases, and at
 * worst some release files nothing names (docs/plans/EXECPLAN_LIBRARY_ALONE.md, L18, L22, L24).
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { hasFlag, option } from "./args.ts";
import { buildAll } from "./build-all.ts";
import { writeIfDifferent, writeRelease } from "./files.ts";
import { fewerEntries, nextPointer, pointerText } from "./release.ts";
import { POINTER_PATH, readPointer } from "./site.ts";
import { loadItemFacts, loadSkillCardTables, loadTables } from "./tables.ts";

const FORMATS_DIR = join(import.meta.dirname, "..", "formats");
/** What this run did, for the daily run's report; written beside the output directory, never published. */
export const GENERATE_SUMMARY = "generate-summary.json";

/** Copies the format files (not their tests) to `<out>/formats/`, as they are published beside the data. */
function copyFormats(out: string): void {
  for (const name of readdirSync(FORMATS_DIR)) {
    if (/^[a-z-]+\.v\d+\.ts$/.test(name)) writeIfDifferent(join(out, "formats", name), readFileSync(join(FORMATS_DIR, name), "utf8"));
  }
}

async function main(argv: readonly string[]): Promise<void> {
  const out = option(argv, "out", "out/site");
  const previousSite = option(argv, "previous", out);
  const now = new Date();

  const [tables, skillCardTables, itemFacts] = await Promise.all([loadTables(), loadSkillCardTables(), loadItemFacts()]);
  const all = buildAll({ tables, skillCardTables, itemFacts }, now.getTime());
  const previous = await readPointer(previousSite);

  const fewer = fewerEntries(previous, all.built);
  if (fewer.length > 0 && !hasFlag(argv, "allow-fewer")) {
    for (const line of fewer) console.error(line);
    console.error("Nothing written. Rerun with --allow-fewer if this is a real removal in the game.");
    process.exit(1);
  }

  // Every text exists before the first write; the pointer goes last.
  // Every release the pointer names is written here, new or not, so the directory is a whole
  // mirror of what the pointer names: the image steps and the publication read it.
  const { pointer, fresh, named } = nextPointer(previous, all.built, now);
  for (const f of named) writeRelease(join(out, f.entry.path), f.text);
  copyFormats(out);
  const pointerMoved = writeIfDifferent(join(out, POINTER_PATH), pointerText(pointer));

  for (const line of all.lines) {
    const format = line.slice(0, line.indexOf(" "));
    const release = fresh.find((f) => f.format === format);
    console.log(`${line} — ${release ? `new release ${release.entry.release}` : "unchanged"}`);
  }
  for (const u of all.unread) console.log(`  UNREAD ${u.cardId} ${u.cardName} — ${u.reason}`);
  console.log(pointerMoved ? `wrote ${join(out, POINTER_PATH)}` : "pointer unchanged");
  writeIfDifferent(join(out, "..", GENERATE_SUMMARY), `${JSON.stringify({ lines: all.lines, fresh: fresh.map((f) => ({ format: f.format, release: f.entry.release, entries: f.entries })), unread: all.unread.length }, null, 2)}\n`);
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
