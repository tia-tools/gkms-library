import * as v from "valibot";

const Idol = v.strictObject({ id: v.pipe(v.string(), v.regex(/^[a-z0-9]{4}$/)), name: v.pipe(v.string(), v.minLength(1)) });

export const IdolsFile = v.strictObject({
  formatVersion: v.literal(1),
  idols: v.pipe(
    v.array(Idol),
    v.minLength(1, "no idols"),
    v.checkItems((idol, index, all) => all.findIndex((other) => other.id === idol.id) === index, "this idol's id appears earlier in the list"),
  ),
});
export type IdolsFile = v.InferOutput<typeof IdolsFile>;

/** The checked file, or a thrown error naming the place of the first bad value. */
export function parse(data: unknown): IdolsFile {
  const result = v.safeParse(IdolsFile, data);
  if (result.success) return result.output;
  const issue = result.issues[0];
  throw new Error(`idols v1: ${v.getDotPath(issue) ?? "(file)"}: ${issue.message}`);
}
