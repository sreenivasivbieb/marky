/**
 * FRACTIONAL POSITIONS (D54): blocks ka order sortable strings se.
 *
 *   'a0' (Goals) , 'a1' (Non-goals)  →  beech me daalo  →  keyBetween('a0', 'a1') = 'a0V'
 * Sirf naya block likha jaata hai; baaki blocks ki position kabhi nahi badalti.
 *
 * Library: `fractional-indexing` (rocicorp), Figma ke algorithm par based. Keys byte order me sort hoti hain,
 * isliye DB column `COLLATE "C"` hai (ADR 0022). JS ka `<` bhi ASCII strings ko byte order me hi compare karta hai.
 */
import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

/**
 * `before` aur `after` ke beech ki ek key. `null` = shuruaat / end.
 * Shart: before < after (byte order). Ulta ho to library error deti hai.
 */
export function keyBetween(before: string | null, after: string | null): string {
  return generateKeyBetween(before, after);
}

/** `before` aur `after` ke beech `count` keys, badhte order me (jaise naya document banate waqt saare blocks ke liye). */
export function keysBetween(before: string | null, after: string | null, count: number): string[] {
  return generateNKeysBetween(before, after, count);
}

/** Byte-order compare (DB ke `COLLATE "C"` jaisa). Sort ke liye: `keys.sort(comparePositions)`. */
export function comparePositions(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
