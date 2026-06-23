import express from "express";
import type { RequestHandler } from "express";

interface PageRouteDeps {
  optionalJwt: RequestHandler;
  requireJwt: RequestHandler;
  handleRootPage: RequestHandler;
  handleGamesPage: RequestHandler;
  handleLoginPage: RequestHandler;
  handleRegisterPage: RequestHandler;
  handleLogoutPage: RequestHandler;
  handleGamePage: RequestHandler;
  handleWalletPage: RequestHandler;
  handleProfilePage: RequestHandler;
  handleCompliancePage: RequestHandler;
  handleGuidelinesPage: RequestHandler;
  handleComplianceHistoryPage: RequestHandler;
  handleRulesPage: RequestHandler;
}

export function buildPageRoutes({
  optionalJwt,
  requireJwt,
  handleRootPage,
  handleGamesPage,
  handleLoginPage,
  handleRegisterPage,
  handleLogoutPage,
  handleGamePage,
  handleWalletPage,
  handleProfilePage,
  handleCompliancePage,
  handleGuidelinesPage,
  handleComplianceHistoryPage,
  handleRulesPage,
}: PageRouteDeps): express.Router {
  const router = express.Router();

  router.get("/", requireJwt, handleRootPage);
  router.get("/games", requireJwt, handleGamesPage);
  router.get("/games/slot-machine", requireJwt, handleGamePage);
  router.get("/slot-machine", requireJwt, (_req, res) => {
    res.redirect("/games/slot-machine");
  });

  router.get("/login", optionalJwt, handleLoginPage);
  router.get("/register", optionalJwt, handleRegisterPage);
  router.get("/logout", handleLogoutPage);

  router.get("/wallet", requireJwt, handleWalletPage);
  router.get("/profile", requireJwt, handleProfilePage);
  router.get("/compliance", requireJwt, handleCompliancePage);
  router.get("/compliance/history", requireJwt, handleComplianceHistoryPage);
  router.get("/guidelines", requireJwt, handleGuidelinesPage);
  router.get("/rules", requireJwt, handleRulesPage);

  return router;
}
