import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

import compression from "compression";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import multer from "multer";
import rateLimit from "express-rate-limit";

import { AppConfig } from "./config/AppConfig.js";
import { AuthController } from "./controllers/AuthController.js";
import { GameController } from "./controllers/GameController.js";
import { PageController } from "./controllers/PageController.js";
import { ProfileController } from "./controllers/ProfileController.js";
import { WalletController } from "./controllers/WalletController.js";
import { GameEngineRegistry } from "./game/engines/GameEngineRegistry.js";
import { LegacyMiniGameEngine } from "./game/engines/LegacyMiniGameEngine.js";
import { SlotSpinEngine } from "./game/engines/SlotSpinEngine.js";
import { TicketMiniGameEngine } from "./game/engines/TicketMiniGameEngine.js";
import { loadAppEnv } from "./lib/env.js";
import { StripeClient } from "./lib/stripe.js";
import { createJwtAuthMiddlewares } from "./middlewares/auth.middleware.js";
import { createSessionCsrfMiddlewares } from "./middlewares/csrf-session.middleware.js";
import { attachRequestContext } from "./middlewares/request-context.middleware.js";
import { connectPrisma, disconnectPrisma, getPrisma } from "./repositories/PrismaConnection.js";
import { GameRepository } from "./repositories/GameRepository.js";
import { TransactionRepository } from "./repositories/TransactionRepository.js";
import { UserRepository } from "./repositories/UserRepository.js";
import { registerRoutes } from "./routes/index.js";
import { AuthService } from "./services/AuthService.js";
import { GameService } from "./services/GameService.js";
import { ProfileService } from "./services/ProfileService.js";
import { WalletService } from "./services/WalletService.js";

async function start(): Promise<void> {
  const env = loadAppEnv();
  const distDir = AppConfig.resolveDistDir(import.meta.url);
  const config = new AppConfig(env, distDir);

  await fs.mkdir(config.uploadsDir, { recursive: true });
  await connectPrisma();
  console.log("[slotm] Prisma connected to PostgreSQL");

  const prisma = getPrisma();
  const userRepo = new UserRepository(prisma);
  const txRepo = new TransactionRepository(prisma);
  const gameRepo = new GameRepository(prisma);
  const stripe = new StripeClient(config.stripeSecret);

  const registry = new GameEngineRegistry();
  const slotSpinEngine = new SlotSpinEngine(txRepo, gameRepo);
  const legacyMiniGameEngine = new LegacyMiniGameEngine(txRepo, gameRepo);
  const ticketMiniGameEngine = new TicketMiniGameEngine(txRepo, gameRepo);
  registry.register("slot_spin", slotSpinEngine);
  registry.registerMiniGameResolver((payload) => {
    if (Object.prototype.hasOwnProperty.call(payload, "tickets")) {
      return ticketMiniGameEngine;
    }
    return legacyMiniGameEngine;
  });

  const authService = new AuthService(userRepo, config);
  const walletService = new WalletService(userRepo, txRepo, stripe, config);
  const gameService = new GameService(txRepo, gameRepo, registry);
  const profileService = new ProfileService(userRepo);

  const {
    optionalJwt,
    requireJwt,
    setJwtCookie,
    clearJwtCookie,
  } = createJwtAuthMiddlewares({
    store: userRepo,
    jwtSecret: config.jwtSecret,
    jwtIssuer: config.jwtIssuer,
    jwtAudience: config.jwtAudience,
    jwtCookie: config.jwtCookie,
    jwtCookieMaxAgeSeconds: config.jwtCookieMaxAgeSeconds,
    defaultJwtTtlSeconds: config.defaultJwtTtlSeconds,
    nodeEnv: config.nodeEnv,
  });

  const {
    ensureSession,
    requireCsrf,
    clearSessionCookies,
  } = createSessionCsrfMiddlewares({
    nodeEnv: config.nodeEnv,
    sessionCookieName: config.sessionCookie,
    csrfCookieName: config.csrfCookie,
    sessionTtlSeconds: config.sessionTtlSeconds,
  });

  const authController = new AuthController(authService, setJwtCookie, clearJwtCookie, clearSessionCookies);
  const pageController = new PageController(walletService, userRepo, stripe, config);
  const gameController = new GameController(gameService, gameRepo, config);
  const walletController = new WalletController(walletService, config);
  const profileController = new ProfileController(profileService);

  const uploadStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, config.uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      cb(null, `profile-${unique}${ext}`);
    },
  });
  const upload = multer({
    storage: uploadStorage,
    limits: { fileSize: config.maxUploadSize },
    fileFilter: (_req, file, cb) => {
      cb(null, config.allowedMimeTypes.has(file.mimetype));
    },
  });

  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(attachRequestContext);
  app.use(ensureSession);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: false }));
  app.use(compression());

  const apiCorsMiddleware = cors({
    origin: (origin, callback) => {
      if (!origin) { callback(null, true); return; }
      const normalized = config.normalizeOrigin(origin);
      if (config.corsAllowedOrigins.has(normalized)) { callback(null, true); return; }
      callback(new Error(`CORS origin not allowed: ${normalized}`));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Requested-With"],
    exposedHeaders: ["X-Request-Id"],
    optionsSuccessStatus: 204,
  });

  morgan.token("rid", (req) => (req as Request).requestId || "-");
  morgan.token("uid", (req) => {
    const request = req as Request;
    return request.auth?.user ? String(request.auth.user.id) : "-";
  });
  app.use(morgan(":date[iso] rid=:rid uid=:uid :method :url :status :response-time ms :res[content-length]"));

  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });

  app.use("/assets/images", express.static(config.clientImagesDir, { index: false, fallthrough: false }));
  app.use("/assets/js", express.static(config.clientDir, { index: false, fallthrough: false }));
  app.use("/assets/css", express.static(config.clientStylesDir, { index: false, fallthrough: false }));
  app.use("/assets/uploads", express.static(config.uploadsDir, { index: false, fallthrough: false }));

  app.post("/api/wallet/stripe/webhook", express.raw({ type: "application/json", limit: "5mb" }), walletController.handleStripeWebhook);

  app.use("/api", apiCorsMiddleware);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  app.use("/api", apiLimiter);

  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    const originHeader = req.headers.origin;
    const rawOrigin = Array.isArray(originHeader) ? String(originHeader[0] || "") : String(originHeader || "");
    const forwardedProto = req.headers["x-forwarded-proto"];
    const proto = Array.isArray(forwardedProto) ? String(forwardedProto[0] || "") : String(forwardedProto || req.protocol || "http");
    const normalizedProto = proto.split(",")[0]?.trim() || "http";
    const requestOrigin = config.normalizeOrigin(`${normalizedProto}://${req.get("host") || `localhost:${config.port}`}`);
    const resolvedOrigin = config.normalizeOrigin(rawOrigin) || requestOrigin;
    if (!config.corsAllowedOrigins.has(resolvedOrigin)) {
      res.status(403).json({ success: false, message: `Origin is not allowed: ${resolvedOrigin}` });
      return;
    }
    next();
  });
  app.use("/api", requireCsrf);

  registerRoutes(app, {
    optionalJwt,
    requireJwt,
    authLimiter,
    upload,
    authController,
    pageController,
    gameController,
    walletController,
    profileController,
  });

  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!(error instanceof Error) || !error.message.startsWith("CORS")) { next(error); return; }
    if (req.path.startsWith("/api/")) { res.status(403).json({ success: false, message: error.message }); return; }
    res.status(403).type("text/plain").send(error.message);
  });

  app.use((req: Request, res: Response) => {
    if (req.path.startsWith("/api/")) { res.status(404).json({ success: false, message: "Not found" }); return; }
    res.status(404).type("text/plain").send("Not found");
  });

  const server = createServer(app);
  server.listen(config.port, config.host, () => {
    console.log(`[slotm] Express server running at http://${config.host}:${config.port}`);
  });

  const shutdown = async () => {
    console.log("[slotm] Shutting down...");
    server.close();
    await disconnectPrisma();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch(async (error) => {
  console.error("Failed to start slotm:", error);
  await disconnectPrisma();
  process.exitCode = 1;
});
