/**
 * Signs one request to an S3-compatible API with AWS Signature Version 4, the scheme Cloudflare R2's
 * S3 API accepts. Pure: the time, the keys and the payload's hash are passed in. Written here rather
 * than taken from Bun's S3 client because that client cannot store a Cache-Control with an object,
 * and the library's caching depends on it (per docs/plans/EXECPLAN_LIBRARY_ALONE.md, L38).
 *
 * The steps are AWS's own: a canonical request (method, path, query, the signed headers, the
 * payload's SHA-256), a string to sign naming the date, region and service, and an HMAC chain that
 * derives the signing key from the secret key.
 */

import { createHash, createHmac } from "node:crypto";

export interface SigningKeys {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface UnsignedRequest {
  method: string;
  host: string;
  /** Already encoded, as it goes on the wire: see `encodePath`. */
  path: string;
  /** Lower-case names. `host`, `x-amz-date` and `x-amz-content-sha256` are added. */
  headers: Record<string, string>;
  payloadSha256: string;
}

export const sha256Hex = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string): Buffer => createHmac("sha256", key).update(data).digest();

/** `20130524T000000Z`: the basic ISO 8601 form SigV4 signs. */
export const amzDate = (now: Date): string => now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Each path segment encoded as SigV4 wants for S3: everything but unreserved characters, and `/` kept between segments. */
export const encodePath = (path: string): string =>
  path
    .split("/")
    .map((segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");

/** The request's headers, with `authorization` and the three it signs added. */
export function sign(request: UnsignedRequest, keys: SigningKeys, region: string, now: Date, service = "s3"): Record<string, string> {
  const stamp = amzDate(now);
  const day = stamp.slice(0, 8);
  const headers: Record<string, string> = { ...request.headers, host: request.host, "x-amz-date": stamp, "x-amz-content-sha256": request.payloadSha256 };
  const names = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .toSorted();
  const value = (name: string): string => (headers[name] ?? "").trim().replace(/\s+/g, " ");
  const signedHeaders = names.join(";");
  const canonical = [request.method, request.path, "", names.map((name) => `${name}:${value(name)}\n`).join(""), signedHeaders, request.payloadSha256].join("\n");
  const scope = `${day}/${region}/${service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256Hex(canonical)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${keys.secretAccessKey}`, day), region), service), "aws4_request");
  const signature = createHmac("sha256", key).update(toSign).digest("hex");
  return { ...headers, authorization: `AWS4-HMAC-SHA256 Credential=${keys.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` };
}
