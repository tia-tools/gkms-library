import { describe, expect, test } from "bun:test";
import { amzDate, encodePath, sha256Hex, sign } from "./sigv4.ts";

// AWS's published examples of SigV4 for S3, "Signature Calculations for the Authorization Header:
// Transferring Payload in a Single Chunk": its keys, bucket, time and expected signatures.
const KEYS = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" };
const MAY_24_2013 = new Date("2013-05-24T00:00:00Z");
const HOST = "examplebucket.s3.amazonaws.com";
const EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("sign", () => {
  test("AWS's GET Object example: the first ten bytes of test.txt", () => {
    const headers = sign({ method: "GET", host: HOST, path: "/test.txt", headers: { range: "bytes=0-9" }, payloadSha256: EMPTY }, KEYS, "us-east-1", MAY_24_2013);
    expect(headers["authorization"]).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
    expect(headers["x-amz-date"]).toBe("20130524T000000Z");
  });

  test("AWS's PUT Object example: a payload, a key that needs encoding, and extra headers", () => {
    const payload = "Welcome to Amazon S3.";
    expect(sha256Hex(payload)).toBe("44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072");
    const headers = sign(
      { method: "PUT", host: HOST, path: encodePath("/test$file.text"), headers: { date: "Fri, 24 May 2013 00:00:00 GMT", "x-amz-storage-class": "REDUCED_REDUNDANCY" }, payloadSha256: sha256Hex(payload) },
      KEYS,
      "us-east-1",
      MAY_24_2013,
    );
    expect(headers["authorization"]).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class, Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd",
    );
  });
});

describe("encodePath", () => {
  test("keeps the slashes and unreserved characters, encodes the rest, including what encodeURIComponent leaves", () => {
    expect(encodePath("/gkms-library/img/w112/img_general_pitem_3-393.webp")).toBe("/gkms-library/img/w112/img_general_pitem_3-393.webp");
    expect(encodePath("/b/a b+c$d!e(f)*~.json")).toBe("/b/a%20b%2Bc%24d%21e%28f%29%2A~.json");
  });
});

test("amzDate is the basic ISO 8601 form, without milliseconds", () => {
  expect(amzDate(new Date("2026-11-16T11:24:04.123Z"))).toBe("20261116T112404Z");
});
