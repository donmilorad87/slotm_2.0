export interface AppEnv {
  STRIPE_KEY: string;
  STRIPE_SECRET: string;
  STRIPE_WEBHOOK_SECRET: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_COOKIE_MAX_AGE_SECONDS: string;
  CORS_ALLOWED_ORIGINS: string;
  SESSION_TTL_SECONDS: string;
  NODE_ENV: string;
}

export function loadAppEnv(): AppEnv {
  return {
    STRIPE_KEY: process.env.STRIPE_KEY || "",
    STRIPE_SECRET: process.env.STRIPE_SECRET || "",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
    JWT_SECRET: process.env.JWT_SECRET || "",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "14d",
    JWT_COOKIE_MAX_AGE_SECONDS: process.env.JWT_COOKIE_MAX_AGE_SECONDS || "",
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS || "",
    SESSION_TTL_SECONDS: process.env.SESSION_TTL_SECONDS || "",
    NODE_ENV: process.env.NODE_ENV || "development",
  };
}
