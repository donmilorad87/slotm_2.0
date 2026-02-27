import type { Application, RequestHandler } from "express";

import { buildAuthRoutes } from "./auth.routes.js";
import { buildGameRoutes } from "./game.routes.js";
import { buildPageRoutes } from "./page.routes.js";
import { buildWalletRoutes } from "./wallet.routes.js";

interface RegisterRoutesDeps {
  optionalJwt: RequestHandler;
  requireJwt: RequestHandler;
  authLimiter: RequestHandler;
  handleRootPage: RequestHandler;
  handleGamesPage: RequestHandler;
  handleLoginPage: RequestHandler;
  handleRegisterPage: RequestHandler;
  handleLogoutPage: RequestHandler;
  handleAuthRegister: RequestHandler;
  handleAuthLogin: RequestHandler;
  handleAuthLogout: RequestHandler;
  handleGamePage: RequestHandler;
  handleWalletPage: RequestHandler;
  handleApiGames: RequestHandler;
  handleHistoryApi: RequestHandler;
  handleWalletCreateTopup: RequestHandler;
  handleWalletCreateSetup: RequestHandler;
  handleWalletRemoveCard: RequestHandler;
  handleWalletBalance: RequestHandler;
  handleWalletTransactions: RequestHandler;
}

export function registerRoutes(app: Application, deps: RegisterRoutesDeps): void {
  app.use(
    buildPageRoutes({
      optionalJwt: deps.optionalJwt,
      requireJwt: deps.requireJwt,
      handleRootPage: deps.handleRootPage,
      handleGamesPage: deps.handleGamesPage,
      handleLoginPage: deps.handleLoginPage,
      handleRegisterPage: deps.handleRegisterPage,
      handleLogoutPage: deps.handleLogoutPage,
      handleGamePage: deps.handleGamePage,
      handleWalletPage: deps.handleWalletPage,
    }),
  );

  app.use(
    "/api/auth",
    buildAuthRoutes({
      authLimiter: deps.authLimiter,
      handleAuthRegister: deps.handleAuthRegister,
      handleAuthLogin: deps.handleAuthLogin,
      handleAuthLogout: deps.handleAuthLogout,
    }),
  );

  app.use(
    "/api/games",
    buildGameRoutes({
      requireJwt: deps.requireJwt,
      handleApiGames: deps.handleApiGames,
      handleHistoryApi: deps.handleHistoryApi,
    }),
  );

  app.use(
    "/api/wallet",
    buildWalletRoutes({
      requireJwt: deps.requireJwt,
      handleWalletCreateTopup: deps.handleWalletCreateTopup,
      handleWalletCreateSetup: deps.handleWalletCreateSetup,
      handleWalletRemoveCard: deps.handleWalletRemoveCard,
      handleWalletBalance: deps.handleWalletBalance,
      handleWalletTransactions: deps.handleWalletTransactions,
    }),
  );
}
