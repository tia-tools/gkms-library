/**
 * The unattended run, twice a day: generate, the images, the publication, the comparison
 * (src/daily-plan.ts has the order and why). It ends by writing out/daily-summary.json, which the
 * workflow reports through nudge.
 *
 * Usage: bun run daily [--dry-run] [--allow-fewer] [--address https://gkms-library.tia.run]
 *
 * `--dry-run` does everything but upload: it generates, extracts, and prints what the image upload
 * and the publication would send. Exit 1 when a step failed or the comparison found an unexpected
 * difference; the publication, once made, stands either way.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { hasFlag, option } from "./args.ts";
import { dailySteps, describe, failed, imagesIncomplete, imagesOf, type ImagesSummary, type Report, type Step } from "./daily-plan.ts";
import { writeIfDifferent } from "./files.ts";
import { GENERATE_SUMMARY } from "./generate.ts";
import { DEFAULT_ADDRESS, PUBLISH_SUMMARY } from "./publish.ts";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "out");
export const DAILY_SUMMARY = "daily-summary.json";
const COMPARE_SUMMARY = "compare-summary.json";
/** Left by an earlier run; this run's report must not read them as its own. */
const STEP_SUMMARIES = [GENERATE_SUMMARY, PUBLISH_SUMMARY, COMPARE_SUMMARY, "images-summary.json"];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function readJson(name: string): Record<string, unknown> {
  const path = join(OUT, name);
  if (!existsSync(path)) return {};
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  return isRecord(value) ? value : {};
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

function newReleases(): string[] {
  const fresh = readJson(GENERATE_SUMMARY)["fresh"];
  return Array.isArray(fresh) ? fresh.filter(isRecord).map((f) => `${String(f["format"])} v1: ${String(f["entries"])}`) : [];
}

function reportOf(failedStep: string | null, dryRun: boolean, compared: boolean): Report {
  const images: ImagesSummary = readJson("images-summary.json");
  return {
    failedStep,
    dryRun,
    newReleases: newReleases(),
    published: strings(readJson(PUBLISH_SUMMARY)["uploaded"]),
    images: imagesOf(images),
    unexpected: compared ? strings(readJson(COMPARE_SUMMARY)["unexpected"]) : null,
  };
}

async function run(step: Step): Promise<boolean> {
  console.log(`\n== ${step.name}: ${step.command.join(" ")}`);
  const code = await Bun.spawn([...step.command], { cwd: join(ROOT, step.cwd), stdout: "inherit", stderr: "inherit" }).exited;
  return code === 0;
}

/** The step between the images and the publication: stops unless the images are complete. */
function checkImages(dryRun: boolean): void {
  const why = imagesIncomplete(readJson("images-summary.json"), dryRun);
  if (why !== null) {
    console.error(`Not publishing: ${why}.`);
    process.exit(1);
  }
  console.log("every image the data names and the game offers is stored");
}

async function main(argv: readonly string[]): Promise<void> {
  const dryRun = hasFlag(argv, "dry-run");
  if (hasFlag(argv, "check-images")) return checkImages(dryRun);

  for (const name of STEP_SUMMARIES) writeIfDifferent(join(OUT, name), "{}\n");
  let failedStep: string | null = null;
  let compared = false;
  for (const step of dailySteps({ address: option(argv, "address", DEFAULT_ADDRESS), dryRun, allowFewer: hasFlag(argv, "allow-fewer") })) {
    const ok = await run(step);
    if (step.name === "compare") compared = true;
    if (!ok && step.stopsTheRun) {
      failedStep = step.name;
      break;
    }
  }
  const report = reportOf(failedStep, dryRun, compared);
  const { title, body } = describe(report);
  writeIfDifferent(join(OUT, DAILY_SUMMARY), `${JSON.stringify({ title, body, failed: failed(report), published: report.published.length > 0 || report.images.uploaded > 0 }, null, 2)}\n`);
  console.log(`\n${title}\n${body}`);
  if (failed(report)) process.exit(1);
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
