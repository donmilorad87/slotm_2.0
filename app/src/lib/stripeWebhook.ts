import crypto from "node:crypto";

interface StripeSignatureHeader {
  timestamp: number;
  v1: string[];
}

function parseSignatureHeader(
  signatureHeader: string | undefined | null,
): StripeSignatureHeader | null {
  if (!signatureHeader || typeof signatureHeader !== "string") {
    return null;
  }

  const parts = signatureHeader.split(",");
  let timestamp = null;
  const v1 = [];

  for (const partRaw of parts) {
    const part = partRaw.trim();
    if (!part) {
      continue;
    }
    const idx = part.indexOf("=");
    if (idx < 0) {
      continue;
    }
    const key = part.slice(0, idx);
    const value = part.slice(idx + 1);
    if (key === "t") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        timestamp = parsed;
      }
    } else if (key === "v1" && value) {
      v1.push(value);
    }
  }

  if (!timestamp || v1.length === 0) {
    return null;
  }

  return { timestamp, v1 };
}

function timingSafeHexEqual(aHex: string, bHex: string): boolean {
  if (!aHex || !bHex || aHex.length !== bHex.length) {
    return false;
  }

  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length !== b.length || a.length === 0) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  } catch (_: unknown) {
    return false;
  }
}

export function verifyStripeWebhookSignature({
  payloadBuffer,
  signatureHeader,
  webhookSecret,
  toleranceSeconds = 300,
  nowUnixSeconds = Math.floor(Date.now() / 1000),
}: {
  payloadBuffer: Buffer;
  signatureHeader?: string;
  webhookSecret: string;
  toleranceSeconds?: number;
  nowUnixSeconds?: number;
}): boolean {
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed || !webhookSecret) {
    return false;
  }

  if (Math.abs(nowUnixSeconds - parsed.timestamp) > toleranceSeconds) {
    return false;
  }

  const signedPayload = `${parsed.timestamp}.${payloadBuffer.toString("utf8")}`;
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(signedPayload, "utf8")
    .digest("hex");

  for (const signature of parsed.v1) {
    if (timingSafeHexEqual(expected, signature)) {
      return true;
    }
  }

  return false;
}
