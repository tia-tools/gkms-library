import { describe, expect, test } from "bun:test";
import { put, putCommand, type PutRequest, RETRY_WAITS_MS } from "./r2.ts";

const REQUEST: PutRequest = { key: "data/latest.v1.json", file: "out/site/data/latest.v1.json", contentType: "application/json", cacheControl: "public, max-age=300" };

/** A fake Wrangler that fails the first `failures` calls; records each command and each wait. */
function wrangler(failures: number): { run: (command: readonly string[]) => Promise<number>; sleep: (ms: number) => Promise<void>; commands: string[][]; slept: number[] } {
  const commands: string[][] = [];
  const slept: number[] = [];
  return {
    commands,
    slept,
    run: async (command) => {
      commands.push([...command]);
      return commands.length <= failures ? 1 : 0;
    },
    sleep: async (ms) => {
      slept.push(ms);
    },
  };
}

describe("put", () => {
  test("is one wrangler put into the public bucket, with the content type and the Cache-Control stored with the object", () => {
    expect(putCommand(REQUEST)).toEqual(["bunx", "wrangler", "r2", "object", "put", "gkms-library/data/latest.v1.json", "--file", "out/site/data/latest.v1.json", "--content-type", "application/json", "--cache-control", "public, max-age=300", "--remote"]);
  });

  test("a put that succeeds runs once without waiting", async () => {
    const w = wrangler(0);
    await put(REQUEST, w.run, w.sleep);
    expect(w.commands).toHaveLength(1);
    expect(w.slept).toEqual([]);
  });

  test("a transient failure is tried again after each wait, with the same command", async () => {
    const w = wrangler(2);
    await put(REQUEST, w.run, w.sleep);
    expect(w.commands).toHaveLength(3);
    expect(new Set(w.commands.map((c) => c.join(" "))).size).toBe(1);
    expect(w.slept).toEqual([...RETRY_WAITS_MS]);
  });

  test("a put that keeps failing throws after its last attempt", async () => {
    const w = wrangler(99);
    expect(put(REQUEST, w.run, w.sleep)).rejects.toThrow("put data/latest.v1.json failed (exit 1) after 3 attempts");
    await Promise.resolve();
    expect(w.commands.length).toBeLessThanOrEqual(RETRY_WAITS_MS.length + 1);
  });
});
