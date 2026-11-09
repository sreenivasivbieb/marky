/**
 * ENV LOADER: secrets + connection settings (CLAUDE.md section 4, ADR 0017).
 *
 * Values `process.env` se aati hain. Docker Compose unhe `.env` se container me daalta hai; app `.env` file
 * khud nahi padhta. Tunables (timeouts, limits) yahan KABHI nahi aate; wo `tunables/` me hain.
 *
 * Validation LAZY hai: pehli `getEnv()` call par hoti hai, phir result cache ho jaata hai. Isse Next.js build
 * (jahan secrets nahi hote) nahi tootta. App/worker startup par `assertConfig()` chalate hain (fail fast).
 */
import { z } from "zod";
import { APP_ENVS, type AppEnv } from "./app-env.ts";
import { ConfigError } from "./errors.ts";

/** URL scheme jo accept hote hain. Postgres dono naam samajhta hai; Valkey Redis protocol bolta hai (TLS = rediss). */
const POSTGRES_URL_PROTOCOL = /^postgres(ql)?$/;
const VALKEY_URL_PROTOCOL = /^rediss?$/;

const appEnvSchema = z.enum(APP_ENVS);

/** AES-256 master key ki lambai (bytes). Format constant hai, tunable nahi (ADR 0025). */
const AI_KEY_ENCRYPTION_KEY_BYTES = 32;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const masterKeySchema = z
  .string()
  .regex(BASE64, "must be base64")
  .refine((v) => Buffer.from(v, "base64").length === AI_KEY_ENCRYPTION_KEY_BYTES, {
    message: `must decode to exactly ${AI_KEY_ENCRYPTION_KEY_BYTES} bytes`,
  });

export const envSchema = z.object({
  APP_ENV: appEnvSchema,
  DATABASE_URL: z.url({ protocol: POSTGRES_URL_PROTOCOL }),
  VALKEY_URL: z.url({ protocol: VALKEY_URL_PROTOCOL }),
  /** Teams ki AI API keys encrypt karne wali master key (base64, 32 bytes). ADR 0025. */
  AI_KEY_ENCRYPTION_KEY: masterKeySchema,
});
// Note: `z.object` (strict nahi), kyunki process.env me PATH, HOME jaisi bahut si aur values hoti hain. Zod unhe chhod deta hai.

export type Env = z.infer<typeof envSchema>;

type EnvSource = Readonly<Record<string, string | undefined>>;

/** Pure function: koi bhi source do (tests me fake object), validated Env lo. Galat ho to ConfigError. */
export function parseEnv(source: EnvSource): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) throw new ConfigError("environment", result.error.issues);
  return result.data;
}

/** Sirf APP_ENV padho. Tunables ko environment ka naam chahiye, secrets nahi. */
export function parseAppEnv(source: EnvSource): AppEnv {
  const result = z.object({ APP_ENV: appEnvSchema }).safeParse(source);
  if (!result.success) throw new ConfigError("environment", result.error.issues);
  return result.data.APP_ENV;
}

let cachedEnv: Env | undefined;
let cachedAppEnv: AppEnv | undefined;

/** process.env se validated Env. Pehli call par validate hota hai, uske baad cache se aata hai. */
export function getEnv(): Env {
  cachedEnv ??= parseEnv(process.env);
  return cachedEnv;
}

/** process.env se validated APP_ENV (cached). */
export function getAppEnv(): AppEnv {
  cachedAppEnv ??= parseAppEnv(process.env);
  return cachedAppEnv;
}
