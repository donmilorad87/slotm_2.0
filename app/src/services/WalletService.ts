import type { AppConfig } from "../config/AppConfig.js";
import type { IPaymentGateway } from "../interfaces/IPaymentGateway.js";
import type { ITransactionRepository } from "../interfaces/ITransactionRepository.js";
import type { IUserRepository } from "../interfaces/IUserRepository.js";
import type { StripeCheckoutSession, StripePaymentMethod } from "../lib/stripe.js";
import type { SlotUser, WalletTransaction } from "../types/domain.js";
import type { PaginatedResult } from "../interfaces/ITransactionRepository.js";

export interface StripeFinalizeResult {
  flash: string;
}

interface StripeCheckoutQuery {
  session_id?: string;
  topup?: string;
  setup?: string;
}

function paymentMethodFromSession(session: StripeCheckoutSession): string | null {
  const paymentIntent = session.payment_intent;
  if (!paymentIntent) {
    return null;
  }
  if (typeof paymentIntent === "string") {
    return null;
  }
  return paymentIntent.payment_method || null;
}

export class WalletService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly txRepo: ITransactionRepository,
    private readonly payment: IPaymentGateway,
    private readonly config: AppConfig,
  ) {}

  async getBalanceCoins(userId: number): Promise<number> {
    return this.txRepo.getBalanceCoins(userId);
  }

  async getBalanceUnits(userId: number): Promise<number> {
    return this.txRepo.getBalanceUnits(userId);
  }

  async listTransactions(userId: number, limit?: number): Promise<WalletTransaction[]> {
    return this.txRepo.listTransactions(userId, limit);
  }

  async listTransactionsPage(
    userId: number,
    limit: number,
    skip: number,
  ): Promise<PaginatedResult<WalletTransaction>> {
    return this.txRepo.listTransactionsPage(userId, limit, skip);
  }

  async ensureStripeCustomer(user: SlotUser): Promise<SlotUser> {
    if (!this.payment.isConfigured()) {
      throw new Error("Stripe is not configured. Check STRIPE_SECRET.");
    }

    if (user.stripeCustomerId) {
      return user;
    }

    const customer = await this.payment.createCustomer({ email: user.email });
    await this.userRepo.updateUserStripeCustomer(user.id, customer.id);
    const updatedUser = await this.userRepo.getUserById(user.id);
    if (!updatedUser) {
      throw new Error("User not found after Stripe customer creation");
    }
    return updatedUser;
  }

  async createTopupSession(
    user: SlotUser,
    amountCoins: number,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ url: string | undefined }> {
    const customerUser = await this.ensureStripeCustomer(user);
    if (!customerUser.stripeCustomerId) {
      throw new Error("Stripe customer is missing");
    }

    const session = await this.payment.createTopupCheckoutSession({
      customerId: customerUser.stripeCustomerId,
      successUrl,
      cancelUrl,
      userId: customerUser.id,
      amountCoins,
    });

    return { url: session.url };
  }

  async createSetupSession(
    user: SlotUser,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ url: string | undefined }> {
    const customerUser = await this.ensureStripeCustomer(user);
    if (!customerUser.stripeCustomerId) {
      throw new Error("Stripe customer is missing");
    }

    const session = await this.payment.createSetupCheckoutSession({
      customerId: customerUser.stripeCustomerId,
      successUrl,
      cancelUrl,
      userId: customerUser.id,
    });

    return { url: session.url };
  }

  async removeCard(userId: number, paymentMethodId: string): Promise<void> {
    if (!this.payment.isConfigured()) {
      throw new Error("Stripe is not configured. Check STRIPE_SECRET.");
    }

    const user = await this.userRepo.getUserById(userId);
    if (!user?.stripeCustomerId) {
      throw new Error("No Stripe customer linked to this account");
    }

    const paymentMethods = await this.payment.listPaymentMethods(user.stripeCustomerId);
    const cards = Array.isArray(paymentMethods?.data) ? paymentMethods.data : [];
    const ownsCard = cards.some((pm) => String(pm?.id || "") === paymentMethodId);
    if (!ownsCard) {
      throw new CardNotFoundError("Card not found for this user");
    }

    if (user.defaultPaymentMethodId && user.defaultPaymentMethodId === paymentMethodId) {
      await this.payment.clearDefaultPaymentMethod(user.stripeCustomerId);
      await this.userRepo.updateUserDefaultPaymentMethod(user.id, null);
    }

    await this.payment.detachPaymentMethod(paymentMethodId);
  }

  async listCards(user: SlotUser): Promise<StripePaymentMethod[]> {
    if (!this.payment.isConfigured() || !user.stripeCustomerId) {
      return [];
    }

    try {
      const paymentMethods = await this.payment.listPaymentMethods(user.stripeCustomerId);
      return Array.isArray(paymentMethods?.data) ? paymentMethods.data : [];
    } catch (_: unknown) {
      return [];
    }
  }

  async finalizeStripeFromQuery(
    user: SlotUser,
    query: StripeCheckoutQuery,
  ): Promise<StripeFinalizeResult> {
    const sessionId = query.session_id || "";
    const topup = query.topup || "";
    const setup = query.setup || "";

    if (!sessionId || (topup !== "success" && setup !== "success")) {
      return { flash: "" };
    }

    if (!this.payment.isConfigured()) {
      return { flash: "Stripe is not configured on this server." };
    }

    try {
      const checkoutSession = await this.payment.getCheckoutSession(sessionId);
      const metadataUser = String(checkoutSession?.metadata?.user_id || "");
      if (metadataUser && metadataUser !== String(user.id)) {
        return { flash: "Session does not belong to current user." };
      }

      if (checkoutSession.mode === "payment" && topup === "success") {
        return this.finalizeTopup(user, checkoutSession);
      }

      if (checkoutSession.mode === "setup" && setup === "success") {
        return this.finalizeSetup(user, checkoutSession);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "unknown error";
      return { flash: `Stripe finalize failed: ${msg}` };
    }

    return { flash: "" };
  }

  async handleWebhookCheckoutCompleted(
    session: StripeCheckoutSession,
    webhookEventId: string,
  ): Promise<void> {
    const userId = Number.parseInt(String(session?.metadata?.user_id || "0"), 10);
    const user = await this.userRepo.getUserById(userId);
    if (!user) {
      return;
    }

    if (session.mode === "payment") {
      await this.processWebhookPayment(user, session, webhookEventId);
    }

    if (session.mode === "setup") {
      await this.processWebhookSetup(user, session);
    }
  }

  private async finalizeTopup(
    user: SlotUser,
    checkoutSession: StripeCheckoutSession,
  ): Promise<StripeFinalizeResult> {
    if (await this.txRepo.hasTransactionByProviderRef("stripe", checkoutSession.id)) {
      return { flash: "Top-up already processed." };
    }

    if (checkoutSession.payment_status !== "paid") {
      return { flash: "Payment is not completed yet." };
    }

    const amountCoins = Number.parseInt(
      String(
        checkoutSession?.metadata?.amount_coins ??
          Math.round(Number(checkoutSession.amount_total || 0) / 100),
      ),
      10,
    );
    if (!Number.isFinite(amountCoins) || amountCoins <= 0) {
      return { flash: "Invalid top-up amount from Stripe session." };
    }

    const newBalanceUnits = await this.txRepo.addBalanceUnits(user.id, amountCoins * 100);
    await this.txRepo.createTransaction({
      userId: user.id,
      type: "wallet_topup",
      direction: "credit",
      amountUnits: amountCoins * 100,
      balanceAfterUnits: newBalanceUnits,
      description: `Stripe top-up (${amountCoins} credits)`,
      provider: "stripe",
      providerRef: checkoutSession.id,
      metadata: {
        stripe_session_id: checkoutSession.id,
        amount_total: checkoutSession.amount_total ?? null,
      },
    });

    const paymentMethodId = paymentMethodFromSession(checkoutSession);
    if (paymentMethodId) {
      const latestUser = await this.userRepo.getUserById(user.id);
      if (latestUser?.stripeCustomerId) {
        await this.payment.setDefaultPaymentMethod(latestUser.stripeCustomerId, paymentMethodId);
      }
      await this.userRepo.updateUserDefaultPaymentMethod(user.id, paymentMethodId);
    }

    return { flash: `Top-up successful: +${amountCoins} credits.` };
  }

  private async finalizeSetup(
    user: SlotUser,
    checkoutSession: StripeCheckoutSession,
  ): Promise<StripeFinalizeResult> {
    const setupIntentId = checkoutSession.setup_intent;
    if (!setupIntentId) {
      return { flash: "Card setup succeeded, but no setup intent found." };
    }

    const setupIntent = await this.payment.getSetupIntent(setupIntentId);
    const paymentMethodId = setupIntent?.payment_method;
    if (!paymentMethodId) {
      return { flash: "Card setup succeeded, but payment method was not found." };
    }

    const latestUser = await this.userRepo.getUserById(user.id);
    if (latestUser?.stripeCustomerId) {
      await this.payment.setDefaultPaymentMethod(latestUser.stripeCustomerId, paymentMethodId);
    }
    await this.userRepo.updateUserDefaultPaymentMethod(user.id, paymentMethodId);
    return { flash: "Card added successfully." };
  }

  private async processWebhookPayment(
    user: SlotUser,
    session: StripeCheckoutSession,
    webhookEventId: string,
  ): Promise<void> {
    const sessionId = session.id;
    if (
      !sessionId ||
      session.payment_status !== "paid" ||
      (await this.txRepo.hasTransactionByProviderRef("stripe", sessionId))
    ) {
      return;
    }

    const amountCoins = Number.parseInt(
      String(
        session?.metadata?.amount_coins ||
          Math.round(Number(session.amount_total || 0) / 100),
      ),
      10,
    );

    if (Number.isFinite(amountCoins) && amountCoins > 0) {
      const newBalanceUnits = await this.txRepo.addBalanceUnits(user.id, amountCoins * 100);
      await this.txRepo.createTransaction({
        userId: user.id,
        type: "wallet_topup",
        direction: "credit",
        amountUnits: amountCoins * 100,
        balanceAfterUnits: newBalanceUnits,
        description: `Stripe webhook top-up (${amountCoins} credits)`,
        provider: "stripe",
        providerRef: sessionId,
        metadata: {
          webhook_event_id: webhookEventId,
          stripe_session_id: sessionId,
          amount_total: session.amount_total ?? null,
        },
      });
    }

    if (session.customer && !user.stripeCustomerId) {
      await this.userRepo.updateUserStripeCustomer(user.id, String(session.customer));
    }
  }

  private async processWebhookSetup(
    user: SlotUser,
    session: StripeCheckoutSession,
  ): Promise<void> {
    const setupIntentId = session.setup_intent;
    if (!setupIntentId || !this.payment.isConfigured()) {
      return;
    }

    try {
      const setupIntent = await this.payment.getSetupIntent(setupIntentId);
      const paymentMethodId = setupIntent?.payment_method || null;
      if (paymentMethodId) {
        const freshUser = await this.userRepo.getUserById(user.id);
        if (freshUser?.stripeCustomerId) {
          await this.payment.setDefaultPaymentMethod(freshUser.stripeCustomerId, paymentMethodId);
        }
        await this.userRepo.updateUserDefaultPaymentMethod(user.id, paymentMethodId);
      }
    } catch (_: unknown) {
      // Keep webhook response idempotent.
    }
  }
}

export class CardNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CardNotFoundError";
  }
}
