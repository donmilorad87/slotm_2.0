import test from "node:test";
import assert from "node:assert/strict";

import { StripeClient } from "../../dist/lib/stripe.js";

test("stripe client getCheckoutSession sends expand as array param", async () => {
  const client = new StripeClient("sk_test_123");

  const originalFetch = globalThis.fetch;
  let capturedUrl = "";

  globalThis.fetch = async (url) => {
    capturedUrl = String(url);
    return {
      ok: true,
      async json() {
        return { id: "cs_test" };
      },
    };
  };

  try {
    await client.getCheckoutSession("cs_test");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.match(capturedUrl, /expand%5B%5D=payment_intent/);
  assert.doesNotMatch(capturedUrl, /[?&]expand=payment_intent/);
});
