import * as z from "zod/mini";

const Idol = z.strictObject({ id: z.string().check(z.regex(/^[a-z0-9]{4}$/)), name: z.string().check(z.minLength(1)) });

export const IdolsFile = z.strictObject({
  formatVersion: z.literal(1),
  idols: z.array(Idol).check(
    z.minLength(1, "no idols"),
    z.superRefine((idols, ctx) => {
      idols.forEach((idol, index) => {
        if (idols.findIndex((other) => other.id === idol.id) !== index) ctx.addIssue({ code: "custom", message: "this idol's id appears earlier in the list", path: [index, "id"] });
      });
    }),
  ),
});
export type IdolsFile = z.infer<typeof IdolsFile>;

/** The checked file, or a thrown error naming the place of the first bad value. */
export function parse(data: unknown): IdolsFile {
  const result = z.safeParse(IdolsFile, data);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw new Error(`idols v1: ${issue === undefined || issue.path.length === 0 ? "(file)" : issue.path.join(".")}: ${issue?.message ?? "invalid"}`);
}
