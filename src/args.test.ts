import { describe, expect, test } from "bun:test";
import { hasFlag, option } from "./args.ts";

describe("command line arguments", () => {
  test("a flag is present or not", () => {
    expect(hasFlag(["--allow-fewer"], "allow-fewer")).toBe(true);
    expect(hasFlag(["--out", "x"], "allow-fewer")).toBe(false);
  });

  test("an option gives the value after its name, or the fallback", () => {
    expect(option(["--site", "out/site", "--images"], "site", "default")).toBe("out/site");
    expect(option([], "site", "default")).toBe("default");
  });

  test("an option named without a value stops the command", () => {
    expect(() => option(["--site"], "site", "default")).toThrow("--site needs a value");
    expect(() => option(["--site", "--images"], "site", "default")).toThrow("--site needs a value");
  });
});
