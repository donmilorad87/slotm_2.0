import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import compression from "compression";
import cors from "cors";
import express from "express";
import type { Request, Response } from "express";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import type { ParsedQs } from "qs";
import rateLimit from "express-rate-limit";

import { handleSlotMachineAction } from "./game/controller.js";
import { SlotStore } from "./game/store.js";
import { loadAppEnv } from "./lib/env.js";
import { hashPassword, verifyPassword } from "./lib/security.js";
import {
  StripeClient,
  type StripeCheckoutSession,
  type StripePaymentMethod,
} from "./lib/stripe.js";
import { buildStripeCheckoutReturnUrls } from "./lib/stripeRedirect.js";
import { verifyStripeWebhookSignature } from "./lib/stripeWebhook.js";
import { renderTemplate } from "./lib/template.js";
import { createJwtAuthMiddlewares } from "./middlewares/auth.middleware.js";
import { attachRequestContext } from "./middlewares/request-context.middleware.js";
import { registerRoutes } from "./routes/index.js";
import type {
  RequestAuthWithUser,
  SlotUser,
  WalletTransaction,
} from "./types/domain.js";

const __filename = fileURLToPath(import.meta.url);
const DIST_DIR = path.dirname(__filename);
const TEMPLATE_DIR = path.join(DIST_DIR, "views");
const CLIENT_DIR = path.join(DIST_DIR, "client");
const CLIENT_STYLES_DIR = path.join(CLIENT_DIR, "styles");
const CLIENT_IMAGES_DIR = path.join(CLIENT_DIR, "images");

const PORT = Number(process.env.PORT || 4300);
const HOST = process.env.HOST || "0.0.0.0";
const JWT_COOKIE = "slotm_jwt";
const DEFAULT_JWT_TTL_SECONDS = 60 * 60 * 24 * 14;
const JWT_ISSUER = "slotm";
const JWT_AUDIENCE = "slotm-web";
const HISTORY_PAGE_SIZE = 20;
const WALLET_TX_PAGE_SIZE = 20;

const env = loadAppEnv();
const jwtSecret = env.JWT_SECRET || "dev-jwt-secret-change-me";
const jwtCookieMaxAgeSeconds = Number.parseInt(
  String(env.JWT_COOKIE_MAX_AGE_SECONDS || DEFAULT_JWT_TTL_SECONDS),
  10,
);

if (!env.JWT_SECRET) {
  console.warn("[slotm] JWT_SECRET is not set; using development fallback secret");
}

const stripe = new StripeClient(env.STRIPE_SECRET || "");
const store = new SlotStore();
const {
  optionalJwt,
  requireJwt,
  setJwtCookie,
  clearJwtCookie,
} = createJwtAuthMiddlewares({
  store,
  jwtSecret,
  jwtIssuer: JWT_ISSUER,
  jwtAudience: JWT_AUDIENCE,
  jwtCookie: JWT_COOKIE,
  jwtCookieMaxAgeSeconds,
  defaultJwtTtlSeconds: DEFAULT_JWT_TTL_SECONDS,
  nodeEnv: env.NODE_ENV,
});

interface StripeCheckoutQuery {
  [key: string]: unknown;
  session_id?: string;
  topup?: string;
  setup?: string;
}

interface StripeFinalizeResult {
  flash: string;
}

function toErrorMessage(errorValue: unknown, fallback: string): string {
  if (errorValue instanceof Error && errorValue.message) {
    return errorValue.message;
  }
  return fallback;
}

function requireAuthUser(req: Request): RequestAuthWithUser {
  const auth = req.auth;
  if (!auth?.user) {
    throw new Error("Unauthorized");
  }
  return auth as RequestAuthWithUser;
}

function sanitizeRedirectTarget(value: unknown, fallback = "/"): string {
  if (!value || typeof value !== "string") {
    return fallback;
  }
  if (!value.startsWith("/")) {
    return fallback;
  }
  if (value.startsWith("//")) {
    return fallback;
  }
  return value;
}

function toInt(value: unknown, fallback = 0): number {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function queryString(
  query: ParsedQs | Record<string, unknown> | undefined,
  key: string,
): string {
  const value = query?.[key];
  if (Array.isArray(value)) {
    return String(value[0] || "");
  }
  return String(value || "");
}

function issueJwtToken(user: SlotUser): string {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
    },
    jwtSecret,
    {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: (env.JWT_EXPIRES_IN || "14d") as jwt.SignOptions["expiresIn"],
    },
  );
}

function requestOriginExpress(req: Request): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto)
    ? String(forwardedProto[0] || "")
    : String(forwardedProto || req.protocol || "http");
  const normalizedProto = proto.split(",")[0]?.trim() || "http";
  return `${normalizedProto}://${req.get("host") || `localhost:${PORT}`}`;
}

function formatDate(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts || "";
  }
}

function txRowsHtml(transactions: WalletTransaction[]): string {
  if (!transactions.length) {
    return '<tr><td colspan="5">No transactions yet.</td></tr>';
  }

  return transactions
    .map((tx) => {
      const sign = tx.signed_amount_coins >= 0 ? "+" : "";
      const amountClass = tx.signed_amount_coins >= 0 ? "tx-credit" : "tx-debit";
      return `
        <tr>
          <td>${formatDate(tx.created_at)}</td>
          <td>${tx.type}</td>
          <td class="${amountClass}">${sign}${tx.signed_amount_coins.toFixed(2)}</td>
          <td>${tx.description || "-"}</td>
          <td>${tx.provider || "-"}</td>
        </tr>
      `;
    })
    .join("");
}

function cardRowsHtml(cards: StripePaymentMethod[], defaultPaymentMethodId: string): string {
  if (!cards.length) {
    return '<tr><td colspan="5">No saved cards yet.</td></tr>';
  }

  return cards
    .map((cardObj) => {
      const card = cardObj.card || {};
      const isDefault = cardObj.id === defaultPaymentMethodId;
      return `
        <tr>
          <td>${card.brand || "card"}</td>
          <td>**** **** **** ${card.last4 || "----"}</td>
          <td>${card.exp_month || "--"}/${card.exp_year || "--"}</td>
          <td>${isDefault ? "Default" : ""}</td>
          <td>
            <button type="button" class="btn btn--ghost wallet-remove-card" data-payment-method-id="${cardObj.id}">
              Remove
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
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

async function ensureStripeCustomer(user: SlotUser): Promise<SlotUser> {
  if (!stripe.isConfigured()) {
    throw new Error("Stripe is not configured. Check STRIPE_SECRET.");
  }

  if (user.stripeCustomerId) {
    return user;
  }

  const customer = await stripe.createCustomer({ email: user.email });
  await store.updateUserStripeCustomer(user.id, customer.id);
  const updatedUser = await store.getUserById(user.id);
  if (!updatedUser) {
    throw new Error("User not found after Stripe customer creation");
  }
  return updatedUser;
}

async function finalizeStripeFromQuery(
  user: SlotUser,
  query: ParsedQs | StripeCheckoutQuery,
): Promise<StripeFinalizeResult> {
  const sessionId = queryString(query, "session_id");
  const topup = queryString(query, "topup");
  const setup = queryString(query, "setup");

  if (!sessionId || (topup !== "success" && setup !== "success")) {
    return { flash: "" };
  }

  if (!stripe.isConfigured()) {
    return { flash: "Stripe is not configured on this server." };
  }

  try {
    const checkoutSession = await stripe.getCheckoutSession(sessionId);
    const metadataUser = String(checkoutSession?.metadata?.user_id || "");
    if (metadataUser && metadataUser !== String(user.id)) {
      return { flash: "Session does not belong to current user." };
    }

    if (checkoutSession.mode === "payment" && topup === "success") {
      if (await store.hasTransactionByProviderRef("stripe", checkoutSession.id)) {
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

      const newBalanceUnits = await store.addBalanceUnits(user.id, amountCoins * 100);
      await store.createTransaction({
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
        const latestUser = await store.getUserById(user.id);
        if (latestUser?.stripeCustomerId) {
          await stripe.setDefaultPaymentMethod(latestUser.stripeCustomerId, paymentMethodId);
        }
        await store.updateUserDefaultPaymentMethod(user.id, paymentMethodId);
      }

      return { flash: `Top-up successful: +${amountCoins} credits.` };
    }

    if (checkoutSession.mode === "setup" && setup === "success") {
      const setupIntentId = checkoutSession.setup_intent;
      if (!setupIntentId) {
        return { flash: "Card setup succeeded, but no setup intent found." };
      }

      const setupIntent = await stripe.getSetupIntent(setupIntentId);
      const paymentMethodId = setupIntent?.payment_method;
      if (!paymentMethodId) {
        return { flash: "Card setup succeeded, but payment method was not found." };
      }

      const latestUser = await store.getUserById(user.id);
      if (latestUser?.stripeCustomerId) {
        await stripe.setDefaultPaymentMethod(latestUser.stripeCustomerId, paymentMethodId);
      }
      await store.updateUserDefaultPaymentMethod(user.id, paymentMethodId);
      return { flash: "Card added successfully." };
    }
  } catch (error) {
    return { flash: `Stripe finalize failed: ${toErrorMessage(error, "unknown error")}` };
  }

  return { flash: "" };
}

interface AuthRequestBody {
  email?: unknown;
  password?: unknown;
  next?: unknown;
}

interface WalletTopupBody {
  amountCoins?: unknown;
  returnTo?: unknown;
}

interface WalletSetupBody {
  returnTo?: unknown;
}

interface WalletRemoveCardBody {
  paymentMethodId?: unknown;
}

async function handleGamePage(req: Request, res: Response): Promise<void> {
  const auth = requireAuthUser(req);
  const user = auth.user;
  const finalize = await finalizeStripeFromQuery(user, req.query || {});
  const freshUser = await store.getUserById(user.id);
  const userBalanceCoins = await store.getBalanceCoins(user.id);

  const html = await renderTemplate(path.join(TEMPLATE_DIR, "slot-machine.hbs"), {
    title: "Slot Machine - slotm",
    user_id: String(user.id),
    user_email: freshUser?.email || user.email,
    user_balance_coins: String(userBalanceCoins),
    jwt_token: auth.token || "",
    stripe_public_key: env.STRIPE_KEY || "",
    flash_message: finalize.flash || "",
  });

  res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
}

async function handleGamesPage(req: Request, res: Response): Promise<void> {
  const auth = requireAuthUser(req);
  const user = auth.user;

  const html = await renderTemplate(path.join(TEMPLATE_DIR, "games.hbs"), {
    title: "Games - slotm",
    user_email: user.email,
  });

  res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
}

async function handleWalletPage(req: Request, res: Response): Promise<void> {
  const auth = requireAuthUser(req);
  const user = auth.user;
  const finalize = await finalizeStripeFromQuery(user, req.query || {});
  const freshUser = await store.getUserById(user.id);
  const userBalanceCoins = await store.getBalanceCoins(user.id);

  let cards: StripePaymentMethod[] = [];
  if (stripe.isConfigured() && freshUser?.stripeCustomerId) {
    try {
      const paymentMethods = await stripe.listPaymentMethods(freshUser.stripeCustomerId);
      cards = Array.isArray(paymentMethods?.data) ? paymentMethods.data : [];
    } catch {
      cards = [];
    }
  }

  const txRows = txRowsHtml(await store.listTransactions(user.id, WALLET_TX_PAGE_SIZE));
  const cardRows = cardRowsHtml(cards, freshUser?.defaultPaymentMethodId || "");

  const html = await renderTemplate(path.join(TEMPLATE_DIR, "wallet.hbs"), {
    title: "Wallet - slotm",
    user_email: freshUser?.email || user.email,
    user_balance_coins: String(userBalanceCoins),
    flash_message: finalize.flash || "",
    transactions_rows_html: txRows,
    cards_rows_html: cardRows,
    stripe_configured: stripe.isConfigured() ? "yes" : "no",
  });

  res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
}

async function handleRootPage(req: Request, res: Response): Promise<void> {
  const auth = requireAuthUser(req);
  const user = auth.user;

  try {
    const html = await renderTemplate(path.join(TEMPLATE_DIR, "home.hbs"), {
      title: "Blazing Sun - Home",
      user_email: user.email,
    });
    res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: toErrorMessage(error, "Failed to render homepage"),
    });
  }
}

async function handleLoginPage(req: Request, res: Response): Promise<void> {
  if (req.auth?.user) {
    res.redirect("/");
    return;
  }

  const next = sanitizeRedirectTarget(queryString(req.query, "next"), "/");
  const html = await renderTemplate(path.join(TEMPLATE_DIR, "login.hbs"), {
    title: "Login - slotm",
    next_path: next,
  });

  res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
}

async function handleRegisterPage(req: Request, res: Response): Promise<void> {
  if (req.auth?.user) {
    res.redirect("/");
    return;
  }

  const next = sanitizeRedirectTarget(queryString(req.query, "next"), "/");
  const html = await renderTemplate(path.join(TEMPLATE_DIR, "register.hbs"), {
    title: "Register - slotm",
    next_path: next,
  });

  res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
}

async function handleAuthRegister(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const payload = (req.body || {}) as AuthRequestBody;
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");
    const next = sanitizeRedirectTarget(payload.next, "/");

    if (!email || !email.includes("@")) {
      res.status(400).json({ success: false, message: "Valid email is required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ success: false, message: "Password must be at least 6 chars" });
      return;
    }
    if (await store.getUserByEmail(email)) {
      res.status(400).json({ success: false, message: "Email already registered" });
      return;
    }

    const pw = hashPassword(password);
    const userId = await store.createUser(email, pw.hash, pw.salt);
    const user = await store.getUserById(userId);
    if (!user) {
      throw new Error("Failed to load created user");
    }
    const token = issueJwtToken(user);

    setJwtCookie(req, res, token);
    res.status(200).json({ success: true, data: { redirect: next, token } });
  } catch (error) {
    res.status(400).json({ success: false, message: toErrorMessage(error, "Register failed") });
  }
}

async function handleAuthLogin(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const payload = (req.body || {}) as AuthRequestBody;
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");
    const next = sanitizeRedirectTarget(payload.next, "/");

    const user = await store.getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const token = issueJwtToken(user);
    setJwtCookie(req, res, token);
    res.status(200).json({ success: true, data: { redirect: next, token } });
  } catch (error) {
    res.status(400).json({ success: false, message: toErrorMessage(error, "Login failed") });
  }
}

function handleAuthLogout(req: Request, res: Response): void {
  clearJwtCookie(req, res);
  res.status(200).json({ success: true, data: { redirect: "/login" } });
}

function handleLogoutPage(req: Request, res: Response): void {
  clearJwtCookie(req, res);
  res.redirect("/login");
}

async function handleWalletCreateTopup(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const payload = (req.body || {}) as WalletTopupBody;
    const amountCoins = Number.parseInt(String(payload.amountCoins || 0), 10);
    const returnTo = sanitizeRedirectTarget(payload.returnTo, "/wallet");

    if (!Number.isFinite(amountCoins) || amountCoins <= 0 || amountCoins > 100000) {
      res.status(400).json({ success: false, message: "Invalid top-up amount" });
      return;
    }

    let user = requireAuthUser(req).user;
    user = await ensureStripeCustomer(user);
    if (!user.stripeCustomerId) {
      throw new Error("Stripe customer is missing");
    }

    const origin = requestOriginExpress(req);
    const { successUrl, cancelUrl } = buildStripeCheckoutReturnUrls(
      origin,
      returnTo,
      "topup",
    );

    const session = await stripe.createTopupCheckoutSession({
      customerId: user.stripeCustomerId,
      successUrl,
      cancelUrl,
      userId: user.id,
      amountCoins,
    });

    res.status(200).json({
      success: true,
      data: { url: session.url },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: toErrorMessage(error, "Failed to create Stripe top-up session"),
    });
  }
}

async function handleWalletCreateSetup(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const payload = (req.body || {}) as WalletSetupBody;
    const returnTo = sanitizeRedirectTarget(payload.returnTo, "/wallet");
    let user = requireAuthUser(req).user;
    user = await ensureStripeCustomer(user);
    if (!user.stripeCustomerId) {
      throw new Error("Stripe customer is missing");
    }

    const origin = requestOriginExpress(req);
    const { successUrl, cancelUrl } = buildStripeCheckoutReturnUrls(
      origin,
      returnTo,
      "setup",
    );

    const session = await stripe.createSetupCheckoutSession({
      customerId: user.stripeCustomerId,
      successUrl,
      cancelUrl,
      userId: user.id,
    });

    res.status(200).json({
      success: true,
      data: { url: session.url },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: toErrorMessage(error, "Failed to create Stripe card setup session"),
    });
  }
}

async function handleWalletRemoveCard(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!stripe.isConfigured()) {
      res.status(503).json({
        success: false,
        message: "Stripe is not configured. Check STRIPE_SECRET.",
      });
      return;
    }

    const payload = (req.body || {}) as WalletRemoveCardBody;
    const paymentMethodId = String(payload.paymentMethodId || "").trim();
    if (!paymentMethodId) {
      res.status(400).json({
        success: false,
        message: "paymentMethodId is required",
      });
      return;
    }

    const auth = requireAuthUser(req);
    const user = await store.getUserById(auth.user.id);
    if (!user?.stripeCustomerId) {
      res.status(400).json({
        success: false,
        message: "No Stripe customer linked to this account",
      });
      return;
    }

    const paymentMethods = await stripe.listPaymentMethods(user.stripeCustomerId);
    const cards = Array.isArray(paymentMethods?.data) ? paymentMethods.data : [];
    const ownsCard = cards.some((pm) => String(pm?.id || "") === paymentMethodId);
    if (!ownsCard) {
      res.status(404).json({
        success: false,
        message: "Card not found for this user",
      });
      return;
    }

    if (user.defaultPaymentMethodId && user.defaultPaymentMethodId === paymentMethodId) {
      await stripe.clearDefaultPaymentMethod(user.stripeCustomerId);
      await store.updateUserDefaultPaymentMethod(user.id, null);
    }

    await stripe.detachPaymentMethod(paymentMethodId);

    res.status(200).json({
      success: true,
      data: {
        removed: true,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: toErrorMessage(error, "Failed to remove card"),
    });
  }
}

interface StripeWebhookEvent {
  id?: string;
  type?: string;
  data?: {
    object?: StripeCheckoutSession;
  };
}

async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({
      success: false,
      message: "STRIPE_WEBHOOK_SECRET is not configured",
    });
    return;
  }

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(req.body || "", "utf8");

  const signatureHeaderRaw = req.headers["stripe-signature"];
  const signatureHeader = Array.isArray(signatureHeaderRaw)
    ? signatureHeaderRaw[0]
    : signatureHeaderRaw;

  const valid = verifyStripeWebhookSignature({
    payloadBuffer: rawBody,
    signatureHeader,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  });

  if (!valid) {
    res.status(400).json({ success: false, message: "Invalid Stripe signature" });
    return;
  }

  let event: StripeWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8")) as StripeWebhookEvent;
  } catch {
    res.status(400).json({ success: false, message: "Invalid webhook JSON" });
    return;
  }

  try {
    if (event?.type === "checkout.session.completed") {
      const session = event?.data?.object || ({} as StripeCheckoutSession);
      const mode = session.mode;
      const userId = Number.parseInt(String(session?.metadata?.user_id || "0"), 10);
      const user = await store.getUserById(userId);

      if (user) {
        if (mode === "payment") {
          const paymentStatus = session.payment_status;
          const sessionId = session.id;

          if (
            sessionId &&
            paymentStatus === "paid" &&
            !(await store.hasTransactionByProviderRef("stripe", sessionId))
          ) {
            const amountCoins = Number.parseInt(
              String(
                session?.metadata?.amount_coins ||
                  Math.round(Number(session.amount_total || 0) / 100),
              ),
              10,
            );

            if (Number.isFinite(amountCoins) && amountCoins > 0) {
              const newBalanceUnits = await store.addBalanceUnits(user.id, amountCoins * 100);
              await store.createTransaction({
                userId: user.id,
                type: "wallet_topup",
                direction: "credit",
                amountUnits: amountCoins * 100,
                balanceAfterUnits: newBalanceUnits,
                description: `Stripe webhook top-up (${amountCoins} credits)`,
                provider: "stripe",
                providerRef: sessionId,
                metadata: {
                  webhook_event_id: event.id || "",
                  stripe_session_id: sessionId,
                  amount_total: session.amount_total ?? null,
                },
              });
            }
          }

          if (session.customer && !user.stripeCustomerId) {
            await store.updateUserStripeCustomer(user.id, String(session.customer));
          }
        }

        if (mode === "setup") {
          const setupIntentId = session.setup_intent;
          if (setupIntentId && stripe.isConfigured()) {
            try {
              const setupIntent = await stripe.getSetupIntent(setupIntentId);
              const paymentMethodId = setupIntent?.payment_method || null;
              if (paymentMethodId) {
                const freshUser = await store.getUserById(user.id);
                if (freshUser?.stripeCustomerId) {
                  await stripe.setDefaultPaymentMethod(freshUser.stripeCustomerId, paymentMethodId);
                }
                await store.updateUserDefaultPaymentMethod(user.id, paymentMethodId);
              }
            } catch {
              // Keep webhook response idempotent.
            }
          }
        }
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: toErrorMessage(error, "Webhook processing failed"),
    });
    return;
  }

  res.status(200).json({ success: true, received: true });
}

async function handleApiGames(req: Request, res: Response): Promise<void> {
  try {
    const payload = req.body || {};
    const auth = requireAuthUser(req);
    const result = await handleSlotMachineAction(payload, store, auth.user.id);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: toErrorMessage(error, "Invalid request"),
    });
  }
}

async function handleHistoryApi(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuthUser(req);
    const requestedPage = Math.max(1, toInt(queryString(req.query, "page"), 1));
    const { total } = await store.getUserHistory(auth.user.id, 1, 0);
    const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    const skip = (page - 1) * HISTORY_PAGE_SIZE;
    const full = await store.getUserHistory(auth.user.id, HISTORY_PAGE_SIZE, skip);

    res.status(200).json({
      success: true,
      data: {
        total: full.total,
        history: full.items,
        page,
        total_pages: totalPages,
        has_more: page < totalPages,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: toErrorMessage(error, "Could not load history"),
    });
  }
}

async function handleWalletBalance(req: Request, res: Response): Promise<void> {
  const auth = requireAuthUser(req);
  res.status(200).json({
    success: true,
    data: {
      balance_coins: await store.getBalanceCoins(auth.user.id),
      balance_units: await store.getBalanceUnits(auth.user.id),
    },
  });
}

async function handleWalletTransactions(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuthUser(req);
    const requestedPage = Math.max(1, toInt(queryString(req.query, "page"), 1));

    let page = requestedPage;
    let skip = (page - 1) * WALLET_TX_PAGE_SIZE;
    let result = await store.listTransactionsPage(
      auth.user.id,
      WALLET_TX_PAGE_SIZE,
      skip,
    );

    const totalPages = Math.max(1, Math.ceil(result.total / WALLET_TX_PAGE_SIZE));

    if (page > totalPages) {
      page = totalPages;
      skip = (page - 1) * WALLET_TX_PAGE_SIZE;
      result = await store.listTransactionsPage(
        auth.user.id,
        WALLET_TX_PAGE_SIZE,
        skip,
      );
    }

    res.status(200).json({
      success: true,
      data: {
        total: result.total,
        transactions: result.items,
        page,
        total_pages: totalPages,
        has_more: page < totalPages,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: toErrorMessage(error, "Could not load wallet transactions"),
    });
  }
}

async function start(): Promise<void> {
  await store.init();
  console.log("[slotm] PostgreSQL migrations applied");

  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(attachRequestContext);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
    }),
  );

  morgan.token("rid", (req) => (req as Request).requestId || "-");
  morgan.token("uid", (req) => {
    const request = req as Request;
    return request.auth?.user ? String(request.auth.user.id) : "-";
  });
  app.use(
    morgan(
      ":date[iso] rid=:rid uid=:uid :method :url :status :response-time ms :res[content-length]",
    ),
  );

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/assets/images", express.static(CLIENT_IMAGES_DIR, { index: false, fallthrough: false }));
  app.use("/assets/js", express.static(CLIENT_DIR, { index: false, fallthrough: false }));
  app.use("/assets/css", express.static(CLIENT_STYLES_DIR, { index: false, fallthrough: false }));

  app.post("/api/wallet/stripe/webhook", express.raw({ type: "application/json", limit: "5mb" }), handleStripeWebhook);

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  app.use("/api", apiLimiter);

  registerRoutes(app, {
    optionalJwt,
    requireJwt,
    authLimiter,
    handleRootPage,
    handleGamesPage,
    handleLoginPage,
    handleRegisterPage,
    handleLogoutPage,
    handleAuthRegister,
    handleAuthLogin,
    handleAuthLogout,
    handleGamePage,
    handleWalletPage,
    handleApiGames,
    handleHistoryApi,
    handleWalletCreateTopup,
    handleWalletCreateSetup,
    handleWalletRemoveCard,
    handleWalletBalance,
    handleWalletTransactions,
  });

  app.use((req: Request, res: Response) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ success: false, message: "Not found" });
      return;
    }

    res.status(404).type("text/plain").send("Not found");
  });

  const server = createServer(app);
  server.listen(PORT, HOST, () => {
    console.log(`[slotm] Express server running at http://${HOST}:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start slotm:", error);
  process.exitCode = 1;
});
