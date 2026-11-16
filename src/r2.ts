/**
 * Writes one object to an R2 bucket, or reads one: the only module that touches a bucket.
 * `images/r2.py` reaches it through `src/r2-object.ts`.
 *
 * Two ways in, chosen by the environment (`s3AccessFrom`):
 * - With `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `CLOUDFLARE_ACCOUNT_ID` set (the unattended
 *   run), it calls R2's S3-compatible API itself, signed with that key pair (`sigv4.ts`). That pair
 *   belongs to a token that may write only the library's two buckets: Cloudflare's main API, which
 *   Wrangler uses, refuses such a token (403, code 10000), and only the S3 API accepts it (per
 *   docs/plans/EXECPLAN_LIBRARY_ALONE.md, L37 and L38).
 * - Otherwise (a person's machine), `bunx wrangler r2 object put|get` with that person's Wrangler login.
 *
 * R2 sometimes fails one put with a transient error (about 1 in 40 during the first image upload),
 * so `put` tries a failed attempt again after each wait, then throws the last failure.
 */

import { encodePath, sha256Hex, sign, type SigningKeys } from "./sigv4.ts";

export const PUBLIC_BUCKET = "gkms-library";
export const RETRY_WAITS_MS: readonly number[] = [5_000, 20_000];
/** R2's region for the S3 API, per Cloudflare's "S3 API compatibility" page. */
export const R2_REGION = "auto";

export interface PutRequest {
  key: string;
  file: string;
  contentType: string;
  cacheControl: string;
}

export interface S3Access {
  /** `<account id>.r2.cloudflarestorage.com`. */
  host: string;
  keys: SigningKeys;
}

export type Env = Record<string, string | undefined>;

/**
 * The S3 key pair from the environment, or undefined when neither key is set. An empty value counts
 * as unset, since GitHub passes a missing secret as "". Half a configuration throws, rather than
 * quietly falling back to Wrangler and failing later in a less clear way.
 */
export function s3AccessFrom(env: Env): S3Access | undefined {
  const value = (name: string): string | undefined => (env[name] ?? "") === "" ? undefined : env[name];
  const accessKeyId = value("R2_ACCESS_KEY_ID");
  const secretAccessKey = value("R2_SECRET_ACCESS_KEY");
  const accountId = value("CLOUDFLARE_ACCOUNT_ID");
  if (accessKeyId === undefined && secretAccessKey === undefined) return undefined;
  const missing = [accessKeyId === undefined ? "R2_ACCESS_KEY_ID" : "", secretAccessKey === undefined ? "R2_SECRET_ACCESS_KEY" : "", accountId === undefined ? "CLOUDFLARE_ACCOUNT_ID" : ""].filter((name) => name !== "");
  if (accessKeyId === undefined || secretAccessKey === undefined || accountId === undefined) throw new Error(`the S3 key pair is half set: ${missing.join(", ")} missing`);
  if (!/^[0-9a-f]{32}$/.test(accountId)) throw new Error("CLOUDFLARE_ACCOUNT_ID is not a Cloudflare account id (32 hexadecimal characters)");
  return { host: `${accountId}.r2.cloudflarestorage.com`, keys: { accessKeyId, secretAccessKey } };
}

export interface HttpRequest {
  url: string;
  method: "PUT" | "GET";
  headers: Record<string, string>;
}

/** A path-style PutObject with the Content-Type and the Cache-Control stored with the object. */
export function s3PutRequest(access: S3Access, bucket: string, request: PutRequest, body: Uint8Array, now: Date): HttpRequest {
  const path = encodePath(`/${bucket}/${request.key}`);
  const headers = sign({ method: "PUT", host: access.host, path, headers: { "content-type": request.contentType, "cache-control": request.cacheControl }, payloadSha256: sha256Hex(body) }, access.keys, R2_REGION, now);
  return { url: `https://${access.host}${path}`, method: "PUT", headers };
}

export function s3GetRequest(access: S3Access, bucket: string, key: string, now: Date): HttpRequest {
  const path = encodePath(`/${bucket}/${key}`);
  const headers = sign({ method: "GET", host: access.host, path, headers: {}, payloadSha256: sha256Hex("") }, access.keys, R2_REGION, now);
  return { url: `https://${access.host}${path}`, method: "GET", headers };
}

export function putCommand(request: PutRequest, bucket: string = PUBLIC_BUCKET): string[] {
  return ["bunx", "wrangler", "r2", "object", "put", `${bucket}/${request.key}`, "--file", request.file, "--content-type", request.contentType, "--cache-control", request.cacheControl, "--remote"];
}

export function getCommand(bucket: string, key: string, file: string): string[] {
  return ["bunx", "wrangler", "r2", "object", "get", `${bucket}/${key}`, "--file", file, "--remote"];
}

/** Everything a put or a get does to the world, passed in so the tests need none of it. */
export interface Io {
  env: Env;
  /** Runs a command and resolves to its exit code. */
  run: (command: readonly string[]) => Promise<number>;
  fetch: (url: string, init: { method: string; headers: Record<string, string>; body?: Uint8Array }) => Promise<Response>;
  readFile: (path: string) => Promise<Uint8Array>;
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
  now: () => Date;
}

export const realIo: Io = {
  env: process.env,
  run: async (command) => Bun.spawn([...command], { stdout: "ignore", stderr: "inherit" }).exited,
  fetch: async (url, init) => fetch(url, init),
  readFile: async (path) => Bun.file(path).bytes(),
  writeFile: async (path, data) => {
    await Bun.write(path, data, { createPath: true });
  },
  now: () => new Date(),
};

/** What went wrong, for the log; the body's first line is R2's own error code when it gives one. */
async function failure(response: Response): Promise<string> {
  const text = (await response.text()).replace(/\s+/g, " ").slice(0, 300);
  return `${response.status}${text === "" ? "" : `: ${text}`}`;
}

/** One attempt; resolves to undefined when it worked, or to what failed. */
export async function putOnce(request: PutRequest, bucket: string, io: Io): Promise<string | undefined> {
  const access = s3AccessFrom(io.env);
  if (access === undefined) {
    const code = await io.run(putCommand(request, bucket));
    return code === 0 ? undefined : `exit ${code}`;
  }
  const body = await io.readFile(request.file);
  const http = s3PutRequest(access, bucket, request, body, io.now());
  try {
    const response = await io.fetch(http.url, { method: http.method, headers: http.headers, body });
    return response.ok ? undefined : await failure(response);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export async function getOnce(bucket: string, key: string, file: string, io: Io): Promise<string | undefined> {
  const access = s3AccessFrom(io.env);
  if (access === undefined) {
    const code = await io.run(getCommand(bucket, key, file));
    return code === 0 ? undefined : `exit ${code}`;
  }
  const http = s3GetRequest(access, bucket, key, io.now());
  try {
    const response = await io.fetch(http.url, { method: http.method, headers: http.headers });
    if (!response.ok) return await failure(response);
    await io.writeFile(file, new Uint8Array(await response.arrayBuffer()));
    return undefined;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

const sleepMs = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function put(request: PutRequest, bucket: string = PUBLIC_BUCKET, io: Io = realIo, sleep: (ms: number) => Promise<void> = sleepMs, waits: readonly number[] = RETRY_WAITS_MS): Promise<void> {
  let error = await putOnce(request, bucket, io);
  for (const wait of waits) {
    if (error === undefined) return;
    console.error(`put ${request.key} failed (${error}); trying again in ${wait / 1000} s`);
    await sleep(wait);
    error = await putOnce(request, bucket, io);
  }
  if (error !== undefined) throw new Error(`put ${request.key} failed (${error}) after ${waits.length + 1} attempts`);
}
