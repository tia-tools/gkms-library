/**
 * The format files published at https://gkms-library.tia.run/formats/ on 2026-11-13 never change
 * again (docs/adr/0005): apps copy them verbatim, and the publication refuses to replace one. This
 * test fails on any edit to a published file, a comment included. A change of shape is a new file
 * with the next version number, added here when it is published; nothing is ever removed from this
 * list while the file is at the address.
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PUBLISHED: Readonly<Record<string, string>> = {
  "idols.v1.ts": "874674e7f66306213a7e632fdd5299122751ed63b69ac3115a556743b61e425a",
  "items.v1.ts": "8ed14d3197dfa987230086d4d1e9ed44fb8f671b870adafde56abd3bf972243f",
  "latest.v1.ts": "4100dc880a64eb53fc18f1defa3544583a331dcbc38514ea24047461ae0ae0a1",
  "skill-cards.v1.ts": "8829f9d1fa8550fc27299343b4de4019cc1b78fb8f30e1f1d3c6a8f6bada53c4",
  "support-cards.v1.ts": "a9b0c7a95e13f5b20adaa5e6597d69d1c073064dc71ff7520b6783cfbf89aaf1",
};

const sha256 = (name: string): string => createHash("sha256").update(readFileSync(join(import.meta.dirname, name))).digest("hex");

describe("published format files", () => {
  test("each is byte for byte what was published", () => {
    for (const [name, hash] of Object.entries(PUBLISHED)) expect(`${name} ${sha256(name)}`).toBe(`${name} ${hash}`);
  });

  test("every format file in the repository is on the list: a new one is pinned when it is published", () => {
    const files = readdirSync(import.meta.dirname).filter((name) => /^[a-z-]+\.v\d+\.ts$/.test(name));
    expect(files.toSorted()).toEqual(Object.keys(PUBLISHED).toSorted());
  });
});
