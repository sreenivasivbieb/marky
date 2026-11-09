/**
 * Chhote helpers jo tunables ke overrides lagane ke kaam aate hain.
 */

type PlainObject = Record<string, unknown>;

/** Har level par har field optional. Override me sirf wahi likho jo badalna hai. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends PlainObject ? DeepPartial<T[K]> : T[K];
};

/** `__proto__` jaise keys object ke prototype ko badal sakte hain (prototype pollution), isliye unhe skip karte hain. */
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isPlainObject(value: unknown): value is PlainObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * `override` ko `base` ke upar merge karo, aur ek NAYA object lautao (base kabhi nahi badalta).
 * - Nested objects: andar tak merge.
 * - Arrays aur baaki values: override poori tarah replace karta hai.
 * - `undefined`: ignore.
 */
export function deepMerge<T extends PlainObject>(base: T, override: DeepPartial<T>): T {
  const result: PlainObject = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined || UNSAFE_KEYS.has(key)) continue;
    const current = result[key];
    result[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return result as T;
}

/** Object ko andar tak freeze karo, taaki runtime par galti se koi tunable badla na ja sake. */
export function deepFreeze<T>(value: T): Readonly<T> {
  if (isPlainObject(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
