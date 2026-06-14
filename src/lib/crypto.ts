import "server-only";
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";

// Symmetric encryption for secrets we must store and later reuse verbatim
// (e.g. Google OAuth access/refresh tokens). We can't hash these — they need to
// be recoverable — so we encrypt at rest with AES-256-GCM. The key is derived
// from AUTH_SECRET (already required for sessions), so no new env var or DB
// migration is needed: the columns stay plain `String`.
//
// Ciphertext format: "enc:v1:" + base64(iv | authTag | ciphertext). Values
// without the prefix are treated as legacy plaintext on read, so existing
// connections keep working until they're next written (then they're encrypted).

const PREFIX = "enc:v1:";
const IV_LEN = 12; // 96-bit nonce, recommended for GCM
const TAG_LEN = 16; // 128-bit auth tag

function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set; cannot encrypt/decrypt secrets.");
  }
  // SHA-256 the secret to get a fixed 32-byte AES-256 key regardless of length.
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(value: string): string {
  // Legacy plaintext (written before encryption was added) — return as-is.
  if (!value.startsWith(PREFIX)) return value;
  const raw = Buffer.from(value.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
