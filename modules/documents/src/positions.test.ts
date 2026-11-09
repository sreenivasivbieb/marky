import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { comparePositions, keyBetween, keysBetween } from "./positions.ts";

/** Strictly badhte order me? (har key pichhli se badi, koi duplicate nahi) */
function isStrictlySorted(keys: readonly string[]): boolean {
  return keys.every((key, i) => i === 0 || comparePositions(keys[i - 1] ?? "", key) < 0);
}

describe("fractional positions (property tests)", () => {
  it("random jagah par baar-baar insert karo: order hamesha sorted aur unique", () => {
    // Har step: 0..length ke beech koi index chuno aur wahan naya block daalo (jaise user/AI karte hain).
    fc.assert(
      fc.property(fc.array(fc.nat(), { minLength: 1, maxLength: 200 }), (choices) => {
        const keys: string[] = [];
        for (const choice of choices) {
          const index = choice % (keys.length + 1);
          const key = keyBetween(keys[index - 1] ?? null, keys[index] ?? null);
          keys.splice(index, 0, key);
        }
        expect(isStrictlySorted(keys)).toBe(true);
      }),
    );
  });

  it("keyBetween(a, b) hamesha a aur b ke beech hoti hai", () => {
    fc.assert(
      fc.property(fc.array(fc.nat(), { minLength: 2, maxLength: 30 }), fc.nat(), (choices, pick) => {
        const keys: string[] = [];
        for (const choice of choices) {
          const index = choice % (keys.length + 1);
          keys.splice(index, 0, keyBetween(keys[index - 1] ?? null, keys[index] ?? null));
        }
        const i = pick % (keys.length - 1);
        const [a, b] = [keys[i] ?? "", keys[i + 1] ?? ""];
        const mid = keyBetween(a, b);
        expect(comparePositions(a, mid)).toBe(-1);
        expect(comparePositions(mid, b)).toBe(-1);
      }),
    );
  });

  it("ek hi jagah par 500 baar insert (worst case) bhi sorted rehta hai", () => {
    // Sabse bura case: hamesha pehle block ke theek baad insert. Keys lambi hoti hain, par order nahi tootta.
    const keys = [keyBetween(null, null)];
    for (let i = 0; i < 500; i++) keys.splice(1, 0, keyBetween(keys[0] ?? null, keys[1] ?? null));
    expect(isStrictlySorted(keys)).toBe(true);
  });

  it("keysBetween(n): n keys, sorted, bounds ke andar", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (n) => {
        const lower = keyBetween(null, null);
        const upper = keyBetween(lower, null);
        const keys = keysBetween(lower, upper, n);
        expect(keys).toHaveLength(n);
        expect(isStrictlySorted([lower, ...keys, upper])).toBe(true);
      }),
    );
  });
});
