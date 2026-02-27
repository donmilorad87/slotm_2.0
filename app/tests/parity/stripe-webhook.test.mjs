import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { verifyStripeWebhookSignature } from "../../dist/lib/stripeWebhook.js";

test("stripe webhook signature verifies for matching payload/secret", () => {
  const secret = "whsec_test_secret";
  const payload = Buffer.from(JSON.stringify({ id: "evt_test", type: "checkout.session.completed" }));
  const timestamp = 1_700_000_000;
  const signedPayload = `${timestamp}.${payload.toString("utf8")}`;
  const digest = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  const header = `t=${timestamp},v1=${digest}`;

  const ok = verifyStripeWebhookSignature({
    payloadBuffer: payload,
    signatureHeader: header,
    webhookSecret: secret,
    toleranceSeconds: 10_000_000,
    nowUnixSeconds: timestamp + 10,
  });

  assert.equal(ok, true);
});

test("stripe webhook signature fails for wrong secret", () => {
  const payload = Buffer.from('{"id":"evt_test"}');
  const timestamp = 1_700_000_000;
  const digest = crypto
    .createHmac("sha256", "whsec_right")
    .update(`${timestamp}.${payload.toString("utf8")}`, "utf8")
    .digest("hex");

  const ok = verifyStripeWebhookSignature({
    payloadBuffer: payload,
    signatureHeader: `t=${timestamp},v1=${digest}`,
    webhookSecret: "whsec_wrong",
    toleranceSeconds: 10_000_000,
    nowUnixSeconds: timestamp + 10,
  });

  assert.equal(ok, false);
});
