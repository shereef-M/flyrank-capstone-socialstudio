import crypto from "node:crypto";

/**
 * Verifies an HMAC-SHA256 signature against the exact raw bytes it was
 * computed over. Used by the webhook receiver to reject forged delivery
 * confirmations.
 */
export function isValidSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader) return false;

  const secret = process.env.WEBHOOK_SECRET || "dev-secret-change-me";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedBuf = Buffer.from(expected);
  const givenBuf = Buffer.from(signatureHeader);
  // timingSafeEqual throws on mismatched lengths, so guard first.
  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}
