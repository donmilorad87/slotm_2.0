import { describe, it, expect } from "@jest/globals";
import crypto from "node:crypto";
import { verifyStripeWebhookSignature } from "../../../src/lib/stripeWebhook.js";

const SECRET = "whsec_test_secret_key_1234567890";

function createValidSignature(
  payload: string,
  secret: string,
  timestamp: number,
): string {
  const signedPayload = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

describe("verifyStripeWebhookSignature", () => {
  const payloadStr = '{"id":"evt_123","type":"checkout.session.completed"}';
  const payloadBuffer = Buffer.from(payloadStr, "utf8");
  const now = 1700000000;

  it("returns true for a valid signature", () => {
    const header = createValidSignature(payloadStr, SECRET, now);
    const result = verifyStripeWebhookSignature({
      payloadBuffer,
      signatureHeader: header,
      webhookSecret: SECRET,
      nowUnixSeconds: now,
    });
    expect(result).toBe(true);
  });

  it("returns false when signature header is missing", () => {
    const result = verifyStripeWebhookSignature({
      payloadBuffer,
      signatureHeader: undefined,
      webhookSecret: SECRET,
      nowUnixSeconds: now,
    });
    expect(result).toBe(false);
  });

  it("returns false when signature header is empty string", () => {
    const result = verifyStripeWebhookSignature({
      payloadBuffer,
      signatureHeader: "",
      webhookSecret: SECRET,
      nowUnixSeconds: now,
    });
    expect(result).toBe(false);
  });

  it("returns false when webhook secret is empty", () => {
    const header = createValidSignature(payloadStr, SECRET, now);
    const result = verifyStripeWebhookSignature({
      payloadBuffer,
      signatureHeader: header,
      webhookSecret: "",
      nowUnixSeconds: now,
    });
    expect(result).toBe(false);
  });

  it("returns false for wrong secret", () => {
    const header = createValidSignature(payloadStr, SECRET, now);
    const result = verifyStripeWebhookSignature({
      payloadBuffer,
      signatureHeader: header,
      webhookSecret: "whsec_wrong_secret",
      nowUnixSeconds: now,
    });
    expect(result).toBe(false);
  });

  it("returns false when timestamp is too old", () => {
    const oldTimestamp = now - 600;
    const header = createValidSignature(payloadStr, SECRET, oldTimestamp);
    const result = verifyStripeWebhookSignature({
      payloadBuffer,
      signatureHeader: header,
      webhookSecret: SECRET,
      toleranceSeconds: 300,
      nowUnixSeconds: now,
    });
    expect(result).toBe(false);
  });

  it("returns false when timestamp is in the future beyond tolerance", () => {
    const futureTimestamp = now + 600;
    const header = createValidSignature(payloadStr, SECRET, futureTimestamp);
    const result = verifyStripeWebhookSignature({
      payloadBuffer,
      signatureHeader: header,
      webhookSecret: SECRET,
      toleranceSeconds: 300,
      nowUnixSeconds: now,
    });
    expect(result).toBe(false);
  });

  it("accepts timestamp within tolerance", () => {
    const recentTimestamp = now - 100;
    const header = createValidSignature(payloadStr, SECRET, recentTimestamp);
    const result = verifyStripeWebhookSignature({
      payloadBuffer,
      signatureHeader: header,
      webhookSecret: SECRET,
      toleranceSeconds: 300,
      nowUnixSeconds: now,
    });
    expect(result).toBe(true);
  });

  it("returns false for tampered payload", () => {
    const header = createValidSignature(payloadStr, SECRET, now);
    const tamperedPayload = Buffer.from('{"id":"evt_TAMPERED"}', "utf8");
    const result = verifyStripeWebhookSignature({
      payloadBuffer: tamperedPayload,
      signatureHeader: header,
      webhookSecret: SECRET,
      nowUnixSeconds: now,
    });
    expect(result).toBe(false);
  });

  it("returns false when signature header has no v1 field", () => {
    const result = verifyStripeWebhookSignature({
      payloadBuffer,
      signatureHeader: `t=${now}`,
      webhookSecret: SECRET,
      nowUnixSeconds: now,
    });
    expect(result).toBe(false);
  });

  it("returns false when signature header has no timestamp", () => {
    const signedPayload = `${now}.${payloadStr}`;
    const hmac = crypto.createHmac("sha256", SECRET).update(signedPayload, "utf8").digest("hex");
    const result = verifyStripeWebhookSignature({
      payloadBuffer,
      signatureHeader: `v1=${hmac}`,
      webhookSecret: SECRET,
      nowUnixSeconds: now,
    });
    expect(result).toBe(false);
  });

  it("succeeds when multiple v1 signatures and one matches", () => {
    const goodSig = createValidSignature(payloadStr, SECRET, now);
    const fakeHmac = crypto.createHmac("sha256", "wrong").update("wrong").digest("hex");
    const header = `t=${now},v1=${fakeHmac},v1=${goodSig.split("v1=")[1]}`;
    const result = verifyStripeWebhookSignature({
      payloadBuffer,
      signatureHeader: header,
      webhookSecret: SECRET,
      nowUnixSeconds: now,
    });
    expect(result).toBe(true);
  });

  it("returns false when all v1 signatures are wrong", () => {
    const fakeHmac1 = crypto.createHmac("sha256", "wrong1").update("wrong").digest("hex");
    const fakeHmac2 = crypto.createHmac("sha256", "wrong2").update("wrong").digest("hex");
    const header = `t=${now},v1=${fakeHmac1},v1=${fakeHmac2}`;
    const result = verifyStripeWebhookSignature({
      payloadBuffer,
      signatureHeader: header,
      webhookSecret: SECRET,
      nowUnixSeconds: now,
    });
    expect(result).toBe(false);
  });

  it("handles malformed signature header gracefully", () => {
    const result = verifyStripeWebhookSignature({
      payloadBuffer,
      signatureHeader: "garbage-not-a-header",
      webhookSecret: SECRET,
      nowUnixSeconds: now,
    });
    expect(result).toBe(false);
  });
});
