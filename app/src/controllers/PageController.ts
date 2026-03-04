import { promises as fs } from "node:fs";
import path from "node:path";

import type { Request, RequestHandler, Response } from "express";

import type { AppConfig } from "../config/AppConfig.js";
import type { IPaymentGateway } from "../interfaces/IPaymentGateway.js";
import type { IUserRepository } from "../interfaces/IUserRepository.js";
import type { StripePaymentMethod } from "../lib/stripe.js";
import { renderTemplate } from "../lib/template.js";
import type { WalletService } from "../services/WalletService.js";
import type { WalletTransaction } from "../types/domain.js";
import { BaseController, type UserTemplateData } from "./BaseController.js";

/** Template context base: compatible with renderTemplate's Record<string, unknown>. */
type TemplateContext = Record<string, unknown>;

/** Base template context: every authenticated page has a title + user data. */
type BaseTemplateContext = TemplateContext & UserTemplateData & { title: string };

/** Login/register pages: unauthenticated, with redirect target. */
type AuthPageContext = TemplateContext & { title: string; next_path: string };

/** Slot machine page context. */
type GamePageContext = BaseTemplateContext & {
  user_id: string;
  user_balance_coins: string;
  jwt_token: string;
  slot_machine_markup: string;
  stripe_public_key: string;
  flash_message: string;
};

/** Wallet page context. */
type WalletPageContext = BaseTemplateContext & {
  user_balance_coins: string;
  flash_message: string;
  transactions_rows_html: string;
  cards_rows_html: string;
  stripe_configured: string;
};

function formatDate(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch (_: unknown) {
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

export class PageController extends BaseController {
  private slotMachineMarkupCache = "";

  constructor(
    private readonly walletService: WalletService,
    private readonly userRepo: IUserRepository,
    private readonly payment: IPaymentGateway,
    private readonly config: AppConfig,
  ) {
    super();
  }

  private async getSlotMachineMarkup(): Promise<string> {
    if (this.slotMachineMarkupCache) {
      return this.slotMachineMarkupCache;
    }
    this.slotMachineMarkupCache = await fs.readFile(this.config.slotMachineMarkupPath, "utf8");
    return this.slotMachineMarkupCache;
  }

  get handleRootPage(): RequestHandler {
    return this.pageHandler(async (req: Request, res: Response) => {
      const auth = this.requireAuthUser(req);
      const ctx: BaseTemplateContext = {
        title: "Blazing Sun - Home",
        ...this.userTemplateData(auth.user),
      };
      const html = await renderTemplate(path.join(this.config.templateDir, "home.hbs"), ctx);
      res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
    });
  }

  get handleGamesPage(): RequestHandler {
    return this.pageHandler(async (req: Request, res: Response) => {
      const auth = this.requireAuthUser(req);
      const ctx: BaseTemplateContext = {
        title: "Games - slotm",
        ...this.userTemplateData(auth.user),
      };
      const html = await renderTemplate(path.join(this.config.templateDir, "games.hbs"), ctx);
      res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
    });
  }

  get handleGamePage(): RequestHandler {
    return this.pageHandler(async (req: Request, res: Response) => {
      const auth = this.requireAuthUser(req);
      const user = auth.user;
      const finalize = await this.walletService.finalizeStripeFromQuery(user, {
        session_id: this.queryString(req.query, "session_id"),
        topup: this.queryString(req.query, "topup"),
        setup: this.queryString(req.query, "setup"),
      });
      const freshUser = await this.userRepo.getUserById(user.id);
      const userBalanceCoins = await this.walletService.getBalanceCoins(user.id);

      const profileUser = freshUser || user;
      const ctx: GamePageContext = {
        title: "Slot Machine - slotm",
        user_id: String(user.id),
        user_balance_coins: String(userBalanceCoins),
        jwt_token: auth.token || "",
        slot_machine_markup: await this.getSlotMachineMarkup(),
        stripe_public_key: this.config.stripePublicKey,
        flash_message: finalize.flash || "",
        ...this.userTemplateData(profileUser),
      };
      const html = await renderTemplate(path.join(this.config.templateDir, "slot-machine.hbs"), ctx);

      res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
    });
  }

  get handleWalletPage(): RequestHandler {
    return this.pageHandler(async (req: Request, res: Response) => {
      const auth = this.requireAuthUser(req);
      const user = auth.user;
      const finalize = await this.walletService.finalizeStripeFromQuery(user, {
        session_id: this.queryString(req.query, "session_id"),
        topup: this.queryString(req.query, "topup"),
        setup: this.queryString(req.query, "setup"),
      });
      const freshUser = await this.userRepo.getUserById(user.id);
      const userBalanceCoins = await this.walletService.getBalanceCoins(user.id);

      const cards = await this.walletService.listCards(freshUser || user);
      const txRows = txRowsHtml(
        await this.walletService.listTransactions(user.id, this.config.walletTxPageSize),
      );
      const cardRows = cardRowsHtml(cards, freshUser?.defaultPaymentMethodId || "");

      const walletUser = freshUser || user;
      const ctx: WalletPageContext = {
        title: "Wallet - slotm",
        user_balance_coins: String(userBalanceCoins),
        flash_message: finalize.flash || "",
        transactions_rows_html: txRows,
        cards_rows_html: cardRows,
        stripe_configured: this.payment.isConfigured() ? "yes" : "no",
        ...this.userTemplateData(walletUser),
      };
      const html = await renderTemplate(path.join(this.config.templateDir, "wallet.hbs"), ctx);

      res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
    });
  }

  get handleLoginPage(): RequestHandler {
    return this.pageHandler(async (req: Request, res: Response) => {
      if (req.auth?.user) {
        res.redirect("/");
        return;
      }

      const next = this.sanitizeRedirectTarget(this.queryString(req.query, "next"), "/");
      const ctx: AuthPageContext = { title: "Login - slotm", next_path: next };
      const html = await renderTemplate(path.join(this.config.templateDir, "login.hbs"), ctx);

      res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
    });
  }

  get handleRegisterPage(): RequestHandler {
    return this.pageHandler(async (req: Request, res: Response) => {
      if (req.auth?.user) {
        res.redirect("/");
        return;
      }

      const next = this.sanitizeRedirectTarget(this.queryString(req.query, "next"), "/");
      const ctx: AuthPageContext = { title: "Register - slotm", next_path: next };
      const html = await renderTemplate(path.join(this.config.templateDir, "register.hbs"), ctx);

      res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
    });
  }

  get handleProfilePage(): RequestHandler {
    return this.pageHandler(async (req: Request, res: Response) => {
      const auth = this.requireAuthUser(req);
      const freshUser = await this.userRepo.getUserById(auth.user.id);
      const user = freshUser || auth.user;

      const ctx: BaseTemplateContext = {
        title: "Profile - slotm",
        ...this.userTemplateData(user),
      };
      const html = await renderTemplate(path.join(this.config.templateDir, "profile.hbs"), ctx);

      res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
    });
  }
}
