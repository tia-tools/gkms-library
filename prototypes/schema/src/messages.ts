import { parse as valibot } from "./idols.valibot.ts";
import { parse as zod } from "./idols.zod.ts";
import { parse as arktype } from "./idols.arktype.ts";

const good = { formatVersion: 1, idols: [{ id: "hski", name: "花海咲季" }, { id: "ttmr", name: "月村手毬" }, { id: "fktn", name: "藤田ことね" }] };
const cases: Record<string, unknown> = {
  good,
  "third idol's name is a number": { ...good, idols: [good.idols[0], good.idols[1], { id: "fktn", name: 3 }] },
  "an id twice": { ...good, idols: [good.idols[0], good.idols[1], { id: "hski", name: "another" }] },
  "no idols": { ...good, idols: [] },
  "an extra key": { ...good, extra: true },
  "format version 2": { ...good, formatVersion: 2 },
};
for (const [name, parse] of Object.entries({ valibot, zod, arktype })) {
  console.log(`== ${name}`);
  for (const [label, data] of Object.entries(cases)) {
    try {
      console.log(`  ${label}: ok, ${parse(data).idols.length} idols`);
    } catch (e) {
      console.log(`  ${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
