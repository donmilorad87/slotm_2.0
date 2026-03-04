import { jest } from "@jest/globals";
import type { IUserRepository } from "../../../src/interfaces/IUserRepository.js";
import type { ITransactionRepository, DeductBalanceResult } from "../../../src/interfaces/ITransactionRepository.js";
import type { IGameRepository } from "../../../src/interfaces/IGameRepository.js";
import type { IPaymentGateway } from "../../../src/interfaces/IPaymentGateway.js";
import type { SlotUser } from "../../../src/types/domain.js";
import type { AppConfig } from "../../../src/config/AppConfig.js";

export function createTestUser(overrides: Partial<SlotUser> = {}): SlotUser {
  return {
    id: 1,
    email: "test@example.com",
    passwordHash: "abc123hash",
    passwordSalt: "abc123salt",
    balanceUnits: 100_000,
    stripeCustomerId: null,
    defaultPaymentMethodId: null,
    firstName: null,
    lastName: null,
    profilePicture: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function createMockUserRepo(): jest.Mocked<IUserRepository> {
  return {
    createUser: jest.fn<IUserRepository["createUser"]>().mockResolvedValue(1),
    getUserByEmail: jest.fn<IUserRepository["getUserByEmail"]>().mockResolvedValue(null),
    getUserById: jest.fn<IUserRepository["getUserById"]>().mockResolvedValue(createTestUser()),
    updateUserStripeCustomer: jest.fn<IUserRepository["updateUserStripeCustomer"]>().mockResolvedValue(undefined),
    updateUserDefaultPaymentMethod: jest.fn<IUserRepository["updateUserDefaultPaymentMethod"]>().mockResolvedValue(undefined),
    updateUserProfile: jest.fn<IUserRepository["updateUserProfile"]>().mockResolvedValue(undefined),
    updateUserPassword: jest.fn<IUserRepository["updateUserPassword"]>().mockResolvedValue(undefined),
    updateUserProfilePicture: jest.fn<IUserRepository["updateUserProfilePicture"]>().mockResolvedValue(undefined),
  };
}

export function createMockTxRepo(): jest.Mocked<ITransactionRepository> {
  return {
    getBalanceUnits: jest.fn<ITransactionRepository["getBalanceUnits"]>().mockResolvedValue(100_000),
    getBalanceCoins: jest.fn<ITransactionRepository["getBalanceCoins"]>().mockResolvedValue(1000),
    deductBalanceUnitsIfSufficient: jest.fn<ITransactionRepository["deductBalanceUnitsIfSufficient"]>()
      .mockResolvedValue({ ok: true } as DeductBalanceResult),
    addBalanceUnits: jest.fn<ITransactionRepository["addBalanceUnits"]>().mockResolvedValue(100_000),
    hasTransactionByProviderRef: jest.fn<ITransactionRepository["hasTransactionByProviderRef"]>().mockResolvedValue(false),
    createTransaction: jest.fn<ITransactionRepository["createTransaction"]>().mockResolvedValue(1),
    listTransactions: jest.fn<ITransactionRepository["listTransactions"]>().mockResolvedValue([]),
    listTransactionsPage: jest.fn<ITransactionRepository["listTransactionsPage"]>().mockResolvedValue({ total: 0, items: [] }),
  };
}

export function createMockGameRepo(): jest.Mocked<IGameRepository> {
  return {
    saveSpin: jest.fn<IGameRepository["saveSpin"]>().mockResolvedValue(1),
    consumePendingMiniGame: jest.fn<IGameRepository["consumePendingMiniGame"]>().mockResolvedValue(1),
    attachMiniGameToHistory: jest.fn<IGameRepository["attachMiniGameToHistory"]>().mockResolvedValue(undefined),
    getUserHistory: jest.fn<IGameRepository["getUserHistory"]>().mockResolvedValue({ total: 0, items: [] }),
    getUserStats: jest.fn<IGameRepository["getUserStats"]>().mockResolvedValue({
      user_id: 1,
      total_spins: 0,
      total_wagered: 0,
      total_won: 0,
      total_net: 0,
      wins: 0,
      losses: 0,
      win_rate: 0,
      biggest_win: 0,
      biggest_loss: 0,
      mini_games_triggered: 0,
    }),
  };
}

export function createMockPaymentGateway(): jest.Mocked<IPaymentGateway> {
  return {
    isConfigured: jest.fn<IPaymentGateway["isConfigured"]>().mockReturnValue(true),
    createCustomer: jest.fn<IPaymentGateway["createCustomer"]>().mockResolvedValue({ id: "cus_test123" }),
    createTopupCheckoutSession: jest.fn<IPaymentGateway["createTopupCheckoutSession"]>()
      .mockResolvedValue({ id: "cs_test123", url: "https://checkout.stripe.com/test" }),
    createSetupCheckoutSession: jest.fn<IPaymentGateway["createSetupCheckoutSession"]>()
      .mockResolvedValue({ id: "cs_setup123", url: "https://checkout.stripe.com/setup" }),
    getCheckoutSession: jest.fn<IPaymentGateway["getCheckoutSession"]>().mockResolvedValue({ id: "cs_test123" }),
    getSetupIntent: jest.fn<IPaymentGateway["getSetupIntent"]>().mockResolvedValue({ id: "seti_test123", payment_method: "pm_test123" }),
    listPaymentMethods: jest.fn<IPaymentGateway["listPaymentMethods"]>().mockResolvedValue({ data: [] }),
    detachPaymentMethod: jest.fn<IPaymentGateway["detachPaymentMethod"]>().mockResolvedValue({ id: "pm_test123" }),
    setDefaultPaymentMethod: jest.fn<IPaymentGateway["setDefaultPaymentMethod"]>().mockResolvedValue({ id: "cus_test123" }),
    clearDefaultPaymentMethod: jest.fn<IPaymentGateway["clearDefaultPaymentMethod"]>().mockResolvedValue({ id: "cus_test123" }),
  };
}

export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 4300,
    host: "0.0.0.0",
    jwtSecret: "test-secret-key-at-least-32-chars-long",
    jwtIssuer: "slotm",
    jwtAudience: "slotm-web",
    jwtCookieMaxAgeSeconds: 86400,
    defaultJwtTtlSeconds: 86400 * 14,
    sessionTtlSeconds: 43200,
    nodeEnv: "test",
    jwtExpiresIn: "14d",
    jwtCookie: "slotm_jwt",
    sessionCookie: "slotm_sid",
    csrfCookie: "slotm_csrf",
    stripePublicKey: "",
    stripeSecret: "",
    stripeWebhookSecret: "",
    corsAllowedOrigins: new Set(["http://localhost:4300"]),
    distDir: "/tmp/test-dist",
    templateDir: "/tmp/test-dist/views",
    clientDir: "/tmp/test-dist/client",
    clientStylesDir: "/tmp/test-dist/client/styles",
    clientImagesDir: "/tmp/test-dist/client/images",
    uploadsDir: "/tmp/test-dist/uploads",
    slotMachineMarkupPath: "/tmp/test-dist/views/slot-machine-markup.html",
    historyPageSize: 20,
    walletTxPageSize: 20,
    maxUploadSize: 2 * 1024 * 1024,
    allowedMimeTypes: new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]),
    normalizeOrigin: (origin: string) => origin.trim().replace(/\/+$/, ""),
    ...overrides,
  } as AppConfig;
}
