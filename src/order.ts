/** Code-unit string order: `localeCompare` depends on the runtime's ICU data, and generated output must be byte-identical across machines. */
export function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
