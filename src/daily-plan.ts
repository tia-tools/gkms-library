/**
 * The unattended run, as a plan: its steps in order, and the report it ends with. Pure
 * (docs/plans/EXECPLAN_LIBRARY_ALONE.md, L22, L23, L25, L26).
 *
 * The order is the design. Everything is generated and checked first; then the images, each master
 * before its public copy; then the data, whose pointer goes last; then the comparison, which may
 * fail the run's report but comes after the publication and so can never hold it back.
 */

export interface Step {
  name: string;
  command: readonly string[];
  /** Relative to the repository root. */
  cwd: string;
  /** A step that publishes: its failure leaves the last good pointer in place. */
  stopsTheRun: boolean;
}

export interface DailyOptions {
  address: string;
  dryRun: boolean;
  allowFewer: boolean;
}

export function dailySteps(o: DailyOptions): Step[] {
  const dry = o.dryRun ? ["--dry-run"] : [];
  const step = (name: string, command: readonly string[], cwd = "."): Step => ({ name, command, cwd, stopsTheRun: true });
  return [
    step("generate", ["bun", "src/generate.ts", "--previous", o.address, ...(o.allowFewer ? ["--allow-fewer"] : [])]),
    step("fetch the manifest tool", ["./fetch-vendor.sh"], "images"),
    step("install the image tools", ["uv", "sync", "--frozen"], "images"),
    step("extract images", ["uv", "run", "extract.py", "--base-url", o.address], "images"),
    step("upload images", ["uv", "run", "upload.py", "--base-url", o.address, ...dry], "images"),
    step("check the images are complete", ["bun", "src/daily.ts", "--check-images", ...dry]),
    step("publish", ["bun", "src/publish.ts", "--address", o.address, ...dry]),
    { ...step("compare", ["bun", "src/compare/main.ts", "--site", "out/site", "--images", "--address", o.address, "--summary", "out/compare-summary.json"]), stopsTheRun: false },
  ];
}

/** What extract.py and upload.py leave in out/images-summary.json. */
export interface ImagesSummary {
  extraction_complete?: unknown;
  upload_complete?: unknown;
  extracted?: unknown;
  uploaded?: unknown;
  still_not_offered?: unknown;
}

/**
 * Why the data must not be published yet, or null when the images are complete: every image the
 * data names and the game offers is stored. A dry run uploads nothing, so only the extraction counts.
 */
export function imagesIncomplete(summary: ImagesSummary, dryRun: boolean): string | null {
  if (summary.extraction_complete !== true) return "the image extraction did not look at all the images, or one failed (extraction_complete is not true)";
  if (!dryRun && summary.upload_complete !== true) return "the image upload left images out (upload_complete is not true)";
  return null;
}

export interface Report {
  /** The first step that failed, or null. */
  failedStep: string | null;
  dryRun: boolean;
  /** Formats that got a new release, as `idols v1: 13`. */
  newReleases: readonly string[];
  /** Keys uploaded by the publication. */
  published: readonly string[];
  images: { extracted: number; uploaded: number; notOffered: readonly string[] };
  /** The comparison's unexpected differences, as `3 × name`; null when it did not run. */
  unexpected: readonly string[] | null;
}

/**
 * What the comparison found, for the report: null when it did not run, its unexpected differences
 * when it ran to the end, and one line saying so when it stopped without finishing. A comparison
 * that crashed has found nothing, which is not the same as finding no difference.
 */
export function comparisonOutcome(ran: boolean, exitedZero: boolean, unexpected: readonly string[]): readonly string[] | null {
  if (!ran) return null;
  if (!exitedZero && unexpected.length === 0) return ["the comparison stopped before it finished"];
  return unexpected;
}

const count = (value: unknown): number => (typeof value === "number" ? value : 0);
const names = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

export function imagesOf(summary: ImagesSummary): Report["images"] {
  return { extracted: count(summary.extracted), uploaded: count(summary.uploaded), notOffered: names(summary.still_not_offered) };
}

/** True when the run's report must reach a person whatever else: something failed, or the comparison found a difference. */
export function failed(report: Report): boolean {
  return report.failedStep !== null || (report.unexpected !== null && report.unexpected.length > 0);
}

/** Anything changed at the address. */
export function publishedAnything(report: Report): boolean {
  return report.published.length > 0 || report.images.uploaded > 0;
}

/** The report's title and body, for the notification and the run's log. */
export function describe(report: Report): { title: string; body: string } {
  const what = report.failedStep !== null ? `failed at "${report.failedStep}"` : report.dryRun ? "dry run" : publishedAnything(report) ? "published" : "nothing new";
  const difference = report.unexpected !== null && report.unexpected.length > 0 ? ", comparison differs" : "";
  const lines = [
    report.newReleases.length > 0 ? `New releases: ${report.newReleases.join("; ")}` : "No new release.",
    `Images: ${report.images.extracted} extracted, ${report.images.uploaded} uploaded${report.images.notOffered.length > 0 ? `, ${report.images.notOffered.length} not offered by the game yet (${report.images.notOffered.slice(0, 3).join(", ")}${report.images.notOffered.length > 3 ? ", …" : ""})` : ""}.`,
    report.unexpected === null ? "Comparison with gakumas-supportcards: not run." : report.unexpected.length === 0 ? "Comparison with gakumas-supportcards: no unexpected difference." : `Comparison with gakumas-supportcards: ${report.unexpected.join("; ")}`,
  ];
  if (report.failedStep !== null) lines.unshift(`The step "${report.failedStep}" failed; the pointer still names the last good releases.`);
  return { title: `Library update: ${what}${difference}`, body: lines.join("\n") };
}
