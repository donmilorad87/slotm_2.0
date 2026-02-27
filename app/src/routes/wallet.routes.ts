import express from "express";
import type { RequestHandler } from "express";

import {
  createCheckoutSessionValidator,
  createSetupSessionValidator,
  removeCardValidator,
  walletTransactionsQueryValidator,
} from "../validators/wallet.validators.js";

interface WalletRouteDeps {
  requireJwt: RequestHandler;
  handleWalletCreateTopup: RequestHandler;
  handleWalletCreateSetup: RequestHandler;
  handleWalletRemoveCard: RequestHandler;
  handleWalletBalance: RequestHandler;
  handleWalletTransactions: RequestHandler;
}

export function buildWalletRoutes({
  requireJwt,
  handleWalletCreateTopup,
  handleWalletCreateSetup,
  handleWalletRemoveCard,
  handleWalletBalance,
  handleWalletTransactions,
}: WalletRouteDeps): express.Router {
  const router = express.Router();

  router.post(
    "/create-checkout-session",
    requireJwt,
    ...createCheckoutSessionValidator,
    handleWalletCreateTopup,
  );

  router.post(
    "/create-setup-session",
    requireJwt,
    ...createSetupSessionValidator,
    handleWalletCreateSetup,
  );

  router.post(
    "/remove-card",
    requireJwt,
    ...removeCardValidator,
    handleWalletRemoveCard,
  );

  router.get("/balance", requireJwt, handleWalletBalance);

  router.get(
    "/transactions",
    requireJwt,
    ...walletTransactionsQueryValidator,
    handleWalletTransactions,
  );

  return router;
}
