import { describe, expect, it } from "vitest";
import { deepFreeze, deepMerge } from "./deep-merge.ts";

describe("deepMerge", () => {
  const base = { a: { x: 1, y: 2 }, list: [1, 2, 3], flag: true };

  it("nested objects andar tak merge hote hain", () => {
    expect(deepMerge(base, { a: { y: 20 } })).toEqual({ a: { x: 1, y: 20 }, list: [1, 2, 3], flag: true });
  });

  it("arrays merge nahi, poore replace hote hain", () => {
    expect(deepMerge(base, { list: [9] }).list).toEqual([9]);
  });

  it("base object kabhi nahi badalta", () => {
    deepMerge(base, { a: { x: 100 } });
    expect(base.a.x).toBe(1);
  });

  it("__proto__ key se prototype pollution nahi hota", () => {
    const malicious = JSON.parse('{"__proto__": {"polluted": true}}') as Record<string, unknown>;
    const result = deepMerge<Record<string, unknown>>({}, malicious);
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });
});

describe("deepFreeze", () => {
  it("nested objects bhi freeze ho jaate hain", () => {
    const frozen = deepFreeze({ outer: { inner: 1 } });
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.outer)).toBe(true);
  });
});
