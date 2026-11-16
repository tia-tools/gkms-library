/**
 * One put or get, for the image side (`images/r2.py`), which keeps its own retries and order:
 *
 *     bun src/r2-object.ts put <bucket> <key> <file> <content type> <cache control>
 *     bun src/r2-object.ts get <bucket> <key> <file>
 *
 * Exits 0 when it worked, 1 with the reason on stderr when it did not, 2 on bad usage. The way in,
 * S3 key pair or Wrangler login, is `r2.ts`'s.
 */

import { getOnce, putOnce, realIo } from "./r2.ts";

const USAGE = "usage: bun src/r2-object.ts put <bucket> <key> <file> <content type> <cache control> | get <bucket> <key> <file>";

type Command = { verb: "put"; bucket: string; key: string; file: string; contentType: string; cacheControl: string } | { verb: "get"; bucket: string; key: string; file: string };

/** The command the words name, or undefined when they name none. */
export function parse(args: readonly string[]): Command | undefined {
  const [verb, bucket = "", key = "", file = "", ...rest] = args;
  if (bucket === "" || key === "" || file === "") return undefined;
  if (verb === "get" && rest.length === 0) return { verb, bucket, key, file };
  const [contentType = "", cacheControl = "", ...extra] = rest;
  if (verb === "put" && contentType !== "" && cacheControl !== "" && extra.length === 0) return { verb, bucket, key, file, contentType, cacheControl };
  return undefined;
}

async function main(args: readonly string[]): Promise<number> {
  const command = parse(args);
  if (command === undefined) {
    console.error(USAGE);
    return 2;
  }
  let error: string | undefined;
  try {
    error = command.verb === "put" ? await putOnce({ key: command.key, file: command.file, contentType: command.contentType, cacheControl: command.cacheControl }, command.bucket, realIo) : await getOnce(command.bucket, command.key, command.file, realIo);
  } catch (e) {
    // A configuration error from r2.ts, such as a half-set key pair: its message names variables, never their values.
    error = e instanceof Error ? e.message : String(e);
  }
  if (error !== undefined) console.error(`${command.verb} ${command.bucket}/${command.key} failed: ${error}`);
  return error === undefined ? 0 : 1;
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)));
