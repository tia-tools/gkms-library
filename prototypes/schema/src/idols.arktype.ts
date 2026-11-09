import { type } from "arktype";

const Idol = type({ "+": "reject", id: /^[a-z0-9]{4}$/, name: "string > 0" });

export const IdolsFile = type({
  "+": "reject",
  formatVersion: "1",
  idols: Idol.array()
    .atLeastLength(1)
    .narrow((idols, ctx) => {
      const repeated = idols.findIndex((idol, index) => idols.findIndex((other) => other.id === idol.id) !== index);
      return repeated < 0 ? true : ctx.reject({ expected: "an id not used earlier in the list", actual: "", path: [repeated, "id"] });
    }),
});
export type IdolsFile = typeof IdolsFile.infer;

/** The checked file, or a thrown error naming the place of the first bad value. */
export function parse(data: unknown): IdolsFile {
  const result = IdolsFile(data);
  if (result instanceof type.errors) throw new Error(`idols v1: ${result.summary.split("\n")[0] ?? "invalid"}`);
  return result;
}
