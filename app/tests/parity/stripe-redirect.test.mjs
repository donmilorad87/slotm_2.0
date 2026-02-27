import test from "node:test";
import assert from "node:assert/strict";

import { buildStripeCheckoutReturnUrls } from "../../dist/lib/stripeRedirect.js";

test("stripe checkout return urls keep raw CHECKOUT_SESSION_ID placeholder", () => {
  const { successUrl, cancelUrl } = buildStripeCheckoutReturnUrls(
    "https://local.rust.com",
    "/wallet",
    "topup",
  );

  assert.match(successUrl, /topup=success/);
  assert.match(successUrl, /session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.doesNotMatch(successUrl, /session_id=%7BCHECKOUT_SESSION_ID%7D/);

  assert.match(cancelUrl, /topup=cancel/);
  assert.doesNotMatch(cancelUrl, /CHECKOUT_SESSION_ID/);
});

test("stripe checkout return urls preserve existing query string", () => {
  const { successUrl, cancelUrl } = buildStripeCheckoutReturnUrls(
    "https://local.rust.com",
    "/wallet?from=game",
    "setup",
  );

  assert.match(successUrl, /from=game/);
  assert.match(successUrl, /setup=success/);
  assert.match(successUrl, /session_id=\{CHECKOUT_SESSION_ID\}/);

  assert.match(cancelUrl, /from=game/);
  assert.match(cancelUrl, /setup=cancel/);
});
