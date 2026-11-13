/**
 * Writes one object to the public bucket with `bunx wrangler r2 object put`: the Wrangler login on
 * a person's machine, CLOUDFLARE_API_TOKEN in the unattended run. The only module of the data side
 * that uploads. The R2 API sometimes fails one put with a transient error (about 1 in 40 during the
 * first image upload), so a failed put is tried again after each wait, then the last failure is thrown.
 */

export const PUBLIC_BUCKET = "gkms-library";
export const RETRY_WAITS_MS: readonly number[] = [5_000, 20_000];

export interface PutRequest {
  key: string;
  file: string;
  contentType: string;
  cacheControl: string;
}

/** Runs a command and resolves to its exit code. */
export type Run = (command: readonly string[]) => Promise<number>;

const runWithBun: Run = async (command) => Bun.spawn([...command], { stdout: "ignore", stderr: "inherit" }).exited;
const sleepMs = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function putCommand(request: PutRequest, bucket: string = PUBLIC_BUCKET): string[] {
  return ["bunx", "wrangler", "r2", "object", "put", `${bucket}/${request.key}`, "--file", request.file, "--content-type", request.contentType, "--cache-control", request.cacheControl, "--remote"];
}

export async function put(request: PutRequest, run: Run = runWithBun, sleep: (ms: number) => Promise<void> = sleepMs, waits: readonly number[] = RETRY_WAITS_MS): Promise<void> {
  const command = putCommand(request);
  let code = await run(command);
  for (const wait of waits) {
    if (code === 0) return;
    console.error(`put ${request.key} failed (exit ${code}); trying again in ${wait / 1000} s`);
    await sleep(wait);
    code = await run(command);
  }
  if (code !== 0) throw new Error(`put ${request.key} failed (exit ${code}) after ${waits.length + 1} attempts`);
}
