import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { handleSlotMachineAction } from "./game/controller.js";
import { SlotStore } from "./game/store.js";
import { parseCookies, serializeCookie } from "./lib/cookies.js";
import { loadAppEnv } from "./lib/env.js";
import {
  readJsonBody,
  readRawBody,
  redirect,
  requestOrigin,
  safeJoin,
  sendHtml,
  sendJson,
  serveFile,
} from "./lib/http.js";
import { randomId, hashPassword, verifyPassword } from "./lib/security.js";
import { StripeClient } from "./lib/stripe.js";
import { buildStripeCheckoutReturnUrls } from "./lib/stripeRedirect.js";
import { verifyStripeWebhookSignature } from "./lib/stripeWebhook.js";
import { renderTemplate } from "./lib/template.js";

const __filename = fileURLToPath(import.meta.url);
const DIST_DIR = path.dirname(__filename);
const TEMPLATE_DIR = path.join(DIST_DIR, "views");
const CLIENT_DIR = path.join(DIST_DIR, "client");
const CLIENT_STYLES_DIR = path.join(CLIENT_DIR, "styles");

const PORT = Number(process.env.PORT || 4300);
const HOST = process.env.HOST || "0.0.0.0";
const SESSION_COOKIE = "slotm_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

const env = loadAppEnv();
const stripe = new StripeClient(env.STRIPE_SECRET || "");
const store = new SlotStore();

function defaultHeaders() {
  return {
    "Cache-Control": "no-store",
  };
}

function setSessionCookie(response, sessionId) {
  response.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE, sessionId, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      maxAge: SESSION_TTL_SECONDS,
    }),
  );
}

function clearSessionCookie(response) {
  response.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE, "", {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 0,
    }),
  );
}

function getClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return request.socket?.remoteAddress || "";
}

function sanitizeRedirectTarget(value, fallback = "/games/slot-machine") {
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

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts || "";
  }
}

function txRowsHtml(transactions) {
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

function cardRowsHtml(cards, defaultPaymentMethodId) {
  if (!cards.length) {
    return '<tr><td colspan="4">No saved cards yet.</td></tr>';
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
        </tr>
      `;
    })
    .join("");
}

function ensureAuthenticatedOrRedirect(request, response, user, nextPath) {
  if (user) {
    return true;
  }
  const next = encodeURIComponent(nextPath || "/games/slot-machine");
  redirect(response, `/login?next=${next}`);
  return false;
}

async function getAuthContext(request) {
  await store.cleanupExpiredSessions();
  const cookies = parseCookies(request.headers.cookie);
  const sessionId = cookies[SESSION_COOKIE];
  if (!sessionId) {
    return { user: null, session: null, sessionId: null };
  }

  const record = await store.getSessionWithUser(sessionId);
  if (!record) {
    return { user: null, session: null, sessionId: null };
  }

  if (new Date(record.session.expiresAt).getTime() <= Date.now()) {
    await store.deleteSession(sessionId);
    return { user: null, session: null, sessionId: null };
  }

  return {
    user: record.user,
    session: record.session,
    sessionId,
  };
}

async function ensureStripeCustomer(user) {
  if (!stripe.isConfigured()) {
    throw new Error("Stripe is not configured. Check STRIPE_SECRET.");
  }

  if (user.stripeCustomerId) {
    return user;
  }

  const customer = await stripe.createCustomer({ email: user.email });
  await store.updateUserStripeCustomer(user.id, customer.id);
  return await store.getUserById(user.id);
}

async function finalizeStripeFromQuery(user, url) {
  const sessionId = url.searchParams.get("session_id");
  const topup = url.searchParams.get("topup");
  const setup = url.searchParams.get("setup");

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
          amount_total: checkoutSession.amount_total,
        },
      });

      const paymentMethodId = checkoutSession?.payment_intent?.payment_method || null;
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
    return { flash: `Stripe finalize failed: ${error.message}` };
  }

  return { flash: "" };
}

async function handleGamePage(request, response, url, user) {
  const finalize = await finalizeStripeFromQuery(user, url);
  const freshUser = await store.getUserById(user.id);
  const userBalanceCoins = await store.getBalanceCoins(user.id);

  const html = await renderTemplate(path.join(TEMPLATE_DIR, "slot-machine.hbs"), {
    title: "Slot Machine - slotm",
    user_id: String(user.id),
    user_email: freshUser?.email || user.email,
    user_balance_coins: String(userBalanceCoins),
    jwt_token: "",
    stripe_public_key: env.STRIPE_KEY || "",
    flash_message: finalize.flash || "",
  });

  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    ...defaultHeaders(),
  });
  response.end(html);
}

async function handleWalletPage(request, response, url, user) {
  const finalize = await finalizeStripeFromQuery(user, url);
  const freshUser = await store.getUserById(user.id);
  const userBalanceCoins = await store.getBalanceCoins(user.id);

  let cards = [];
  if (stripe.isConfigured() && freshUser?.stripeCustomerId) {
    try {
      const paymentMethods = await stripe.listPaymentMethods(freshUser.stripeCustomerId);
      cards = Array.isArray(paymentMethods?.data) ? paymentMethods.data : [];
    } catch (error) {
      cards = [];
    }
  }

  const txRows = txRowsHtml(await store.listTransactions(user.id, 200));
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

  sendHtml(response, 200, html);
}

async function handleLoginPage(request, response, url, auth) {
  if (auth.user) {
    redirect(response, "/games/slot-machine");
    return;
  }
  const next = sanitizeRedirectTarget(url.searchParams.get("next"), "/games/slot-machine");
  const html = await renderTemplate(path.join(TEMPLATE_DIR, "login.hbs"), {
    title: "Login - slotm",
    next_path: next,
  });
  sendHtml(response, 200, html);
}

async function handleRegisterPage(request, response, url, auth) {
  if (auth.user) {
    redirect(response, "/games/slot-machine");
    return;
  }
  const next = sanitizeRedirectTarget(url.searchParams.get("next"), "/games/slot-machine");
  const html = await renderTemplate(path.join(TEMPLATE_DIR, "register.hbs"), {
    title: "Register - slotm",
    next_path: next,
  });
  sendHtml(response, 200, html);
}

async function handleAuthRegister(request, response) {
  try {
    const payload = await readJsonBody(request);
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");
    const next = sanitizeRedirectTarget(payload.next, "/games/slot-machine");

    if (!email || !email.includes("@")) {
      sendJson(response, 400, { success: false, message: "Valid email is required" });
      return;
    }
    if (password.length < 6) {
      sendJson(response, 400, { success: false, message: "Password must be at least 6 chars" });
      return;
    }
    if (await store.getUserByEmail(email)) {
      sendJson(response, 400, { success: false, message: "Email already registered" });
      return;
    }

    const pw = hashPassword(password);
    const userId = await store.createUser(email, pw.hash, pw.salt);
    const sessionId = randomId(32);
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

    await store.createSession(sessionId, userId, {
      userAgent: request.headers["user-agent"] || "",
      ipAddress: getClientIp(request),
      expiresAt,
    });

    setSessionCookie(response, sessionId);
    sendJson(response, 200, { success: true, data: { redirect: next } });
  } catch (error) {
    sendJson(response, 400, { success: false, message: error.message || "Register failed" });
  }
}

async function handleAuthLogin(request, response) {
  try {
    const payload = await readJsonBody(request);
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");
    const next = sanitizeRedirectTarget(payload.next, "/games/slot-machine");

    const user = await store.getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      sendJson(response, 401, { success: false, message: "Invalid credentials" });
      return;
    }

    const sessionId = randomId(32);
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    await store.createSession(sessionId, user.id, {
      userAgent: request.headers["user-agent"] || "",
      ipAddress: getClientIp(request),
      expiresAt,
    });

    setSessionCookie(response, sessionId);
    sendJson(response, 200, { success: true, data: { redirect: next } });
  } catch (error) {
    sendJson(response, 400, { success: false, message: error.message || "Login failed" });
  }
}

async function handleAuthLogout(request, response, auth) {
  if (auth.sessionId) {
    await store.deleteSession(auth.sessionId);
  }
  clearSessionCookie(response);
  sendJson(response, 200, { success: true, data: { redirect: "/login" } });
}

async function handleWalletCreateTopup(request, response, auth) {
  try {
    const payload = await readJsonBody(request);
    const amountCoins = Number.parseInt(String(payload.amountCoins || 0), 10);
    const returnTo = sanitizeRedirectTarget(payload.returnTo, "/wallet");

    if (!Number.isFinite(amountCoins) || amountCoins <= 0 || amountCoins > 100000) {
      sendJson(response, 400, { success: false, message: "Invalid top-up amount" });
      return;
    }

    let user = auth.user;
    user = await ensureStripeCustomer(user);

    const origin = requestOrigin(request);
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

    sendJson(response, 200, {
      success: true,
      data: {
        url: session.url,
      },
    });
  } catch (error) {
    sendJson(response, 400, {
      success: false,
      message: error.message || "Failed to create Stripe top-up session",
    });
  }
}

async function handleWalletCreateSetup(request, response, auth) {
  try {
    const payload = await readJsonBody(request);
    const returnTo = sanitizeRedirectTarget(payload.returnTo, "/wallet");
    let user = auth.user;
    user = await ensureStripeCustomer(user);

    const origin = requestOrigin(request);
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

    sendJson(response, 200, {
      success: true,
      data: {
        url: session.url,
      },
    });
  } catch (error) {
    sendJson(response, 400, {
      success: false,
      message: error.message || "Failed to create Stripe card setup session",
    });
  }
}

async function handleStripeWebhook(request, response) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    sendJson(response, 503, {
      success: false,
      message: "STRIPE_WEBHOOK_SECRET is not configured",
    });
    return;
  }

  let rawBody;
  try {
    rawBody = await readRawBody(request, 1024 * 1024 * 5);
  } catch (error) {
    sendJson(response, 400, { success: false, message: error.message || "Invalid body" });
    return;
  }

  const signatureHeaderRaw = request.headers["stripe-signature"];
  const signatureHeader = Array.isArray(signatureHeaderRaw)
    ? signatureHeaderRaw[0]
    : signatureHeaderRaw;
  const valid = verifyStripeWebhookSignature({
    payloadBuffer: rawBody,
    signatureHeader,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  });

  if (!valid) {
    sendJson(response, 400, { success: false, message: "Invalid Stripe signature" });
    return;
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    sendJson(response, 400, { success: false, message: "Invalid webhook JSON" });
    return;
  }

  try {
    if (event?.type === "checkout.session.completed") {
      const session = event?.data?.object || {};
      const mode = session.mode;
      const userId = Number.parseInt(String(session?.metadata?.user_id || "0"), 10);
      const user = await store.getUserById(userId);

      if (user) {
        if (mode === "payment") {
          const paymentStatus = session.payment_status;
          const sessionId = session.id;

          if (sessionId && paymentStatus === "paid" && !(await store.hasTransactionByProviderRef("stripe", sessionId))) {
            const amountCoins = Number.parseInt(
              String(session?.metadata?.amount_coins || Math.round(Number(session.amount_total || 0) / 100)),
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
                  amount_total: session.amount_total,
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
              // swallow to keep webhook idempotent response
            }
          }
        }
      }
    }
  } catch (error) {
    sendJson(response, 500, {
      success: false,
      message: error.message || "Webhook processing failed",
    });
    return;
  }

  sendJson(response, 200, { success: true, received: true });
}

async function handleApiGames(request, response, auth) {
  try {
    const payload = await readJsonBody(request);
    const result = await handleSlotMachineAction(payload, store, auth.user.id);
    sendJson(response, result.statusCode, result.body);
  } catch (error) {
    sendJson(response, 400, {
      success: false,
      message: error.message || "Invalid request",
    });
  }
}

async function handleWalletBalance(response, auth) {
  sendJson(response, 200, {
    success: true,
    data: {
      balance_coins: await store.getBalanceCoins(auth.user.id),
      balance_units: await store.getBalanceUnits(auth.user.id),
    },
  });
}

async function handleWalletTransactions(response, auth) {
  sendJson(response, 200, {
    success: true,
    data: {
      transactions: await store.listTransactions(auth.user.id, 200),
    },
  });
}

async function handleStaticAssets(response, pathname) {
  if (pathname.startsWith("/assets/js/")) {
    const rel = pathname.slice("/assets/js/".length);
    const filePath = safeJoin(CLIENT_DIR, rel);
    if (!filePath) {
      sendJson(response, 403, { success: false, message: "Forbidden" });
      return;
    }
    await serveFile(response, filePath);
    return;
  }

  if (pathname.startsWith("/assets/css/")) {
    const rel = pathname.slice("/assets/css/".length);
    const filePath = safeJoin(CLIENT_STYLES_DIR, rel);
    if (!filePath) {
      sendJson(response, 403, { success: false, message: "Forbidden" });
      return;
    }
    await serveFile(response, filePath);
    return;
  }

  sendJson(response, 404, { success: false, message: "Not found" });
}

async function start() {
  await store.init();
  console.log("[slotm] PostgreSQL migrations applied");

  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", requestOrigin(request));
    const pathname = url.pathname;
    const auth = await getAuthContext(request);

    if (request.method === "GET" && pathname.startsWith("/assets/")) {
      await handleStaticAssets(response, pathname);
      return;
    }

    if (request.method === "GET" && pathname === "/register") {
      await handleRegisterPage(request, response, url, auth);
      return;
    }

    if (request.method === "GET" && pathname === "/login") {
      await handleLoginPage(request, response, url, auth);
      return;
    }

    if (request.method === "GET" && pathname === "/logout") {
      if (auth.sessionId) {
        await store.deleteSession(auth.sessionId);
      }
      clearSessionCookie(response);
      redirect(response, "/login");
      return;
    }

    if (request.method === "POST" && pathname === "/api/auth/register") {
      await handleAuthRegister(request, response);
      return;
    }

    if (request.method === "POST" && pathname === "/api/auth/login") {
      await handleAuthLogin(request, response);
      return;
    }

    if (request.method === "POST" && pathname === "/api/auth/logout") {
      await handleAuthLogout(request, response, auth);
      return;
    }

    if (request.method === "POST" && pathname === "/api/wallet/stripe/webhook") {
      await handleStripeWebhook(request, response);
      return;
    }

    if (request.method === "GET" && pathname === "/") {
      if (auth.user) {
        redirect(response, "/games/slot-machine");
      } else {
        redirect(response, "/login");
      }
      return;
    }

    if (request.method === "GET" && pathname === "/games/slot-machine") {
      if (!ensureAuthenticatedOrRedirect(request, response, auth.user, pathname)) {
        return;
      }
      await handleGamePage(request, response, url, auth.user);
      return;
    }

    if (request.method === "GET" && pathname === "/wallet") {
      if (!ensureAuthenticatedOrRedirect(request, response, auth.user, pathname)) {
        return;
      }
      await handleWalletPage(request, response, url, auth.user);
      return;
    }

    if (request.method === "POST" && pathname === "/api/games/slot-machine") {
      if (!auth.user) {
        sendJson(response, 401, { success: false, message: "Unauthorized" });
        return;
      }
      await handleApiGames(request, response, auth);
      return;
    }

    if (request.method === "POST" && pathname === "/api/wallet/create-checkout-session") {
      if (!auth.user) {
        sendJson(response, 401, { success: false, message: "Unauthorized" });
        return;
      }
      await handleWalletCreateTopup(request, response, auth);
      return;
    }

    if (request.method === "POST" && pathname === "/api/wallet/create-setup-session") {
      if (!auth.user) {
        sendJson(response, 401, { success: false, message: "Unauthorized" });
        return;
      }
      await handleWalletCreateSetup(request, response, auth);
      return;
    }

    if (request.method === "GET" && pathname === "/api/wallet/balance") {
      if (!auth.user) {
        sendJson(response, 401, { success: false, message: "Unauthorized" });
        return;
      }
      await handleWalletBalance(response, auth);
      return;
    }

    if (request.method === "GET" && pathname === "/api/wallet/transactions") {
      if (!auth.user) {
        sendJson(response, 401, { success: false, message: "Unauthorized" });
        return;
      }
      await handleWalletTransactions(response, auth);
      return;
    }

    sendJson(response, 404, { success: false, message: "Not found" });
  });

  server.listen(PORT, HOST, () => {
    console.log(`slotm running at http://${HOST}:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start slotm:", error);
  process.exitCode = 1;
});
