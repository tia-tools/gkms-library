// Lint policy: size, complexity and type escape hatches are errors, not review comments. Oxlint with
// tsgolint because this repository is on TypeScript 7, whose npm package has no JavaScript API for
// typescript-eslint. Adopted from gakumas-supportcards' configuration (docs/plans/EXECPLAN_LIBRARY_ALONE.md,
// decision L13). Exceptions go here with a reason and a removal condition, never inline.
import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript", "eslint", "oxc"],
  jsPlugins: ["eslint-plugin-security"],
  categories: { correctness: "error" },
  options: { typeAware: true },
  // out/ holds generated releases and images; images/ is Python.
  ignorePatterns: ["node_modules/**", ".cache/**", "out/**", "images/**"],
  rules: {
    "max-lines-per-function": ["error", { max: 60, skipBlankLines: true, skipComments: true }],
    complexity: ["error", 15],
    "max-depth": ["error", 4],
    "max-nested-callbacks": ["error", 4],
    "max-params": ["warn", 6],
    "no-empty": "error",
    "typescript/no-explicit-any": "error",
    "typescript/no-non-null-assertion": "error",
    "typescript/consistent-type-assertions": ["error", { assertionStyle: "never" }],
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/await-thenable": "error",
    "typescript/no-base-to-string": "error",
    "typescript/no-redundant-type-constituents": "error",
    "security/detect-eval-with-expression": "error",
    "security/detect-non-literal-regexp": "error",
    "security/detect-unsafe-regex": "error",
    "security/detect-buffer-noassert": "error",
    "security/detect-new-buffer": "error",
    "security/detect-pseudoRandomBytes": "error",
    "security/detect-child-process": "error",
    "security/detect-non-literal-fs-filename": "error",
    "security/detect-non-literal-require": "error",
    "security/detect-disable-mustache-escape": "error",
    "security/detect-no-csrf-before-method-override": "error",
    "security/detect-bidi-characters": "error",
  },
  overrides: [
    {
      // Tests group many cases under one describe. Remove when no test function needs more than 60 lines.
      files: ["**/*.test.ts"],
      rules: { "max-lines-per-function": ["error", { max: 120, skipBlankLines: true, skipComments: true }] },
    },
    {
      // The commands read and write repository files by path: cached game tables, releases under out/,
      // the format files. No path comes from outside input; --out, --site and --previous are typed by
      // the person or the workflow running the command. Remove if a path ever comes from a request.
      files: ["src/**/*.ts"],
      rules: { "security/detect-non-literal-fs-filename": "off" },
    },
  ],
});
