import { expect, test } from "bun:test";
import { parse } from "./r2-object.ts";

test("parse takes exactly a put's five words or a get's three, and nothing else", () => {
  expect(parse(["put", "gkms-library", "img/w48/x.webp", "/tmp/x.webp", "image/webp", "public, max-age=31536000, immutable"])).toEqual({ verb: "put", bucket: "gkms-library", key: "img/w48/x.webp", file: "/tmp/x.webp", contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" });
  expect(parse(["get", "gkms-library-masters", "x.webp", "/tmp/x.webp"])).toEqual({ verb: "get", bucket: "gkms-library-masters", key: "x.webp", file: "/tmp/x.webp" });
  for (const words of [[], ["put", "b", "k", "f", "image/webp"], ["put", "b", "k", "f", "t", "c", "extra"], ["get", "b", "k"], ["get", "b", "k", "f", "extra"], ["delete", "b", "k", "f"], ["put", "", "k", "f", "t", "c"]]) {
    expect(parse(words)).toBeUndefined();
  }
});
