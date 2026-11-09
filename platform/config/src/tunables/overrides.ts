/**
 * PER-ENVIRONMENT OVERRIDES (ADR 0017).
 *
 * Sirf wahi likho jo us environment me base se alag ho. Merge ke baad poora result schema se validate hota hai,
 * isliye typo ya galat value import time par hi pakdi jaati hai.
 *
 * Example (abhi active nahi):
 *   test: { editLock: { heartbeatIntervalMs: 50, idleReleaseMs: 200 } }
 *
 * Abhi sab khaali hain. Koi override tabhi jodna hai jab us environment ki asli zaroorat ho, aur user se discuss karke.
 */
import type { AppEnv } from "../app-env.ts";
import type { DeepPartial } from "../deep-merge.ts";
import type { Tunables } from "./schema.ts";

export const tunableOverrides: Readonly<Record<AppEnv, DeepPartial<Tunables>>> = {
  development: {},
  test: {},
  production: {},
};
