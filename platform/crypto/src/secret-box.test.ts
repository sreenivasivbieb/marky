import { randomBytes } from "node:crypto";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { openSecret, parseMasterKey, sealSecret, SECRET_BOX_KEY_BYTES, SecretBoxError } from "./secret-box.ts";

const key = randomBytes(SECRET_BOX_KEY_BYTES);
const AAD = "product-a";

describe("secret box (AES-256-GCM)", () => {
  it("property: seal → open = original (koi bhi unicode text)", () => {
    fc.assert(fc.property(fc.string({ unit: "grapheme", maxLength: 200 }), (secret) => {
      expect(openSecret(sealSecret(secret, key, AAD), key, AAD)).toBe(secret);
    }));
  });

  it("ciphertext me plaintext nahi dikhta, aur har seal ka IV alag hai", () => {
    const secret = "sk-ant-api03-SUPER-SECRET-VALUE";
    const a = sealSecret(secret, key, AAD);
    const b = sealSecret(secret, key, AAD);
    expect(a.ciphertext.toString("utf8")).not.toContain("SUPER-SECRET");
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it("tampering (ciphertext / tag / iv ka ek bit) pakdi jaati hai", () => {
    const sealed = sealSecret("secret", key, AAD);
    const flip = (buf: Buffer) => { const copy = Buffer.from(buf); copy[0] = (copy[0] ?? 0) ^ 1; return copy; };
    expect(() => openSecret({ ...sealed, ciphertext: flip(sealed.ciphertext) }, key, AAD)).toThrow(SecretBoxError);
    expect(() => openSecret({ ...sealed, authTag: flip(sealed.authTag) }, key, AAD)).toThrow(SecretBoxError);
    expect(() => openSecret({ ...sealed, iv: flip(sealed.iv) }, key, AAD)).toThrow(SecretBoxError);
  });

  it("galat AAD (doosre product me copy) par decrypt fail", () => {
    const sealed = sealSecret("secret", key, "product-a");
    expect(() => openSecret(sealed, key, "product-b")).toThrow(SecretBoxError);
  });

  it("galat master key par fail, aur error me secret nahi", () => {
    const sealed = sealSecret("sk-the-secret", key, AAD);
    try {
      openSecret(sealed, randomBytes(SECRET_BOX_KEY_BYTES), AAD);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SecretBoxError);
      expect(String((error as Error).message)).not.toContain("sk-the-secret");
    }
  });

  it("parseMasterKey sirf 32-byte key accept karta hai", () => {
    expect(parseMasterKey(key.toString("base64")).equals(key)).toBe(true);
    expect(() => parseMasterKey(randomBytes(16).toString("base64"))).toThrow(SecretBoxError);
  });
});
