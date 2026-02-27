type StripePrimitive = string | number | boolean;
type StripeParams = Record<string, StripePrimitive | null | undefined>;

export interface StripeCustomer {
  id: string;
  email?: string | null;
}

export interface StripePaymentMethodCard {
  brand?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
}

export interface StripePaymentMethod {
  id: string;
  card?: StripePaymentMethodCard;
}

export interface StripePaymentMethodsList {
  data: StripePaymentMethod[];
}

export interface StripePaymentIntentRef {
  payment_method?: string | null;
}

export interface StripeCheckoutSession {
  id: string;
  url?: string;
  mode?: "payment" | "setup" | string;
  payment_status?: string;
  amount_total?: number;
  metadata?: Record<string, string>;
  payment_intent?: StripePaymentIntentRef | string | null;
  setup_intent?: string | null;
  customer?: string | null;
}

export interface StripeSetupIntent {
  id: string;
  payment_method?: string | null;
}

function encodeFormObject(obj: StripeParams): string {
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
  private readonly secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey || "";
  }

  isConfigured(): boolean {
    return this.secretKey.startsWith("sk_");
  }

  async request<T>(
    method: "GET" | "POST",
    endpoint: string,
    form: StripeParams | null = null,
    query: StripeParams | null = null,
  ): Promise<T> {
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

    const headers: Record<string, string> = {
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

    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const errorObj = payload.error as { message?: string } | undefined;
      const msg = errorObj?.message || `Stripe API error (${response.status})`;
      throw new Error(msg);
    }

    return payload as T;
  }

  async createCustomer({ email }: { email: string }): Promise<StripeCustomer> {
    return this.request<StripeCustomer>("POST", "/customers", { email });
  }

  async createTopupCheckoutSession({
    customerId,
    successUrl,
    cancelUrl,
    userId,
    amountCoins,
  }: {
    customerId: string;
    successUrl: string;
    cancelUrl: string;
    userId: number;
    amountCoins: number;
  }): Promise<StripeCheckoutSession> {
    return this.request<StripeCheckoutSession>("POST", "/checkout/sessions", {
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

  async createSetupCheckoutSession({
    customerId,
    successUrl,
    cancelUrl,
    userId,
  }: {
    customerId: string;
    successUrl: string;
    cancelUrl: string;
    userId: number;
  }): Promise<StripeCheckoutSession> {
    return this.request<StripeCheckoutSession>("POST", "/checkout/sessions", {
      mode: "setup",
      customer: customerId,
      "payment_method_types[0]": "card",
      "metadata[user_id]": userId,
      "metadata[kind]": "setup",
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  async getCheckoutSession(sessionId: string): Promise<StripeCheckoutSession> {
    return this.request<StripeCheckoutSession>(
      "GET",
      `/checkout/sessions/${encodeURIComponent(sessionId)}`,
      null,
      {
      "expand[]": "payment_intent",
      },
    );
  }

  async getSetupIntent(setupIntentId: string): Promise<StripeSetupIntent> {
    return this.request<StripeSetupIntent>(
      "GET",
      `/setup_intents/${encodeURIComponent(setupIntentId)}`,
    );
  }

  async listPaymentMethods(customerId: string): Promise<StripePaymentMethodsList> {
    return this.request<StripePaymentMethodsList>("GET", "/payment_methods", null, {
      customer: customerId,
      type: "card",
    });
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<StripeCustomer> {
    return this.request<StripeCustomer>(
      "POST",
      `/customers/${encodeURIComponent(customerId)}`,
      {
      "invoice_settings[default_payment_method]": paymentMethodId,
      },
    );
  }

  async clearDefaultPaymentMethod(customerId: string): Promise<StripeCustomer> {
    return this.request<StripeCustomer>(
      "POST",
      `/customers/${encodeURIComponent(customerId)}`,
      {
      "invoice_settings[default_payment_method]": "",
      },
    );
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<StripePaymentMethod> {
    return this.request<StripePaymentMethod>(
      "POST",
      `/payment_methods/${encodeURIComponent(paymentMethodId)}/detach`,
    );
  }
}
