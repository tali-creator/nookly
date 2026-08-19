import crypto from "crypto";
import { env } from "../config/env";

// AES-256-GCM encryption for the NIN at rest. The raw NIN is stored in the
// DB as ciphertext only; nothing ever reads it back through the API (responses
// use the precomputed ninMasked value). decrypt() exists for a future
// legitimate internal need (e.g. a regulated admin workflow) and is unused
// today — keeping it here documents HOW decryption works if it ever becomes
// necessary.
//
// Format of the stored value (base64, dot-separated): iv.tag.ciphertext
// Each value gets a fresh random 96-bit IV, so identical NINs produce
// different ciphertexts (no equality leak).

const KEY = Buffer.from(env.kycEncryptionKey, "base64"); // 32 bytes = AES-256
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    ct.toString("base64"),
  ].join(".");
}

// Currently unused (nothing reads the NIN back). Documented for the future
// internal workflow that genuinely needs the plaintext.
export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, ctB64] = stored.split(".");
  const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}