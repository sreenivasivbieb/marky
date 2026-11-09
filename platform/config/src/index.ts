/**
 * @marky/config: public API. Doosre packages sirf yahan se import karein, andar ki files se nahi.
 */
import { getEnv, type Env } from "./env.ts";
import { getTunables, type Tunables } from "./tunables/index.ts";

export { APP_ENVS, type AppEnv } from "./app-env.ts";
export { ConfigError } from "./errors.ts";
export { getAppEnv, getEnv, parseEnv, type Env } from "./env.ts";
export { getTunables, MIN_SHARE_TOKEN_BYTES, type Tunables } from "./tunables/index.ts";

/**
 * Startup check (fail fast): app aur worker shuru hote hi ise call karein.
 * Env ya tunables galat hon to yahin ConfigError aayega, pehli user request par nahi.
 */
export function assertConfig(): { env: Env; tunables: Readonly<Tunables> } {
  const env = getEnv();
  return { env, tunables: getTunables(env.APP_ENV) };
}
