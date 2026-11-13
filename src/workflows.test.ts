/**
 * The workflows cannot be run locally, so the properties that make them safe are pinned here: what
 * triggers them, what each job may do and which secrets it sees, that the released branch is what
 * runs, and that no step splices an expression into a shell script.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { load } from "js-yaml";

interface Step {
  name?: string;
  id?: string;
  if?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
}
interface Job {
  steps?: Step[];
  needs?: string | string[];
  if?: string;
  permissions?: Record<string, string>;
}
interface Workflow {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<string, Job>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isJob = (value: unknown): value is Job => isRecord(value) && (value["steps"] === undefined || (Array.isArray(value["steps"]) && value["steps"].every(isRecord)));
const isWorkflow = (value: unknown): value is Workflow => isRecord(value) && isRecord(value["on"]) && isRecord(value["permissions"]) && isRecord(value["jobs"]) && Object.values(value["jobs"]).every(isJob);

const DIR = ".github/workflows";
function read(name: string): { text: string; wf: Workflow } {
  const text = readFileSync(`${DIR}/${name}`, "utf8");
  const wf = load(text);
  if (!isWorkflow(wf)) throw new Error(`${name} does not have the shape of a workflow`);
  return { text, wf };
}
const FILES = readdirSync(DIR).filter((name) => /\.ya?ml$/.test(name));
const stepsOf = (wf: Workflow, job: string): Step[] => wf.jobs[job]?.steps ?? [];
const allSteps = (wf: Workflow): Step[] => Object.values(wf.jobs).flatMap((job) => job.steps ?? []);

/** The actions a workflow may use. Each must be pinned to a full commit hash: a tag can be moved to other code, a commit cannot. */
const ALLOWED_ACTIONS = ["actions/checkout", "oven-sh/setup-bun", "astral-sh/setup-uv", "Taka499/nudge/actions/notify"];
const PINNED = /^([^@\s]+)@[0-9a-f]{40}$/;

describe("every workflow", () => {
  test("there are workflows to check", () => {
    expect(FILES.toSorted()).toEqual(["check.yml", "update.yml"]);
  });

  test("uses only allowed actions, each pinned to a full commit hash", () => {
    for (const file of FILES) {
      for (const step of allSteps(read(file).wf)) {
        if (step.uses === undefined) continue;
        const match = PINNED.exec(step.uses);
        expect(`${file}: ${step.uses} pinned: ${match !== null}`).toBe(`${file}: ${step.uses} pinned: true`);
        expect(ALLOWED_ACTIONS).toContain(match?.[1] ?? "");
      }
    }
  });

  test("never splices an expression into a shell script: a value reaches a script through env", () => {
    for (const file of FILES) {
      for (const step of allSteps(read(file).wf)) expect(`${file}: ${step.run ?? ""}`).not.toContain("${{");
    }
  });

  test("states at its top what it guards", () => {
    for (const file of FILES) expect(read(file).text.startsWith("# Guards: ")).toBe(true);
  });
});

describe("check.yml", () => {
  const { text, wf } = read("check.yml");

  test("runs on pull requests into develop, read-only, with no secret", () => {
    expect(wf.on).toEqual({ pull_request: { branches: ["develop"] } });
    expect(wf.permissions).toEqual({ contents: "read" });
    expect(text).not.toContain("secrets.");
    expect(text).not.toContain("id-token");
  });

  test("runs the tests, the type check, the lint and the image pipeline's tests", () => {
    const runs = stepsOf(wf, "check").map((s) => s.run ?? "");
    for (const command of ["bun test", "bun run type-check", "bun run lint"]) expect(runs).toContain(command);
    expect(runs.some((run) => run.includes("uv sync --frozen") && run.includes("uv run pytest"))).toBe(true);
  });
});

describe("update.yml", () => {
  const { text, wf } = read("update.yml");
  const update = stepsOf(wf, "update");
  const daily = update.find((s) => (s.run ?? "").includes("bun run daily"));

  test("runs twice a day in Japan's time and by hand, and nothing else starts it", () => {
    expect(Object.keys(wf.on).toSorted()).toEqual(["schedule", "workflow_dispatch"]);
    expect(wf.on["schedule"]).toEqual([{ cron: "50 11 * * *", timezone: "Asia/Tokyo" }, { cron: "50 20 * * *", timezone: "Asia/Tokyo" }]);
  });

  test("grants nothing by default; the run may only read the repository, and only notify may mint an OIDC token", () => {
    expect(wf.permissions).toEqual({});
    expect(wf.jobs["update"]?.permissions).toEqual({ contents: "read" });
    expect(wf.jobs["notify"]?.permissions).toEqual({ "id-token": "write" });
  });

  test("runs the released branch, main, whatever branch the schedule's file is on", () => {
    const checkout = update.find((s) => (s.uses ?? "").startsWith("actions/checkout@"));
    expect(checkout?.with).toEqual({ ref: "main" });
    expect(update.indexOf(checkout ?? {})).toBe(0);
  });

  test("the whole run is one command, and the only step that sees the Cloudflare token", () => {
    expect(daily?.run?.split("\n").filter((line) => line.includes("bun run")).map((line) => line.trim())).toEqual(["bun run daily --allow-fewer", "bun run daily"]);
    expect(Object.keys(daily?.env ?? {}).toSorted()).toEqual(["ALLOW_FEWER", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]);
    expect(allSteps(wf).filter((s) => JSON.stringify(s).includes("secrets.")).map((s) => s.name)).toEqual([daily?.name]);
    expect(text.match(/secrets\.[A-Z_]+/g)?.toSorted()).toEqual(["secrets.CLOUDFLARE_ACCOUNT_ID", "secrets.CLOUDFLARE_API_TOKEN"]);
    for (const step of update) {
      for (const command of ["wrangler", "bun run publish", "src/publish", "upload.py", "extract.py", "bun run generate"]) if (step !== daily) expect(step.run ?? "").not.toContain(command);
    }
  });

  test("describes the run whatever happened, after the run", () => {
    const report = update.find((s) => s.id === "report");
    expect(report?.if).toBe("always()");
    expect(update.indexOf(report ?? {})).toBeGreaterThan(update.indexOf(daily ?? {}));
  });

  test("notify runs after the update whatever its result, and reports failure, publication, a run by hand, and Monday morning", () => {
    const notify = wf.jobs["notify"];
    expect(notify?.needs).toBe("update");
    expect(notify?.if).toBe("always()");
    const tell = stepsOf(wf, "notify").find((s) => (s.uses ?? "").startsWith("Taka499/nudge/actions/notify@"));
    for (const condition of ["needs.update.result != 'success'", "needs.update.outputs.published == 'true'", "github.event_name == 'workflow_dispatch'", "github.event.schedule == '50 11 * * *' && steps.when.outputs.weekday == '1'"]) {
      expect(tell?.if ?? "").toContain(condition);
    }
    expect(tell?.with?.["endpoint"]).toBe("https://nudge.tia.run");
  });

  test("allows one run at a time and never cancels one halfway", () => {
    expect(load(text)).toMatchObject({ concurrency: { group: "update", "cancel-in-progress": false } });
  });
});
