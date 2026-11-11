/**
 * Format `idols`, version 1: the playable idols of 学園アイドルマスター, in the game's order.
 *
 * A format is the shape of a published file; this file is both its types and its check, and it never
 * changes once published: a change of shape is a new version number in a new file
 * (docs/adr/0005). An app copies this file verbatim and checks downloaded data with `parse`.
 * It imports nothing but Valibot (major version 1).
 */

import * as v from "valibot";

/** A playable idol: the game's character id (`hski`) and full name (花海咲季). */
export const Idol = v.strictObject({
  id: v.pipe(v.string(), v.regex(/^[a-z0-9]{4}$/, "an idol id is four lowercase letters or digits")),
  name: v.pipe(v.string(), v.minLength(1, "a name cannot be empty")),
});
export type Idol = v.InferOutput<typeof Idol>;

export const IdolsFile = v.strictObject({
  formatVersion: v.literal(1),
  /** In the game's order (Character.order). */
  idols: v.pipe(
    v.array(Idol),
    v.minLength(1, "the list is empty"),
    v.checkItems((idol, index, all) => all.findIndex((other) => other.id === idol.id) === index, "this id appears earlier in the list"),
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
