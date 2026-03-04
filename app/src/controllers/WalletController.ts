import type { Request, RequestHandler, Response } from "express";

import type { AppConfig } from "../config/AppConfig.js";
import type { StripeCheckoutSession } from "../lib/stripe.js";
import type { BalanceData, PaginatedPageData, StripeUrlData, WalletTransaction } from "../types/domain.js";
import { verifyStripeWebhookSignature } from "../lib/stripeWebhook.js";
import { buildStripeCheckoutReturnUrls } from "../lib/stripeRedirect.js";
import { asObject } from "../lib/payloadParsers.js";
import { CardNotFoundError, type WalletService } from "../services/WalletService.js";
import { BaseController, toErrorMessage } from "./BaseController.js";

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

interface StripeWebhookEvent {
  id?: string;
  type?: string;
  data?: {
    object?: StripeCheckoutSession;
  };
}

function isStripeWebhookEvent(value: unknown): value is StripeWebhookEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    (obj.type === undefined || typeof obj.type === "string") &&
    (obj.id === undefined || typeof obj.id === "string")
  );
}

function requestOriginExpress(req: Request, port: number): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto)
    ? String(forwardedProto[0] || "")
    : String(forwardedProto || req.protocol || "http");
  const normalizedProto = proto.split(",")[0]?.trim() || "http";
  return `${normalizedProto}://${req.get("host") || `localhost:${port}`}`;
}

export class WalletController extends BaseController {
  constructor(
    private readonly walletService: WalletService,
    private readonly config: AppConfig,
  ) {
    super();
  }

  get handleBalance(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      const auth = this.requireAuthUser(req);
      const data: BalanceData = {
        balance_coins: await this.walletService.getBalanceCoins(auth.user.id),
        balance_units: await this.walletService.getBalanceUnits(auth.user.id),
      };
      res.status(200).json({ success: true, data });
    });
  }

  get handleTransactions(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const auth = this.requireAuthUser(req);
        const requestedPage = Math.max(
          1,
          this.toInt(this.queryString(req.query, "page"), 1),
        );

        let page = requestedPage;
        let skip = (page - 1) * this.config.walletTxPageSize;
        let result = await this.walletService.listTransactionsPage(
          auth.user.id,
          this.config.walletTxPageSize,
          skip,
        );

        const totalPages = Math.max(1, Math.ceil(result.total / this.config.walletTxPageSize));

        if (page > totalPages) {
          page = totalPages;
          skip = (page - 1) * this.config.walletTxPageSize;
          result = await this.walletService.listTransactionsPage(
            auth.user.id,
            this.config.walletTxPageSize,
            skip,
          );
        }

        const data: PaginatedPageData<WalletTransaction> = {
          total: result.total,
          items: result.items,
          page,
          total_pages: totalPages,
          has_more: page < totalPages,
        };
        res.status(200).json({ success: true, data });
      } catch (error: unknown) {
        res.status(400).json({
          success: false,
          message: toErrorMessage(error, "Could not load wallet transactions"),
        });
      }
    });
  }

  get handleCreateTopup(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const payload = asObject<WalletTopupBody>(req.body);
        const amountCoins = Number.parseInt(String(payload.amountCoins || 0), 10);
        const returnTo = this.sanitizeRedirectTarget(payload.returnTo, "/wallet");

        if (!Number.isFinite(amountCoins) || amountCoins <= 0 || amountCoins > 100000) {
          res.status(400).json({ success: false, message: "Invalid top-up amount" });
          return;
        }

        const user = this.requireAuthUser(req).user;
        const origin = requestOriginExpress(req, this.config.port);
        const { successUrl, cancelUrl } = buildStripeCheckoutReturnUrls(origin, returnTo, "topup");

        const session = await this.walletService.createTopupSession(
          user,
          amountCoins,
          successUrl,
          cancelUrl,
        );

        const data: StripeUrlData = { url: session.url };
        res.status(200).json({ success: true, data });
      } catch (error: unknown) {
        res.status(400).json({
          success: false,
          message: toErrorMessage(error, "Failed to create Stripe top-up session"),
        });
      }
    });
  }

  get handleCreateSetup(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const payload = asObject<WalletSetupBody>(req.body);
        const returnTo = this.sanitizeRedirectTarget(payload.returnTo, "/wallet");
        const user = this.requireAuthUser(req).user;
        const origin = requestOriginExpress(req, this.config.port);
        const { successUrl, cancelUrl } = buildStripeCheckoutReturnUrls(origin, returnTo, "setup");

        const session = await this.walletService.createSetupSession(user, successUrl, cancelUrl);
        const data: StripeUrlData = { url: session.url };
        res.status(200).json({ success: true, data });
      } catch (error: unknown) {
        res.status(400).json({
          success: false,
          message: toErrorMessage(error, "Failed to create Stripe card setup session"),
        });
      }
    });
  }

  get handleRemoveCard(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const payload = asObject<WalletRemoveCardBody>(req.body);
        const paymentMethodId = String(payload.paymentMethodId || "").trim();
        if (!paymentMethodId) {
          res.status(400).json({ success: false, message: "paymentMethodId is required" });
          return;
        }

        const auth = this.requireAuthUser(req);
        await this.walletService.removeCard(auth.user.id, paymentMethodId);
        res.status(200).json({ success: true, data: { removed: true } });
      } catch (error: unknown) {
        if (error instanceof CardNotFoundError) {
          res.status(404).json({ success: false, message: error.message });
          return;
        }
        res.status(400).json({
          success: false,
          message: toErrorMessage(error, "Failed to remove card"),
        });
      }
    });
  }

  get handleStripeWebhook(): RequestHandler {
    return async (req: Request, res: Response) => {
      if (!this.config.stripeWebhookSecret) {
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
        webhookSecret: this.config.stripeWebhookSecret,
        ...(signatureHeader ? { signatureHeader } : {}),
      });

      if (!valid) {
        res.status(400).json({ success: false, message: "Invalid Stripe signature" });
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody.toString("utf8"));
      } catch (_: unknown) {
        res.status(400).json({ success: false, message: "Invalid webhook JSON" });
        return;
      }

      if (!isStripeWebhookEvent(parsed)) {
        res.status(400).json({ success: false, message: "Invalid webhook payload structure" });
        return;
      }

      try {
        if (parsed.type === "checkout.session.completed") {
          const session = parsed.data?.object;
          if (!session) {
            res.status(400).json({ success: false, message: "Missing checkout session in webhook" });
            return;
          }
          await this.walletService.handleWebhookCheckoutCompleted(
            session,
            parsed.id || "",
          );
        }
      } catch (error: unknown) {
        res.status(500).json({
          success: false,
          message: toErrorMessage(error, "Webhook processing failed"),
        });
        return;
      }

      res.status(200).json({ success: true, received: true });
    };
  }
}
