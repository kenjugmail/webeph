import assert from "node:assert/strict";
import test from "node:test";
import { loadHearthrailRelease, validateHearthrailRelease } from "../assets/hearthrail.js";

const pending = { schemaVersion: 1, product: "hearthrail", status: "private-alpha", version: null, publishedAt: null, notesUrl: null, assets: [] };
const released = {
  schemaVersion: 1,
  product: "hearthrail",
  status: "released",
  version: "0.1.0-alpha.2",
  publishedAt: "2026-08-28T12:00:00Z",
  notesUrl: "https://ephemerent.com/hearthrail/releases/0.1.0-alpha.2",
  assets: [{ platform: "macos-arm64", filename: "Hearthrail-0.1.0-alpha.2-arm64.dmg", url: "https://downloads.ephemerent.com/Hearthrail-0.1.0-alpha.2-arm64.dmg", sha256: "a".repeat(64), sizeBytes: 76679134 }],
};

test("accepts the inert private-alpha manifest", () => assert.equal(validateHearthrailRelease(pending)?.status, "private-alpha"));
test("rejects a private-alpha manifest carrying an asset", () => assert.equal(validateHearthrailRelease({ ...pending, assets: released.assets }), undefined));
test("rejects malformed and credential-bearing release metadata", () => {
  assert.equal(validateHearthrailRelease({}), undefined);
  assert.equal(validateHearthrailRelease({ ...released, notesUrl: "https://user:secret@example.com/notes" }), undefined);
  assert.equal(validateHearthrailRelease({ ...released, assets: [{ ...released.assets[0], sha256: "short" }] }), undefined);
  assert.equal(validateHearthrailRelease({ ...released, publishedAt: "August 28, 2026" }), undefined);
  assert.equal(validateHearthrailRelease({ ...released, notesUrl: "https://release.invalid/notes" }), undefined);
  assert.equal(validateHearthrailRelease({ ...released, assets: [{ ...released.assets[0], filename: "Other-0.1.0-alpha.2-arm64.dmg" }] }), undefined);
  assert.equal(validateHearthrailRelease({ ...released, assets: [{ ...released.assets[0], filename: "Hearthrail-0.1.0-alpha.1-arm64.dmg" }] }), undefined);
  assert.equal(validateHearthrailRelease({ ...released, assets: [{ ...released.assets[0], filename: "Hearthrail-0.1.0-alpha.2-x64.dmg" }] }), undefined);
  assert.equal(validateHearthrailRelease({ ...released, assets: [{ ...released.assets[0], url: "https://downloads.ephemerent.com/different.dmg" }] }), undefined);
});
test("accepts a bounded future release", () => {
  const value = validateHearthrailRelease(released);
  assert.equal(value?.status, "released");
  assert.equal(value?.assets[0]?.platform, "macos-arm64");
  assert.equal(value?.assets[0]?.sha256.length, 64);
});
test("fetch failure fails closed", async () => {
  const value = await loadHearthrailRelease(async () => { throw new Error("offline"); });
  assert.equal(value, undefined);
});
test("invalid fetched JSON fails closed", async () => {
  const value = await loadHearthrailRelease(async () => ({ ok: true, json: async () => ({ status: "released" }) }));
  assert.equal(value, undefined);
});
