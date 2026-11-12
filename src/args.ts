/** The few command line arguments the commands take: `--name` flags and `--name value` options. Pure. */

export function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

/** The value after `--name`, or `fallback`; a name given without a value throws. */
export function option(argv: readonly string[], name: string, fallback: string): string {
  const at = argv.indexOf(`--${name}`);
  if (at < 0) return fallback;
  const value = argv[at + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`--${name} needs a value`);
  return value;
}
