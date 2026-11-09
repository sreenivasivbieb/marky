/**
 * TUNABLES: base + environment override → validated, frozen object.
 *
 * Import hote hi HAR environment ka merged result validate hota hai (ADR 0017). Isliye production override me typo
 * ho to dev me chalate waqt bhi turant error milega, deploy ke baad nahi.
 */
import { APP_ENVS, type AppEnv } from "../app-env.ts";
import { deepFreeze, deepMerge, type DeepPartial } from "../deep-merge.ts";
import { getAppEnv } from "../env.ts";
import { ConfigError } from "../errors.ts";
import { baseTunables } from "./base.ts";
import { tunableOverrides } from "./overrides.ts";
import { tunablesSchema, type Tunables } from "./schema.ts";

/**
 * Ek environment ke liye tunables banao. `base` aur `overrides` parameters sirf tests ke liye hain;
 * app hamesha defaults use karta hai.
 */
export function resolveTunables(
  appEnv: AppEnv,
  base: Tunables = baseTunables,
  overrides: Readonly<Record<AppEnv, DeepPartial<Tunables>>> = tunableOverrides,
): Readonly<Tunables> {
  const merged = deepMerge(base, overrides[appEnv]);
  const result = tunablesSchema.safeParse(merged);
  if (!result.success) throw new ConfigError(`tunables (${appEnv})`, result.error.issues);
  return deepFreeze(result.data);
}

// Import-time validation: har environment ek baar resolve hota hai.
const tunablesByEnv = Object.fromEntries(
  APP_ENVS.map((appEnv) => [appEnv, resolveTunables(appEnv)]),
) as Record<AppEnv, Readonly<Tunables>>;

/** Current (ya diye gaye) environment ke tunables. Default environment process.env.APP_ENV se aata hai. */
export function getTunables(appEnv: AppEnv = getAppEnv()): Readonly<Tunables> {
  return tunablesByEnv[appEnv];
}

export { MIN_SHARE_TOKEN_BYTES, tunablesSchema, type Tunables } from "./schema.ts";
