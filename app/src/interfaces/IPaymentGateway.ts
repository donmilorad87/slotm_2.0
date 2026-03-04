import type {
  StripeCheckoutSession,
  StripeCustomer,
  StripePaymentMethod,
  StripePaymentMethodsList,
  StripeSetupIntent,
} from "../lib/stripe.js";

export interface TopupCheckoutParams {
  customerId: string;
  successUrl: string;
  cancelUrl: string;
  userId: number;
  amountCoins: number;
}

export interface SetupCheckoutParams {
  customerId: string;
  successUrl: string;
  cancelUrl: string;
  userId: number;
}

export interface IPaymentGateway {
  isConfigured(): boolean;
  createCustomer(params: { email: string }): Promise<StripeCustomer>;
  createTopupCheckoutSession(params: TopupCheckoutParams): Promise<StripeCheckoutSession>;
  createSetupCheckoutSession(params: SetupCheckoutParams): Promise<StripeCheckoutSession>;
  getCheckoutSession(id: string): Promise<StripeCheckoutSession>;
  getSetupIntent(id: string): Promise<StripeSetupIntent>;
  listPaymentMethods(customerId: string): Promise<StripePaymentMethodsList>;
  detachPaymentMethod(id: string): Promise<StripePaymentMethod>;
  setDefaultPaymentMethod(customerId: string, methodId: string): Promise<StripeCustomer>;
  clearDefaultPaymentMethod(customerId: string): Promise<StripeCustomer>;
}
