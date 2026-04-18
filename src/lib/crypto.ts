// Copyright (c) 2026 Mohammed Aladwani
// Licensed under the MIT License

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

const DEV_FALLBACK_KEY = "dev-encryption-key-change-in-prod-32ch";
const SCRYPT_SALT = "salt";

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[SECURITY] ENCRYPTION_KEY environment variable must be set in production. " +
          "Generate one with: openssl rand -hex 32"
      );
    }
    console.warn(
      "[SECURITY WARNING] ENCRYPTION_KEY is not set. " +
        "Using insecure dev key - never use this in production."
    );
    return crypto.scryptSync(DEV_FALLBACK_KEY, SCRYPT_SALT, 32);
  }

  return crypto.scryptSync(key, SCRYPT_SALT, 32);
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";
  const parts = encryptedText.split(":");
  if (parts.length !== 3) return "";
  const [ivHex, tagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
