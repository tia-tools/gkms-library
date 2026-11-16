import { describe, expect, test } from "bun:test";
import { failure, getOnce, type Io, put, putCommand, type PutRequest, RETRY_WAITS_MS, s3AccessFrom, s3PutRequest, thrown } from "./r2.ts";
import { sha256Hex } from "./sigv4.ts";

const REQUEST: PutRequest = { key: "data/latest.v1.json", file: "out/site/data/latest.v1.json", contentType: "application/json", cacheControl: "public, max-age=300" };
const ACCOUNT = "0123456789abcdef0123456789abcdef";
const S3_ENV = { R2_ACCESS_KEY_ID: "key-id", R2_SECRET_ACCESS_KEY: "secret", CLOUDFLARE_ACCOUNT_ID: ACCOUNT };
const BODY = new TextEncoder().encode('{"pointerVersion":1}');

interface Recorded {
  commands: string[][];
  requests: { url: string; method: string; headers: Record<string, string>; body?: Uint8Array }[];
  written: Map<string, Uint8Array>;
  slept: number[];
}

/** A world where the first `failures` attempts fail, by exit code or by HTTP status. */
function world(env: Record<string, string>, failures: number): { io: Io; sleep: (ms: number) => Promise<void>; seen: Recorded } {
  const seen: Recorded = { commands: [], requests: [], written: new Map(), slept: [] };
  const attempts = (): number => seen.commands.length + seen.requests.length;
  const io: Io = {
    env,
    run: async (command) => {
      seen.commands.push([...command]);
      return attempts() <= failures ? 1 : 0;
    },
    fetch: async (url, init) => {
      seen.requests.push({ url, ...init });
      return attempts() <= failures ? new Response("<Error><Code>InternalError</Code></Error>", { status: 500 }) : new Response(init.method === "GET" ? "master bytes" : "", { status: 200 });
    },
    readFile: async () => BODY,
    writeFile: async (path, data) => {
      seen.written.set(path, data);
    },
    now: () => new Date("2026-11-16T11:24:04Z"),
  };
  return {
    io,
    seen,
    sleep: async (ms) => {
      seen.slept.push(ms);
    },
  };
}

describe("s3AccessFrom", () => {
  test("no key pair means the Wrangler login, also when GitHub passes unset secrets as empty strings", () => {
    expect(s3AccessFrom({})).toBeUndefined();
    expect(s3AccessFrom({ R2_ACCESS_KEY_ID: "", R2_SECRET_ACCESS_KEY: "", CLOUDFLARE_ACCOUNT_ID: ACCOUNT, CLOUDFLARE_API_TOKEN: "t" })).toBeUndefined();
  });

  test("the key pair and the account id give the account's S3 endpoint", () => {
    expect(s3AccessFrom(S3_ENV)).toEqual({ host: `${ACCOUNT}.r2.cloudflarestorage.com`, keys: { accessKeyId: "key-id", secretAccessKey: "secret" } });
  });

  test("half a configuration is an error naming what is missing, never a quiet fall back to Wrangler", () => {
    expect(() => s3AccessFrom({ R2_ACCESS_KEY_ID: "key-id", CLOUDFLARE_ACCOUNT_ID: ACCOUNT })).toThrow("R2_SECRET_ACCESS_KEY missing");
    expect(() => s3AccessFrom({ R2_SECRET_ACCESS_KEY: "secret" })).toThrow("R2_ACCESS_KEY_ID, CLOUDFLARE_ACCOUNT_ID missing");
    expect(() => s3AccessFrom({ ...S3_ENV, CLOUDFLARE_ACCOUNT_ID: "tia.run/../x" })).toThrow("not a Cloudflare account id");
  });
});

describe("s3PutRequest", () => {
  test("is a signed path-style PUT to the bucket, storing the content type and the Cache-Control, hashing the body", () => {
    const access = s3AccessFrom(S3_ENV);
    if (access === undefined) throw new Error("no access");
    const http = s3PutRequest(access, "gkms-library-masters", { ...REQUEST, key: "img_sd_hkne_face-00.webp", contentType: "image/webp", cacheControl: "private, no-cache" }, BODY, new Date("2026-11-16T11:24:04Z"));
    expect(http.url).toBe(`https://${ACCOUNT}.r2.cloudflarestorage.com/gkms-library-masters/img_sd_hkne_face-00.webp`);
    expect(http.method).toBe("PUT");
    expect(http.headers["content-type"]).toBe("image/webp");
    expect(http.headers["cache-control"]).toBe("private, no-cache");
    expect(http.headers["x-amz-content-sha256"]).toBe(sha256Hex(BODY));
    expect(http.headers["authorization"]).toStartWith("AWS4-HMAC-SHA256 Credential=key-id/20261116/auto/s3/aws4_request, SignedHeaders=cache-control;content-type;host;x-amz-content-sha256;x-amz-date, Signature=");
  });
});

describe("put", () => {
  test("without a key pair, is one wrangler put into the public bucket, with the content type and the Cache-Control stored with the object", async () => {
    expect(putCommand(REQUEST)).toEqual(["bunx", "wrangler", "r2", "object", "put", "gkms-library/data/latest.v1.json", "--file", "out/site/data/latest.v1.json", "--content-type", "application/json", "--cache-control", "public, max-age=300", "--remote"]);
    const w = world({}, 0);
    await put(REQUEST, undefined, w.io, w.sleep);
    expect(w.seen.commands).toEqual([putCommand(REQUEST)]);
    expect(w.seen.requests).toEqual([]);
  });

  test("with a key pair, is one S3 PUT of the file's bytes and no Wrangler at all", async () => {
    const w = world(S3_ENV, 0);
    await put(REQUEST, undefined, w.io, w.sleep);
    expect(w.seen.commands).toEqual([]);
    expect(w.seen.requests.map((r) => [r.method, r.url, r.body])).toEqual([["PUT", `https://${ACCOUNT}.r2.cloudflarestorage.com/gkms-library/data/latest.v1.json`, BODY]]);
    expect(w.seen.slept).toEqual([]);
  });

  for (const [way, env] of [
    ["Wrangler", {}],
    ["S3", S3_ENV],
  ] as const) {
    test(`${way}: a transient failure is tried again after each wait, the same way`, async () => {
      const w = world(env, 2);
      await put(REQUEST, undefined, w.io, w.sleep);
      expect(w.seen.commands.length + w.seen.requests.length).toBe(3);
      expect(w.seen.slept).toEqual([...RETRY_WAITS_MS]);
    });

    test(`${way}: a put that keeps failing throws after its last attempt, with the last reason`, async () => {
      const w = world(env, 99);
      const reason = way === "S3" ? "500 InternalError" : "exit 1";
      expect(put(REQUEST, undefined, w.io, w.sleep)).rejects.toThrow(`put data/latest.v1.json failed (${reason}) after 3 attempts`);
      await Promise.resolve();
      expect(w.seen.commands.length + w.seen.requests.length).toBeLessThanOrEqual(RETRY_WAITS_MS.length + 1);
    });
  }
});

describe("getOnce", () => {
  test("with a key pair, a signed GET whose body becomes the file", async () => {
    const w = world(S3_ENV, 0);
    expect(await getOnce("gkms-library-masters", "x.webp", "out/masters/x.webp", w.io)).toBeUndefined();
    expect(w.seen.requests.map((r) => [r.method, r.url, r.headers["x-amz-content-sha256"]])).toEqual([["GET", `https://${ACCOUNT}.r2.cloudflarestorage.com/gkms-library-masters/x.webp`, sha256Hex("")]]);
    expect(new TextDecoder().decode(w.seen.written.get("out/masters/x.webp"))).toBe("master bytes");
  });

  test("a refused GET writes nothing and says why", async () => {
    const w = world(S3_ENV, 1);
    expect(await getOnce("gkms-library-masters", "x.webp", "out/masters/x.webp", w.io)).toStartWith("500");
    expect(w.seen.written.size).toBe(0);
  });

  test("without a key pair, wrangler get", async () => {
    const w = world({}, 0);
    await getOnce("gkms-library-masters", "x.webp", "out/masters/x.webp", w.io);
    expect(w.seen.commands).toEqual([["bunx", "wrangler", "r2", "object", "get", "gkms-library-masters/x.webp", "--file", "out/masters/x.webp", "--remote"]]);
  });
});

describe("what a failure logs", () => {
  test("the status and R2's error code only: never the body, which can carry the access key id", async () => {
    const body = "<Error><Code>SignatureDoesNotMatch</Code><AWSAccessKeyId>key-id</AWSAccessKeyId><StringToSign>AWS4-HMAC-SHA256 secret-ish</StringToSign></Error>";
    expect(await failure(new Response(body, { status: 403 }))).toBe("403 SignatureDoesNotMatch");
    expect(await failure(new Response("not xml at all, key-id", { status: 502 }))).toBe("502");
  });

  test("an exception gives its kind and code, never its message, which can name the account's endpoint", () => {
    const e = Object.assign(new TypeError(`fetch to https://${ACCOUNT}.r2.cloudflarestorage.com failed`), { code: "ConnectionRefused" });
    expect(thrown(e)).toBe("request failed (TypeError ConnectionRefused)");
    expect(thrown(Object.assign(new Error("x"), { code: `https://${ACCOUNT}` }))).toBe("request failed (Error)");
    expect(thrown("a string")).toBe("request failed (error)");
  });
});
