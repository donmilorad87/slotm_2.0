export function buildStripeCheckoutReturnUrls(origin, returnToPath, modeParam) {
  const successUrlObj = new URL(returnToPath, origin);
  successUrlObj.searchParams.set(modeParam, "success");

  const successBase = successUrlObj.toString();
  const successJoiner = successBase.includes("?") ? "&" : "?";
  const successUrl = `${successBase}${successJoiner}session_id={CHECKOUT_SESSION_ID}`;

  const cancelUrlObj = new URL(returnToPath, origin);
  cancelUrlObj.searchParams.set(modeParam, "cancel");

  return {
    successUrl,
    cancelUrl: cancelUrlObj.toString(),
  };
}
