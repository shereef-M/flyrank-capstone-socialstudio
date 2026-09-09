import { describe, it, expect, beforeAll } from "vitest";
import crypto from "node:crypto";
import { isValidSignature } from "../src/lib/webhook-signature";

const SECRET = "test-secret-for-this-suite";

beforeAll(() => {
  process.env.WEBHOOK_SECRET = SECRET;
});

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

describe("isValidSignature", () => {
  it("accepts a correctly signed payload", () => {
    const payload = JSON.stringify({
      socialPostEntryId: "abc",
      status: "published",
    });
    const signature = sign(payload);
    expect(isValidSignature(Buffer.from(payload), signature)).toBe(true);
  });

  it("rejects a forged signature", () => {
    const payload = JSON.stringify({
      socialPostEntryId: "abc",
      status: "published",
    });
    const forged = "0".repeat(64);
    expect(isValidSignature(Buffer.from(payload), forged)).toBe(false);
  });

  it("rejects when the payload was tampered with after signing", () => {
    const original = JSON.stringify({
      socialPostEntryId: "abc",
      externalPostId: "real-post",
    });
    const signature = sign(original);
    const tampered = JSON.stringify({
      socialPostEntryId: "abc",
      externalPostId: "forged-post",
    });
    expect(isValidSignature(Buffer.from(tampered), signature)).toBe(false);
  });

  it("rejects when no signature header is present", () => {
    const payload = JSON.stringify({ socialPostEntryId: "abc" });
    expect(isValidSignature(Buffer.from(payload), undefined)).toBe(false);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const payload = JSON.stringify({ socialPostEntryId: "abc" });
    const wrongSecretSignature = crypto
      .createHmac("sha256", "some-other-secret")
      .update(payload)
      .digest("hex");
    expect(isValidSignature(Buffer.from(payload), wrongSecretSignature)).toBe(
      false,
    );
  });
});
