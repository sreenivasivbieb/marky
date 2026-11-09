import { describe, expect, it } from "vitest";
import { APP_ENVS, type AppEnv } from "../app-env.ts";
import type { DeepPartial } from "../deep-merge.ts";
import { ConfigError } from "../errors.ts";
import { baseTunables } from "./base.ts";
import { getTunables, resolveTunables } from "./index.ts";
import { MIN_SHARE_TOKEN_BYTES, type Tunables } from "./schema.ts";

/** Sirf ek environment me override, baaki khaali. */
function overridesFor(appEnv: AppEnv, override: DeepPartial<Tunables>): Record<AppEnv, DeepPartial<Tunables>> {
  const empty = Object.fromEntries(APP_ENVS.map((e) => [e, {}])) as Record<AppEnv, DeepPartial<Tunables>>;
  return { ...empty, [appEnv]: override };
}

describe("tunables", () => {
  it.each(APP_ENVS)("'%s' environment valid tunables deta hai", (appEnv) => {
    expect(() => getTunables(appEnv)).not.toThrow();
  });

  it("vitest APP_ENV=test set karta hai, aur default wahi uthata hai", () => {
    expect(getTunables()).toBe(getTunables("test"));
  });

  it("override sirf diya hua field badalta hai", () => {
    const tunables = resolveTunables(
      "test",
      baseTunables,
      overridesFor("test", { editLock: { heartbeatIntervalMs: 50 } }),
    );
    expect(tunables.editLock.heartbeatIntervalMs).toBe(50);
    expect(tunables.editLock.idleReleaseMs).toBe(baseTunables.editLock.idleReleaseMs);
  });

  it("override me typo wali key error deti hai (strict schema)", () => {
    const typo = { editLock: { heartbeatMS: 50 } } as unknown as DeepPartial<Tunables>;
    expect(() => resolveTunables("test", baseTunables, overridesFor("test", typo))).toThrow(ConfigError);
  });

  it("cross-field rule: heartbeat idle release se chhota hona chahiye", () => {
    const bad = overridesFor("production", { editLock: { heartbeatIntervalMs: 60_000, idleReleaseMs: 60_000 } });
    expect(() => resolveTunables("production", baseTunables, bad)).toThrow(/heartbeatIntervalMs/);
  });

  it("share token NFR-12 ke 128-bit floor se chhota nahi ho sakta", () => {
    const weak = overridesFor("development", { shareLinks: { tokenBytes: MIN_SHARE_TOKEN_BYTES - 1 } });
    expect(() => resolveTunables("development", baseTunables, weak)).toThrow(ConfigError);
  });

  it("result frozen hai: runtime par koi tunable badla nahi ja sakta", () => {
    const tunables = getTunables("test");
    expect(Object.isFrozen(tunables)).toBe(true);
    expect(Object.isFrozen(tunables.editLock)).toBe(true);
  });
});
