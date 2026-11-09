/**
 * SECRET BOX (ADR 0025): chhote secrets (team ki AI API key) ko AES-256-GCM se encrypt / decrypt karna.
 *
 * AES-256-GCM = "authenticated encryption":
 *   - ciphertext se plaintext kisi ko nahi dikhta (confidentiality),
 *   - ciphertext / IV / tag me ek bit bhi badla to decrypt FAIL hota hai, galat data nahi lautata (integrity),
 *   - "associated data" (AAD) bhi check hota hai, par encrypt nahi hota. Hum AAD = product_id rakhte hain, isliye ek
 *     product ka ciphertext doosre product ki row me copy karke decrypt nahi ho sakta.
 * IV (nonce) har encryption me naya random hota hai. GCM me same key + same IV dobara use karna security tod deta hai.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
/** AES-256 = 32-byte key. */
export const SECRET_BOX_KEY_BYTES = 32;
/** GCM ka standard nonce size (96 bits). */
const IV_BYTES = 12;
/** GCM auth tag (128 bits, sabse strong). */
const AUTH_TAG_BYTES = 16;

export interface SealedSecret {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/**
 * Decrypt fail hone par ye error aata hai. Message jaan-boojh kar generic hai: "kyun fail hua" (galat key / tampered
 * data / galat AAD) batana attacker ki madad karta hai, aur secret ka koi hissa kabhi message me nahi aata.
 */
export class SecretBoxError extends Error {
  constructor(message = "secret could not be decrypted") {
    super(message);
    this.name = "SecretBoxError";
  }
}

function assertKey(key: Buffer): void {
  if (key.length !== SECRET_BOX_KEY_BYTES) {
    throw new SecretBoxError(`master key must be exactly ${SECRET_BOX_KEY_BYTES} bytes`);
  }
}

/** base64 master key (env se) → 32-byte Buffer. Galat length = error (fail fast). */
export function parseMasterKey(base64: string): Buffer {
  const key = Buffer.from(base64, "base64");
  assertKey(key);
  return key;
}

export function sealSecret(plaintext: string, key: Buffer, associatedData: string): SealedSecret {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function openSecret(sealed: SealedSecret, key: Buffer, associatedData: string): string {
  assertKey(key);
  if (sealed.iv.length !== IV_BYTES || sealed.authTag.length !== AUTH_TAG_BYTES) throw new SecretBoxError();
  try {
    const decipher = createDecipheriv(ALGORITHM, key, sealed.iv, { authTagLength: AUTH_TAG_BYTES });
    decipher.setAAD(Buffer.from(associatedData, "utf8"));
    decipher.setAuthTag(sealed.authTag);
    return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new SecretBoxError(); // asli error (jo kabhi-kabhi internal detail deta hai) chhupa do
  }
}
