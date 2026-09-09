import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyBase64 = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

/**
 * Encrypts a plaintext token. Returns the ciphertext (with the GCM auth
 * tag appended) and the IV, both hex-encoded — this is exactly what gets
 * stored in PlatformToken.encryptedAccessToken / .iv. The plaintext token
 * never touches the database.
 */
export function encrypt(plaintext: string): { ciphertext: string; iv: string } {
  const iv = crypto.randomBytes(12); // 12 bytes is the recommended IV length for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([encrypted, authTag]).toString("hex");
  return { ciphertext, iv: iv.toString("hex") };
}

/** Reverses encrypt() — throws if the auth tag doesn't match (tampered or wrong key). */
export function decrypt(ciphertextHex: string, ivHex: string): string {
  const data = Buffer.from(ciphertextHex, "hex");
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
  const encrypted = data.subarray(0, data.length - AUTH_TAG_LENGTH);
  const iv = Buffer.from(ivHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
