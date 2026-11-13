import { describe as group, expect, test } from "bun:test";
import { dailySteps, describe, failed, imagesIncomplete, imagesOf, publishedAnything, type Report } from "./daily-plan.ts";

const ADDRESS = "https://gkms-library.tia.run";
const steps = (over: Partial<Parameters<typeof dailySteps>[0]> = {}) => dailySteps({ address: ADDRESS, dryRun: false, allowFewer: false, ...over });
const at = (name: string): number => steps().findIndex((s) => s.name === name);
const commandOf = (name: string, over = {}): string => steps(over).find((s) => s.name === name)?.command.join(" ") ?? "";

function report(over: Partial<Report> = {}): Report {
  return { failedStep: null, dryRun: false, newReleases: [], published: [], images: { extracted: 0, uploaded: 0, notOffered: [] }, unexpected: [], ...over };
}

group("the daily run's order", () => {
  test("is generate, the images, the completeness check, the publication, and the comparison last", () => {
    expect(steps().map((s) => s.name)).toEqual(["generate", "fetch the manifest tool", "install the image tools", "extract images", "upload images", "check the images are complete", "publish", "compare"]);
  });

  test("nothing is uploaded before the data is generated and checked, and the data goes out only after the images are complete", () => {
    expect(at("generate")).toBeLessThan(at("upload images"));
    expect(at("extract images")).toBeLessThan(at("upload images"));
    expect(at("upload images")).toBeLessThan(at("check the images are complete"));
    expect(at("check the images are complete")).toBeLessThan(at("publish"));
  });

  test("the comparison comes after the publication and is the only step that does not stop the run", () => {
    expect(at("publish")).toBeLessThan(at("compare"));
    expect(steps().filter((s) => !s.stopsTheRun).map((s) => s.name)).toEqual(["compare"]);
  });

  test("generate reads what is released from the address, and takes --allow-fewer only when asked", () => {
    expect(commandOf("generate")).toBe(`bun src/generate.ts --previous ${ADDRESS}`);
    expect(commandOf("generate", { allowFewer: true })).toBe(`bun src/generate.ts --previous ${ADDRESS} --allow-fewer`);
  });

  test("the image steps run in images/, and a dry run uploads and publishes nothing", () => {
    expect(steps().filter((s) => s.cwd === "images").map((s) => s.name)).toEqual(["fetch the manifest tool", "install the image tools", "extract images", "upload images"]);
    expect(commandOf("upload images", { dryRun: true })).toContain("--dry-run");
    expect(commandOf("publish", { dryRun: true })).toContain("--dry-run");
    expect(commandOf("upload images")).not.toContain("--dry-run");
    expect(commandOf("publish")).toBe(`bun src/publish.ts --address ${ADDRESS}`);
    expect(steps().some((s) => s.command.includes("--limit") || s.command.includes("--only") || s.command.includes("--assume-empty"))).toBe(false);
  });
});

group("the images must be complete before the data is published", () => {
  test("complete when the extraction looked at everything and the upload left nothing out", () => {
    expect(imagesIncomplete({ extraction_complete: true, upload_complete: true }, false)).toBeNull();
  });

  test("not complete when either says anything but true, or the summary is missing", () => {
    expect(imagesIncomplete({ extraction_complete: false, upload_complete: true }, false)).toContain("extraction_complete");
    expect(imagesIncomplete({ extraction_complete: true, upload_complete: false }, false)).toContain("upload_complete");
    expect(imagesIncomplete({ extraction_complete: true }, false)).toContain("upload_complete");
    expect(imagesIncomplete({ extraction_complete: "true", upload_complete: true }, false)).toContain("extraction_complete");
    expect(imagesIncomplete({}, false)).toContain("extraction_complete");
  });

  test("a dry run uploads nothing, so only the extraction counts", () => {
    expect(imagesIncomplete({ extraction_complete: true }, true)).toBeNull();
    expect(imagesIncomplete({ upload_complete: true }, true)).toContain("extraction_complete");
  });

  test("the counts come from the summary, and what is not a number or a list counts as nothing", () => {
    expect(imagesOf({ extracted: 3, uploaded: 2, still_not_offered: ["a.webp", 7] })).toEqual({ extracted: 3, uploaded: 2, notOffered: ["a.webp"] });
    expect(imagesOf({})).toEqual({ extracted: 0, uploaded: 0, notOffered: [] });
  });
});

group("the report", () => {
  test("a quiet run says nothing is new, and is no failure", () => {
    expect(describe(report())).toEqual({ title: "Library update: nothing new", body: "No new release.\nImages: 0 extracted, 0 uploaded.\nComparison with gakumas-supportcards: no unexpected difference." });
    expect(failed(report())).toBe(false);
    expect(publishedAnything(report())).toBe(false);
  });

  test("a run that published names its releases and counts its images", () => {
    const r = report({ newReleases: ["support-cards v1: 213"], published: ["data/support-cards/v1/x.json", "data/latest.v1.json"], images: { extracted: 2, uploaded: 2, notOffered: [] } });
    expect(describe(r).title).toBe("Library update: published");
    expect(describe(r).body).toContain("New releases: support-cards v1: 213");
    expect(describe(r).body).toContain("Images: 2 extracted, 2 uploaded.");
    expect(publishedAnything(r)).toBe(true);
    expect(publishedAnything(report({ images: { extracted: 1, uploaded: 1, notOffered: [] } }))).toBe(true);
  });

  test("an image the game does not offer yet is named, at most three of them", () => {
    const body = describe(report({ images: { extracted: 0, uploaded: 0, notOffered: ["a.webp", "b.webp", "c.webp", "d.webp"] } })).body;
    expect(body).toContain("4 not offered by the game yet (a.webp, b.webp, c.webp, …)");
  });

  test("a failed step is named first, says the pointer did not move, and is a failure", () => {
    const r = report({ failedStep: "extract images", unexpected: null });
    expect(describe(r).title).toBe('Library update: failed at "extract images"');
    expect(describe(r).body.split("\n")[0]).toBe('The step "extract images" failed; the pointer still names the last good releases.');
    expect(describe(r).body).toContain("Comparison with gakumas-supportcards: not run.");
    expect(failed(r)).toBe(true);
  });

  test("an unexpected difference is a failure of the report, after a publication that stands", () => {
    const r = report({ published: ["data/latest.v1.json"], unexpected: ["1 × support cards that differ"] });
    expect(describe(r).title).toBe("Library update: published, comparison differs");
    expect(describe(r).body).toContain("Comparison with gakumas-supportcards: 1 × support cards that differ");
    expect(failed(r)).toBe(true);
  });

  test("a dry run says so", () => {
    expect(describe(report({ dryRun: true, newReleases: ["idols v1: 13"] })).title).toBe("Library update: dry run");
  });
});
