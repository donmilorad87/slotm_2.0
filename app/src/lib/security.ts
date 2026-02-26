import crypto from "node:crypto";

const HASH_ITERATIONS = 210_000;
const HASH_KEY_LENGTH = 32;
const HASH_DIGEST = "sha256";

export function randomId(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const key = crypto
    .pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST)
    .toString("hex");
  return {
    salt,
    hash: key,
  };
}

export function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}
