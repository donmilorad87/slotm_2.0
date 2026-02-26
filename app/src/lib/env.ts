export function loadAppEnv() {
  return {
    STRIPE_KEY: process.env.STRIPE_KEY || "",
    STRIPE_SECRET: process.env.STRIPE_SECRET || "",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  };
}
