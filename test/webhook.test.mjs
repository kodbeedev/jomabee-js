import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature, parseWebhook, Jomabee } from "../dist/index.js";

const SECRET = "whsec_test_secret";
const sign = (body) => createHmac("sha256", SECRET).update(body, "utf8").digest("hex");

test("valid signature passes", () => {
  const body = JSON.stringify({ event: "payment.verified", invoice_id: "JOMB-1", amount: 500 });
  assert.equal(verifyWebhookSignature(body, sign(body), SECRET), true);
});

test("tampered body fails", () => {
  const body = JSON.stringify({ event: "payment.verified", amount: 500 });
  const sig = sign(body);
  const tampered = JSON.stringify({ event: "payment.verified", amount: 999 });
  assert.equal(verifyWebhookSignature(tampered, sig, SECRET), false);
});

test("empty signature or secret fails", () => {
  const body = "{}";
  assert.equal(verifyWebhookSignature(body, "", SECRET), false);
  assert.equal(verifyWebhookSignature(body, sign(body), ""), false);
});

test("parseWebhook returns event on valid signature", () => {
  const body = JSON.stringify({ event: "payment.verified", invoice_id: "JOMB-X" });
  const event = parseWebhook(body, sign(body), SECRET);
  assert.equal(event.invoice_id, "JOMB-X");
});

test("parseWebhook throws on bad signature", () => {
  assert.throws(() => parseWebhook('{"event":"x"}', "deadbeef", SECRET));
});

test("client requires apiKey", () => {
  assert.throws(() => new Jomabee({ apiKey: "" }));
});

test("client requires secret for createPayment", () => {
  const c = new Jomabee({ apiKey: "k" });
  assert.throws(() => c.createPayment({ amount: 1, product_name: "x" }));
});
