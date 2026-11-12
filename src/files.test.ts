import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeIfDifferent, writeRelease } from "./files.ts";

const dir = mkdtempSync(join(tmpdir(), "files-test-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("writeRelease", () => {
  test("writes a new release, creating its directories", () => {
    const path = join(dir, "data/idols/v1/a.json");
    writeRelease(path, "A");
    expect(readFileSync(path, "utf8")).toBe("A");
  });

  test("leaves a release with the same text alone, and never overwrites one with another text", () => {
    const path = join(dir, "data/idols/v1/b.json");
    writeRelease(path, "B");
    writeRelease(path, "B");
    expect(() => writeRelease(path, "other")).toThrow("b.json already exists with other content; a release is never overwritten");
    expect(readFileSync(path, "utf8")).toBe("B");
  });
});

describe("writeIfDifferent", () => {
  test("writes when the file is missing or holds other text, and says whether it wrote", () => {
    const path = join(dir, "data/latest.v1.json");
    expect(writeIfDifferent(path, "1")).toBe(true);
    expect(writeIfDifferent(path, "1")).toBe(false);
    expect(writeIfDifferent(path, "2")).toBe(true);
    expect(readFileSync(path, "utf8")).toBe("2");
  });
});
