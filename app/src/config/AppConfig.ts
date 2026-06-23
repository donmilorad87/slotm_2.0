import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AppEnv } from "../lib/env.js";

const DEFAULT_JWT_TTL_SECONDS = 60 * 60 * 24 * 14;
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 12;
const DEFAULT_ALLOWED_CORS_ORIGINS = [
  "https://blazingsun.local",
  "http://blazingsun.local",
  "https://blazingsun.local:443",
  "http://blazingsun.local:80",
];

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

function parseAllowedOrigins(raw: string): Set<string> {
  const defaults = DEFAULT_ALLOWED_CORS_ORIGINS.map(normalizeOrigin);

  if (!raw.trim()) {
    return new Set(defaults);
  }

  const values = raw
    .split(",")
    .map(normalizeOrigin)
    .filter((part) => part.length > 0);

  if (!values.length) {
    return new Set(defaults);
  }

  return new Set([...defaults, ...values]);
}

export class AppConfig {
  readonly port: number;
  readonly host: string;
  readonly jwtSecret: string;
  readonly jwtIssuer: string;
  readonly jwtAudience: string;
  readonly jwtCookieMaxAgeSeconds: number;
  readonly defaultJwtTtlSeconds: number;
  readonly sessionTtlSeconds: number;
  readonly nodeEnv: string;
  readonly jwtExpiresIn: string;

  readonly jwtCookie: string;
  readonly sessionCookie: string;
  readonly csrfCookie: string;

  readonly stripePublicKey: string;
  readonly stripeSecret: string;
  readonly stripeWebhookSecret: string;

  readonly corsAllowedOrigins: Set<string>;

  readonly distDir: string;
  readonly templateDir: string;
  readonly clientDir: string;
  readonly clientStylesDir: string;
  readonly clientImagesDir: string;
  readonly uploadsDir: string;
  readonly slotMachineMarkupPath: string;

  readonly historyPageSize: number;
  readonly walletTxPageSize: number;

  readonly maxUploadSize: number;
  readonly allowedMimeTypes: Set<string>;

  readonly complianceUploadsDir: string;
  readonly maxPptxUploadSize: number;
  readonly allowedPptxMimeTypes: Set<string>;
  readonly claudeOAuthToken: string;
  readonly claudeCliTimeoutMs: number;
  readonly claudeModel: string;
  readonly guidelineSeedPath: string;

  constructor(env: AppEnv, distDir: string) {
    this.port = Number(process.env.PORT || 4300);
    this.host = process.env.HOST || "0.0.0.0";

    this.jwtSecret = env.JWT_SECRET || "dev-jwt-secret-change-me";
    this.jwtIssuer = "slotm";
    this.jwtAudience = "slotm-web";
    this.jwtExpiresIn = env.JWT_EXPIRES_IN;
    this.jwtCookieMaxAgeSeconds = Number.parseInt(
      String(env.JWT_COOKIE_MAX_AGE_SECONDS || DEFAULT_JWT_TTL_SECONDS),
      10,
    );
    this.defaultJwtTtlSeconds = DEFAULT_JWT_TTL_SECONDS;
    this.sessionTtlSeconds = Number.parseInt(
      String(env.SESSION_TTL_SECONDS || DEFAULT_SESSION_TTL_SECONDS),
      10,
    );
    this.nodeEnv = env.NODE_ENV;

    this.jwtCookie = "slotm_jwt";
    this.sessionCookie = "slotm_sid";
    this.csrfCookie = "slotm_csrf";

    this.stripePublicKey = env.STRIPE_KEY;
    this.stripeSecret = env.STRIPE_SECRET;
    this.stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET;

    this.corsAllowedOrigins = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS || "");

    this.distDir = distDir;
    this.templateDir = path.join(distDir, "views");
    this.clientDir = path.join(distDir, "client");
    this.clientStylesDir = path.join(this.clientDir, "styles");
    this.clientImagesDir = path.join(this.clientDir, "images");
    this.uploadsDir = path.join(distDir, "..", "uploads");
    this.slotMachineMarkupPath = path.join(this.templateDir, "slot-machine-markup.html");

    this.historyPageSize = 20;
    this.walletTxPageSize = 20;

    this.maxUploadSize = 2 * 1024 * 1024;
    this.allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

    this.complianceUploadsDir = path.join(this.uploadsDir, "compliance");
    this.maxPptxUploadSize = 30 * 1024 * 1024;
    this.allowedPptxMimeTypes = new Set([
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/octet-stream",
    ]);
    this.claudeOAuthToken = env.CLAUDE_CODE_OAUTH_TOKEN;
    this.claudeCliTimeoutMs = 60000;
    this.claudeModel = env.CLAUDE_MODEL;
    this.guidelineSeedPath = path.join(distDir, "assets", "seed", "acme-brand-guidelines.md");

    if (!env.JWT_SECRET) {
      console.warn("[slotm] JWT_SECRET is not set; using development fallback secret");
    }
  }

  normalizeOrigin(origin: string): string {
    return normalizeOrigin(origin);
  }

  static resolveDistDir(metaUrl: string): string {
    return path.dirname(fileURLToPath(metaUrl));
  }
}
