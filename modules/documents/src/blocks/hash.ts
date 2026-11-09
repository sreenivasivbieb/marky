/**
 * CANONICAL HASH (design doc section 7: "each block has … a content hash").
 *
 * Hash ka kaam: "kya block proposal ke baad badla?" Accept ke waqt engine current hash ko Change ke `before_hash` se
 * milata hai; alag ho to Change stale (D58).
 *
 * Do content jo *matlab* me same hain, unka hash bhi same hona chahiye. Isliye:
 *   1. pehle normalise (runs jodna waghera, normalize.ts),
 *   2. phir canonical JSON: object keys hamesha sorted, koi extra space nahi.
 *      ({a:1,b:2} aur {b:2,a:1} same JSON string dete hain),
 *   3. phir SHA-256 (hex, 64 characters; DB CHECK isi format ko maangta hai).
 */
import { createHash } from "node:crypto";
import { normalizeBlock } from "./normalize.ts";
import { blockContentSchema, type BlockContent } from "./schema.ts";

/** Kisi bhi JSON value ka stable string roop: object keys sorted, arrays ka order same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined) // JSON.stringify bhi undefined fields chhod deta hai
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function hashBlockContent(content: BlockContent): string {
  return createHash("sha256").update(canonicalJson(normalizeBlock(content))).digest("hex");
}

/**
 * DB me likhne se pehle ka ek hi darwaza: anjaan input (AI, editor) → validate → normalise → hash.
 * Galat shape par Zod error throw hota hai.
 */
export function prepareBlock(input: unknown): { content: BlockContent; hash: string } {
  const content = normalizeBlock(blockContentSchema.parse(input));
  return { content, hash: hashBlockContent(content) };
}
