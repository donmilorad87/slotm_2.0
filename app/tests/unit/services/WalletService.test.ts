import { describe, it, expect, beforeEach } from "@jest/globals";
import { WalletService, CardNotFoundError } from "../../../src/services/WalletService.js";
import {
  createMockUserRepo,
  createMockTxRepo,
  createMockPaymentGateway,
  createTestConfig,
  createTestUser,
} from "../helpers/mockFactories.js";

import type { jest } from "@jest/globals";
import type { IUserRepository } from "../../../src/interfaces/IUserRepository.js";
import type { ITransactionRepository } from "../../../src/interfaces/ITransactionRepository.js";
import type { IPaymentGateway } from "../../../src/interfaces/IPaymentGateway.js";
import type { AppConfig } from "../../../src/config/AppConfig.js";

let userRepo: jest.Mocked<IUserRepository>;
let txRepo: jest.Mocked<ITransactionRepository>;
let payment: jest.Mocked<IPaymentGateway>;
let config: AppConfig;
let service: WalletService;

beforeEach(() => {
  userRepo = createMockUserRepo();
  txRepo = createMockTxRepo();
  payment = createMockPaymentGateway();
  config = createTestConfig();
  service = new WalletService(userRepo, txRepo, payment, config);
});

describe("WalletService.getBalanceCoins", () => {
  it("delegates to txRepo", async () => {
    txRepo.getBalanceCoins.mockResolvedValue(500);
    const result = await service.getBalanceCoins(1);
    expect(result).toBe(500);
    expect(txRepo.getBalanceCoins).toHaveBeenCalledWith(1);
  });
});

describe("WalletService.getBalanceUnits", () => {
  it("delegates to txRepo", async () => {
    txRepo.getBalanceUnits.mockResolvedValue(50000);
    const result = await service.getBalanceUnits(1);
    expect(result).toBe(50000);
  });
});

describe("WalletService.ensureStripeCustomer", () => {
  it("returns user if already has stripeCustomerId", async () => {
    const user = createTestUser({ stripeCustomerId: "cus_existing" });
    const result = await service.ensureStripeCustomer(user);
    expect(result.stripeCustomerId).toBe("cus_existing");
    expect(payment.createCustomer).not.toHaveBeenCalled();
  });

  it("creates new customer and returns updated user", async () => {
    const user = createTestUser({ stripeCustomerId: null });
    const updatedUser = createTestUser({ stripeCustomerId: "cus_new123" });
    userRepo.getUserById.mockResolvedValue(updatedUser);

    const result = await service.ensureStripeCustomer(user);
    expect(payment.createCustomer).toHaveBeenCalledWith({ email: user.email });
    expect(userRepo.updateUserStripeCustomer).toHaveBeenCalled();
    expect(result.stripeCustomerId).toBe("cus_new123");
  });

  it("throws when Stripe is not configured", async () => {
    payment.isConfigured.mockReturnValue(false);
    const user = createTestUser({ stripeCustomerId: null });
    await expect(service.ensureStripeCustomer(user)).rejects.toThrow("not configured");
  });
});

describe("WalletService.createTopupSession", () => {
  it("creates session and returns URL", async () => {
    const user = createTestUser({ stripeCustomerId: "cus_123" });
    userRepo.getUserById.mockResolvedValue(user);

    const result = await service.createTopupSession(user, 100, "/success", "/cancel");
    expect(result.url).toBeDefined();
    expect(payment.createTopupCheckoutSession).toHaveBeenCalled();
  });
});

describe("WalletService.removeCard", () => {
  it("throws when Stripe is not configured", async () => {
    payment.isConfigured.mockReturnValue(false);
    await expect(service.removeCard(1, "pm_123")).rejects.toThrow("not configured");
  });

  it("throws when user has no Stripe customer", async () => {
    userRepo.getUserById.mockResolvedValue(createTestUser({ stripeCustomerId: null }));
    await expect(service.removeCard(1, "pm_123")).rejects.toThrow("No Stripe customer");
  });

  it("throws CardNotFoundError when card not owned by user", async () => {
    userRepo.getUserById.mockResolvedValue(createTestUser({ stripeCustomerId: "cus_123" }));
    payment.listPaymentMethods.mockResolvedValue({ data: [{ id: "pm_other" }] });

    await expect(service.removeCard(1, "pm_123")).rejects.toThrow(CardNotFoundError);
  });

  it("clears default and detaches when removing default card", async () => {
    const user = createTestUser({
      stripeCustomerId: "cus_123",
      defaultPaymentMethodId: "pm_123",
    });
    userRepo.getUserById.mockResolvedValue(user);
    payment.listPaymentMethods.mockResolvedValue({ data: [{ id: "pm_123" }] });

    await service.removeCard(1, "pm_123");
    expect(payment.clearDefaultPaymentMethod).toHaveBeenCalledWith("cus_123");
    expect(userRepo.updateUserDefaultPaymentMethod).toHaveBeenCalledWith(1, null);
    expect(payment.detachPaymentMethod).toHaveBeenCalledWith("pm_123");
  });

  it("detaches without clearing default for non-default card", async () => {
    const user = createTestUser({
      stripeCustomerId: "cus_123",
      defaultPaymentMethodId: "pm_other",
    });
    userRepo.getUserById.mockResolvedValue(user);
    payment.listPaymentMethods.mockResolvedValue({
      data: [{ id: "pm_123" }, { id: "pm_other" }],
    });

    await service.removeCard(1, "pm_123");
    expect(payment.clearDefaultPaymentMethod).not.toHaveBeenCalled();
    expect(payment.detachPaymentMethod).toHaveBeenCalledWith("pm_123");
  });
});

describe("WalletService.listCards", () => {
  it("returns empty array when Stripe not configured", async () => {
    payment.isConfigured.mockReturnValue(false);
    const result = await service.listCards(createTestUser());
    expect(result).toEqual([]);
  });

  it("returns empty array when no stripeCustomerId", async () => {
    const result = await service.listCards(createTestUser({ stripeCustomerId: null }));
    expect(result).toEqual([]);
  });

  it("returns payment methods when configured", async () => {
    const cards = [{ id: "pm_1" }, { id: "pm_2" }];
    payment.listPaymentMethods.mockResolvedValue({ data: cards });
    const result = await service.listCards(createTestUser({ stripeCustomerId: "cus_123" }));
    expect(result).toEqual(cards);
  });
});

describe("WalletService.handleWebhookCheckoutCompleted", () => {
  it("skips unknown user (no userId in metadata)", async () => {
    userRepo.getUserById.mockResolvedValue(null);
    await service.handleWebhookCheckoutCompleted(
      { id: "cs_123", mode: "payment", metadata: { user_id: "0" } },
      "evt_123",
    );
    expect(txRepo.addBalanceUnits).not.toHaveBeenCalled();
  });

  it("skips duplicate transaction", async () => {
    userRepo.getUserById.mockResolvedValue(createTestUser());
    txRepo.hasTransactionByProviderRef.mockResolvedValue(true);

    await service.handleWebhookCheckoutCompleted(
      {
        id: "cs_123",
        mode: "payment",
        payment_status: "paid",
        metadata: { user_id: "1", amount_coins: "100" },
      },
      "evt_123",
    );
    expect(txRepo.addBalanceUnits).not.toHaveBeenCalled();
  });

  it("adds balance for valid payment webhook", async () => {
    userRepo.getUserById.mockResolvedValue(createTestUser());
    txRepo.hasTransactionByProviderRef.mockResolvedValue(false);
    txRepo.addBalanceUnits.mockResolvedValue(110_000);

    await service.handleWebhookCheckoutCompleted(
      {
        id: "cs_123",
        mode: "payment",
        payment_status: "paid",
        metadata: { user_id: "1", amount_coins: "100" },
      },
      "evt_123",
    );
    expect(txRepo.addBalanceUnits).toHaveBeenCalledWith(1, 10_000);
    expect(txRepo.createTransaction).toHaveBeenCalled();
  });

  it("processes setup mode webhook", async () => {
    userRepo.getUserById.mockResolvedValue(createTestUser({ stripeCustomerId: "cus_123" }));

    await service.handleWebhookCheckoutCompleted(
      {
        id: "cs_123",
        mode: "setup",
        setup_intent: "seti_123",
        metadata: { user_id: "1" },
      },
      "evt_123",
    );
    expect(payment.getSetupIntent).toHaveBeenCalledWith("seti_123");
  });

  it("updates stripe customer when session has customer and user has none", async () => {
    const user = createTestUser({ stripeCustomerId: null });
    userRepo.getUserById.mockResolvedValue(user);
    txRepo.hasTransactionByProviderRef.mockResolvedValue(false);
    txRepo.addBalanceUnits.mockResolvedValue(110_000);

    await service.handleWebhookCheckoutCompleted(
      {
        id: "cs_123",
        mode: "payment",
        payment_status: "paid",
        customer: "cus_from_webhook",
        metadata: { user_id: "1", amount_coins: "100" },
      },
      "evt_123",
    );
    expect(userRepo.updateUserStripeCustomer).toHaveBeenCalledWith(1, "cus_from_webhook");
  });

  it("skips payment when payment_status is not paid", async () => {
    userRepo.getUserById.mockResolvedValue(createTestUser());
    txRepo.hasTransactionByProviderRef.mockResolvedValue(false);

    await service.handleWebhookCheckoutCompleted(
      {
        id: "cs_123",
        mode: "payment",
        payment_status: "unpaid",
        metadata: { user_id: "1", amount_coins: "100" },
      },
      "evt_123",
    );
    expect(txRepo.addBalanceUnits).not.toHaveBeenCalled();
  });

  it("skips setup webhook when no setup_intent", async () => {
    userRepo.getUserById.mockResolvedValue(createTestUser({ stripeCustomerId: "cus_123" }));

    await service.handleWebhookCheckoutCompleted(
      {
        id: "cs_123",
        mode: "setup",
        metadata: { user_id: "1" },
      },
      "evt_123",
    );
    expect(payment.getSetupIntent).not.toHaveBeenCalled();
  });
});

describe("WalletService.listTransactions", () => {
  it("delegates to txRepo", async () => {
    const txList = [
      { id: 1, userId: 1, type: "wallet_topup" as const, direction: "credit" as const, amountUnits: 1000, balanceAfterUnits: 1000, description: "test", createdAt: "2025-01-01" },
    ];
    txRepo.listTransactions.mockResolvedValue(txList);
    const result = await service.listTransactions(1, 10);
    expect(result).toEqual(txList);
    expect(txRepo.listTransactions).toHaveBeenCalledWith(1, 10);
  });

  it("passes undefined limit", async () => {
    txRepo.listTransactions.mockResolvedValue([]);
    await service.listTransactions(1);
    expect(txRepo.listTransactions).toHaveBeenCalledWith(1, undefined);
  });
});

describe("WalletService.listTransactionsPage", () => {
  it("delegates to txRepo with pagination", async () => {
    const paginated = { total: 50, items: [] };
    txRepo.listTransactionsPage.mockResolvedValue(paginated);
    const result = await service.listTransactionsPage(1, 20, 0);
    expect(result).toEqual(paginated);
    expect(txRepo.listTransactionsPage).toHaveBeenCalledWith(1, 20, 0);
  });

  it("passes skip parameter correctly", async () => {
    txRepo.listTransactionsPage.mockResolvedValue({ total: 100, items: [] });
    await service.listTransactionsPage(1, 20, 40);
    expect(txRepo.listTransactionsPage).toHaveBeenCalledWith(1, 20, 40);
  });
});

describe("WalletService.createSetupSession", () => {
  it("creates setup session and returns URL", async () => {
    const user = createTestUser({ stripeCustomerId: "cus_123" });
    userRepo.getUserById.mockResolvedValue(user);

    const result = await service.createSetupSession(user, "/success", "/cancel");
    expect(result.url).toBeDefined();
    expect(payment.createSetupCheckoutSession).toHaveBeenCalled();
  });

  it("ensures stripe customer before creating setup session", async () => {
    const user = createTestUser({ stripeCustomerId: null });
    const updatedUser = createTestUser({ stripeCustomerId: "cus_new" });
    userRepo.getUserById.mockResolvedValue(updatedUser);

    await service.createSetupSession(user, "/success", "/cancel");
    expect(payment.createCustomer).toHaveBeenCalledWith({ email: user.email });
    expect(payment.createSetupCheckoutSession).toHaveBeenCalled();
  });
});

describe("WalletService.finalizeStripeFromQuery", () => {
  const user = createTestUser({ stripeCustomerId: "cus_123" });

  it("returns empty flash when no session_id", async () => {
    const result = await service.finalizeStripeFromQuery(user, { topup: "success" });
    expect(result.flash).toBe("");
  });

  it("returns empty flash when neither topup nor setup is success", async () => {
    const result = await service.finalizeStripeFromQuery(user, {
      session_id: "cs_123",
      topup: "cancel",
    });
    expect(result.flash).toBe("");
  });

  it("returns error flash when Stripe is not configured", async () => {
    payment.isConfigured.mockReturnValue(false);
    const result = await service.finalizeStripeFromQuery(user, {
      session_id: "cs_123",
      topup: "success",
    });
    expect(result.flash).toContain("not configured");
  });

  it("returns error when session belongs to different user", async () => {
    payment.getCheckoutSession.mockResolvedValue({
      id: "cs_123",
      mode: "payment",
      metadata: { user_id: "999" },
    });
    const result = await service.finalizeStripeFromQuery(user, {
      session_id: "cs_123",
      topup: "success",
    });
    expect(result.flash).toContain("does not belong");
  });

  it("finalizes topup successfully", async () => {
    payment.getCheckoutSession.mockResolvedValue({
      id: "cs_123",
      mode: "payment",
      payment_status: "paid",
      metadata: { user_id: "1", amount_coins: "50" },
    });
    txRepo.hasTransactionByProviderRef.mockResolvedValue(false);
    txRepo.addBalanceUnits.mockResolvedValue(105_000);
    userRepo.getUserById.mockResolvedValue(user);

    const result = await service.finalizeStripeFromQuery(user, {
      session_id: "cs_123",
      topup: "success",
    });
    expect(result.flash).toContain("Top-up successful");
    expect(result.flash).toContain("50");
  });

  it("returns already processed for duplicate topup", async () => {
    payment.getCheckoutSession.mockResolvedValue({
      id: "cs_123",
      mode: "payment",
      payment_status: "paid",
      metadata: { user_id: "1", amount_coins: "50" },
    });
    txRepo.hasTransactionByProviderRef.mockResolvedValue(true);

    const result = await service.finalizeStripeFromQuery(user, {
      session_id: "cs_123",
      topup: "success",
    });
    expect(result.flash).toContain("already processed");
  });

  it("returns error when payment not completed", async () => {
    payment.getCheckoutSession.mockResolvedValue({
      id: "cs_123",
      mode: "payment",
      payment_status: "unpaid",
      metadata: { user_id: "1" },
    });
    txRepo.hasTransactionByProviderRef.mockResolvedValue(false);

    const result = await service.finalizeStripeFromQuery(user, {
      session_id: "cs_123",
      topup: "success",
    });
    expect(result.flash).toContain("not completed");
  });

  it("finalizes setup successfully", async () => {
    payment.getCheckoutSession.mockResolvedValue({
      id: "cs_123",
      mode: "setup",
      setup_intent: "seti_123",
      metadata: { user_id: "1" },
    });
    payment.getSetupIntent.mockResolvedValue({
      id: "seti_123",
      payment_method: "pm_new",
    });
    userRepo.getUserById.mockResolvedValue(user);

    const result = await service.finalizeStripeFromQuery(user, {
      session_id: "cs_123",
      setup: "success",
    });
    expect(result.flash).toContain("Card added");
  });

  it("handles Stripe API errors gracefully", async () => {
    payment.getCheckoutSession.mockRejectedValue(new Error("Stripe API down"));

    const result = await service.finalizeStripeFromQuery(user, {
      session_id: "cs_123",
      topup: "success",
    });
    expect(result.flash).toContain("Stripe finalize failed");
    expect(result.flash).toContain("Stripe API down");
  });

  it("returns empty flash when mode doesn't match query param", async () => {
    payment.getCheckoutSession.mockResolvedValue({
      id: "cs_123",
      mode: "setup",
      metadata: { user_id: "1" },
    });

    const result = await service.finalizeStripeFromQuery(user, {
      session_id: "cs_123",
      topup: "success",
    });
    expect(result.flash).toBe("");
  });
});

describe("WalletService.listCards error handling", () => {
  it("returns empty array when listPaymentMethods throws", async () => {
    payment.listPaymentMethods.mockRejectedValue(new Error("Stripe error"));
    const result = await service.listCards(createTestUser({ stripeCustomerId: "cus_123" }));
    expect(result).toEqual([]);
  });
});

describe("CardNotFoundError", () => {
  it("has correct name", () => {
    const err = new CardNotFoundError("test");
    expect(err.name).toBe("CardNotFoundError");
  });

  it("is instance of Error", () => {
    const err = new CardNotFoundError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("has correct message", () => {
    const err = new CardNotFoundError("card not found");
    expect(err.message).toBe("card not found");
  });
});
