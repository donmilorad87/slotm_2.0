import { describe, it, expect } from "@jest/globals";
import { buildStripeCheckoutReturnUrls } from "../../../src/lib/stripeRedirect.js";

describe("buildStripeCheckoutReturnUrls", () => {
  it("builds success URL with session_id placeholder", () => {
    const result = buildStripeCheckoutReturnUrls("https://example.com", "/wallet", "topup");
    expect(result.successUrl).toContain("topup=success");
    expect(result.successUrl).toContain("session_id={CHECKOUT_SESSION_ID}");
  });

  it("builds cancel URL with mode param", () => {
    const result = buildStripeCheckoutReturnUrls("https://example.com", "/wallet", "topup");
    expect(result.cancelUrl).toContain("topup=cancel");
    expect(result.cancelUrl).not.toContain("session_id");
  });

  it("uses correct origin in URLs", () => {
    const result = buildStripeCheckoutReturnUrls("https://mysite.com", "/payment", "checkout");
    expect(result.successUrl).toMatch(/^https:\/\/mysite\.com\/payment/);
    expect(result.cancelUrl).toMatch(/^https:\/\/mysite\.com\/payment/);
  });

  it("works with different mode params", () => {
    const result = buildStripeCheckoutReturnUrls("https://example.com", "/wallet", "setup");
    expect(result.successUrl).toContain("setup=success");
    expect(result.cancelUrl).toContain("setup=cancel");
  });

  it("handles root path", () => {
    const result = buildStripeCheckoutReturnUrls("https://example.com", "/", "mode");
    expect(result.successUrl).toContain("mode=success");
    expect(result.cancelUrl).toContain("mode=cancel");
  });

  it("handles path with existing segments", () => {
    const result = buildStripeCheckoutReturnUrls(
      "https://example.com",
      "/profile/wallet",
      "topup",
    );
    expect(result.successUrl).toContain("/profile/wallet");
    expect(result.cancelUrl).toContain("/profile/wallet");
  });

  it("success URL ends with session_id placeholder after query params", () => {
    const result = buildStripeCheckoutReturnUrls("https://example.com", "/wallet", "topup");
    expect(result.successUrl).toMatch(/session_id=\{CHECKOUT_SESSION_ID\}$/);
  });

  it("cancel URL does not contain CHECKOUT_SESSION_ID", () => {
    const result = buildStripeCheckoutReturnUrls("https://example.com", "/wallet", "topup");
    expect(result.cancelUrl).not.toContain("CHECKOUT_SESSION_ID");
  });
});
