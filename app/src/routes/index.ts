import type { Application, RequestHandler } from "express";
import type multer from "multer";

import type { AuthController } from "../controllers/AuthController.js";
import type { GameController } from "../controllers/GameController.js";
import type { PageController } from "../controllers/PageController.js";
import type { ProfileController } from "../controllers/ProfileController.js";
import type { WalletController } from "../controllers/WalletController.js";

import { buildAuthRoutes } from "./auth.routes.js";
import { buildGameRoutes } from "./game.routes.js";
import { buildPageRoutes } from "./page.routes.js";
import { buildProfileRoutes } from "./profile.routes.js";
import { buildWalletRoutes } from "./wallet.routes.js";

/** Middleware deps shared across route groups. */
interface RoutesMiddleware {
  optionalJwt: RequestHandler;
  requireJwt: RequestHandler;
  authLimiter: RequestHandler;
  upload: multer.Multer;
}

/** Controller deps grouped by domain. */
interface RoutesControllers {
  authController: AuthController;
  pageController: PageController;
  gameController: GameController;
  walletController: WalletController;
  profileController: ProfileController;
}

/** Composed from middleware + controllers using intersection. */
export type RegisterRoutesDeps = RoutesMiddleware & RoutesControllers;

export function registerRoutes(app: Application, deps: RegisterRoutesDeps): void {
  app.use(
    buildPageRoutes({
      optionalJwt: deps.optionalJwt,
      requireJwt: deps.requireJwt,
      handleRootPage: deps.pageController.handleRootPage,
      handleGamesPage: deps.pageController.handleGamesPage,
      handleLoginPage: deps.pageController.handleLoginPage,
      handleRegisterPage: deps.pageController.handleRegisterPage,
      handleLogoutPage: deps.authController.handleLogoutPage,
      handleGamePage: deps.pageController.handleGamePage,
      handleWalletPage: deps.pageController.handleWalletPage,
      handleProfilePage: deps.pageController.handleProfilePage,
    }),
  );

  app.use(
    "/api/auth",
    buildAuthRoutes({
      authLimiter: deps.authLimiter,
      handleAuthRegister: deps.authController.handleRegister,
      handleAuthLogin: deps.authController.handleLogin,
      handleAuthLogout: deps.authController.handleLogout,
    }),
  );

  app.use(
    "/api/games",
    buildGameRoutes({
      requireJwt: deps.requireJwt,
      handleApiGames: deps.gameController.handleApiGames,
      handleHistoryApi: deps.gameController.handleHistoryApi,
    }),
  );

  app.use(
    "/api/profile",
    buildProfileRoutes({
      requireJwt: deps.requireJwt,
      upload: deps.upload,
      handleUpdateProfile: deps.profileController.handleUpdateProfile,
      handleChangePassword: deps.profileController.handleChangePassword,
      handleUploadProfilePicture: deps.profileController.handleUploadProfilePicture,
    }),
  );

  app.use(
    "/api/wallet",
    buildWalletRoutes({
      requireJwt: deps.requireJwt,
      handleWalletCreateTopup: deps.walletController.handleCreateTopup,
      handleWalletCreateSetup: deps.walletController.handleCreateSetup,
      handleWalletRemoveCard: deps.walletController.handleRemoveCard,
      handleWalletBalance: deps.walletController.handleBalance,
      handleWalletTransactions: deps.walletController.handleTransactions,
    }),
  );
}
