function encodeFormObject(obj) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) {
      continue;
    }
    params.append(key, String(value));
  }
  return params.toString();
}

export class StripeClient {
  constructor(secretKey) {
    this.secretKey = secretKey || "";
  }

  isConfigured() {
    return this.secretKey.startsWith("sk_");
  }

  async request(method, endpoint, form = null, query = null) {
    if (!this.isConfigured()) {
      throw new Error("Stripe secret key is not configured");
    }

    const url = new URL(`https://api.stripe.com/v1${endpoint}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers = {
      Authorization: `Bearer ${this.secretKey}`,
    };

    let body;
    if (form) {
      body = encodeFormObject(form);
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    const payload = await response.json();
    if (!response.ok) {
      const msg = payload?.error?.message || `Stripe API error (${response.status})`;
      throw new Error(msg);
    }

    return payload;
  }

  async createCustomer({ email }) {
    return this.request("POST", "/customers", { email });
  }

  async createTopupCheckoutSession({
    customerId,
    successUrl,
    cancelUrl,
    userId,
    amountCoins,
  }) {
    return this.request("POST", "/checkout/sessions", {
      mode: "payment",
      customer: customerId,
      "payment_method_types[0]": "card",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": "Slotm Credits",
      "line_items[0][price_data][unit_amount]": amountCoins,
      "line_items[0][quantity]": 1,
      "metadata[user_id]": userId,
      "metadata[kind]": "topup",
      "metadata[amount_coins]": amountCoins,
      "payment_intent_data[setup_future_usage]": "off_session",
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  async createSetupCheckoutSession({ customerId, successUrl, cancelUrl, userId }) {
    return this.request("POST", "/checkout/sessions", {
      mode: "setup",
      customer: customerId,
      "payment_method_types[0]": "card",
      "metadata[user_id]": userId,
      "metadata[kind]": "setup",
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  async getCheckoutSession(sessionId) {
    return this.request("GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`, null, {
      "expand[]": "payment_intent",
    });
  }

  async getSetupIntent(setupIntentId) {
    return this.request("GET", `/setup_intents/${encodeURIComponent(setupIntentId)}`);
  }

  async listPaymentMethods(customerId) {
    return this.request("GET", "/payment_methods", null, {
      customer: customerId,
      type: "card",
    });
  }

  async setDefaultPaymentMethod(customerId, paymentMethodId) {
    return this.request("POST", `/customers/${encodeURIComponent(customerId)}`, {
      "invoice_settings[default_payment_method]": paymentMethodId,
    });
  }
}
