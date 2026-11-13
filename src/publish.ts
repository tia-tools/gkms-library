/**
 * Publishes what the output directory holds and the public address lacks: the format files, the
 * releases the pointer names, and the pointer last. Then reads the pointer and every release back
 * from the address and checks them.
 *
 * Usage: bun run publish [--out out/site] [--address https://gkms-library.tia.run] [--dry-run]
 *
 * A format file or a release already at the address is never replaced. `--dry-run` prints what
 * would be uploaded and uploads nothing (docs/plans/EXECPLAN_LIBRARY_ALONE.md, L18, L22).
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseLatest } from "../formats/latest.v1.ts";
import { hasFlag, option } from "./args.ts";
import { writeIfDifferent } from "./files.ts";
import { checkRelease } from "./formats-index.ts";
import { planPublication, publicationKeys } from "./publish-plan.ts";
import { put } from "./r2.ts";
import { pointerText, sha256Hex } from "./release.ts";
import { POINTER_PATH, readSiteText } from "./site.ts";

export const DEFAULT_ADDRESS = "https://gkms-library.tia.run";
/** What this run uploaded, for the daily run's report; written beside the output directory, never published. */
export const PUBLISH_SUMMARY = "publish-summary.json";

/**
 * Reads back from the address everything a publication is made of: each format file must be the
 * local text, the pointer the one just published, and every release it names must hash as named
 * and pass its format.
 */
async function verify(address: string, out: string, formatFiles: readonly string[]): Promise<void> {
  for (const name of formatFiles) {
    if ((await readSiteText(address, `formats/${name}`)) !== readFileSync(join(out, "formats", name), "utf8")) throw new Error(`${address}/formats/${name} is not the format file in ${out}`);
  }
  const text = await readSiteText(address, POINTER_PATH);
  if (text === null) throw new Error(`${address}/${POINTER_PATH} is not there after publication`);
  const pointer = parseLatest(JSON.parse(text));
  if (pointerText(pointer) !== readFileSync(join(out, POINTER_PATH), "utf8")) throw new Error(`${address}/${POINTER_PATH} is not the pointer just published`);
  for (const file of pointer.files) {
    const release = await readSiteText(address, file.path);
    if (release === null) throw new Error(`${address}/${file.path} is named by the pointer and is not there`);
    if (sha256Hex(release) !== file.sha256) throw new Error(`${address}/${file.path} does not hash as the pointer says`);
    checkRelease(file.format, file.formatVersion, release);
  }
}

async function main(argv: readonly string[]): Promise<void> {
  const out = option(argv, "out", "out/site");
  const address = option(argv, "address", DEFAULT_ADDRESS);
  const dryRun = hasFlag(argv, "dry-run");

  const pointer = parseLatest(JSON.parse(readFileSync(join(out, POINTER_PATH), "utf8")));
  const formatFiles = readdirSync(join(out, "formats")).filter((name) => /^[a-z-]+\.v\d+\.ts$/.test(name));
  const local = (key: string): string => readFileSync(join(out, key), "utf8");
  // Every release is checked once more as it is on disk, and the address is asked about every key, before the first upload.
  for (const file of pointer.files) {
    const text = local(file.path);
    if (sha256Hex(text) !== file.sha256) throw new Error(`${join(out, file.path)} does not hash as the pointer says`);
    checkRelease(file.format, file.formatVersion, text);
  }
  const keys = publicationKeys(pointer, formatFiles);
  const answers = await Promise.all(keys.map(async (key): Promise<[string, string | null]> => [key, await readSiteText(address, key)]));
  const uploads = planPublication({ pointer, formatFiles, local, remote: new Map(answers) });

  console.log(`${keys.length - uploads.length} file(s) already at ${address}, ${uploads.length} to upload`);
  for (const upload of uploads) {
    if (dryRun) {
      console.log("would upload", upload.key);
      continue;
    }
    await put({ ...upload, file: join(out, upload.key) });
    console.log("uploaded", upload.key);
  }
  if (dryRun) return;
  await verify(address, out, formatFiles);
  console.log(`${address}/${POINTER_PATH}, the ${pointer.files.length} release(s) it names and the ${formatFiles.length} format file(s) read back and checked`);
  writeIfDifferent(join(out, "..", PUBLISH_SUMMARY), `${JSON.stringify({ uploaded: uploads.map((u) => u.key) }, null, 2)}\n`);
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
