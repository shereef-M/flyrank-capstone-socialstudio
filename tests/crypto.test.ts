import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "../src/lib/crypto";

beforeAll(() => {
  // A fixed test key so this test doesn't depend on the real .env value.
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("token encryption", () => {
  it("round-trips a token exactly", () => {
    const original = "fake-token-abc123-super-secret";
    const { ciphertext, iv } = encrypt(original);
    const decrypted = decrypt(ciphertext, iv);
    expect(decrypted).toBe(original);
  });

  it("never stores the plaintext token inside the ciphertext", () => {
    const original = "fake-token-abc123-super-secret";
    const { ciphertext } = encrypt(original);
    expect(ciphertext).not.toContain(original);
    expect(ciphertext.toLowerCase()).not.toContain(
      Buffer.from(original).toString("hex"),
    );
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const original = "fake-token-abc123-super-secret";
    const first = encrypt(original);
    const second = encrypt(original);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.iv).not.toBe(second.iv);
  });

  it("fails to decrypt with a tampered ciphertext", () => {
    const { ciphertext, iv } = encrypt("fake-token-abc123");
    const tampered = ciphertext.slice(0, -2) + "00";
    expect(() => decrypt(tampered, iv)).toThrow();
  });
});
