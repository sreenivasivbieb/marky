import { describe, expect, it } from "vitest";
import { ConfigError } from "./errors.ts";
import { parseAppEnv, parseEnv } from "./env.ts";

// Test fixtures: fake values, koi asli secret nahi.
const FAKE_SECRET = "fake-secret-value-for-tests";
const validSource = {
  APP_ENV: "test",
  DATABASE_URL: `postgres://marky:${FAKE_SECRET}@postgres:5432/marky`,
  VALKEY_URL: "redis://valkey:6379",
  AI_KEY_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"), // fake, sirf test
  PATH: "/usr/bin", // process.env me extra keys hoti hain; unhe ignore hona chahiye
};

function captureConfigError(fn: () => unknown): ConfigError {
  try {
    fn();
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error("expected ConfigError, but nothing was thrown");
}

describe("parseEnv", () => {
  it("valid source parse karta hai aur extra keys chhod deta hai", () => {
    const env = parseEnv(validSource);
    expect(env).toEqual({
      APP_ENV: "test",
      DATABASE_URL: validSource.DATABASE_URL,
      VALKEY_URL: validSource.VALKEY_URL,
      AI_KEY_ENCRYPTION_KEY: validSource.AI_KEY_ENCRYPTION_KEY,
    });
    expect(env).not.toHaveProperty("PATH");
  });

  it("postgresql:// aur rediss:// (TLS) bhi accept karta hai", () => {
    expect(() =>
      parseEnv({
        ...validSource,
        DATABASE_URL: "postgresql://u:p@db.example.com/marky",
        VALKEY_URL: "rediss://cache.example.com:6380",
      }),
    ).not.toThrow();
  });

  it("missing DATABASE_URL par ConfigError, jisme field ka naam ho", () => {
    const { DATABASE_URL: _omitted, ...withoutDb } = validSource;
    const error = captureConfigError(() => parseEnv(withoutDb));
    expect(error.problems.some((p) => p.startsWith("DATABASE_URL:"))).toBe(true);
  });

  it("galat scheme (mysql://) reject karta hai", () => {
    const error = captureConfigError(() =>
      parseEnv({ ...validSource, DATABASE_URL: `mysql://marky:${FAKE_SECRET}@db/marky` }),
    );
    expect(error.problems.some((p) => p.startsWith("DATABASE_URL:"))).toBe(true);
  });

  it("error message me secret value KABHI nahi aati", () => {
    const error = captureConfigError(() =>
      parseEnv({ ...validSource, DATABASE_URL: `mysql://marky:${FAKE_SECRET}@db/marky` }),
    );
    expect(error.message).not.toContain(FAKE_SECRET);
    expect(error.problems.join("\n")).not.toContain(FAKE_SECRET);
  });

  it("master key: galat length reject, aur error me key ki value nahi", () => {
    const shortKey = Buffer.alloc(16, 9).toString("base64");
    const error = captureConfigError(() => parseEnv({ ...validSource, AI_KEY_ENCRYPTION_KEY: shortKey }));
    expect(error.problems.some((p) => p.startsWith("AI_KEY_ENCRYPTION_KEY:"))).toBe(true);
    expect(error.message).not.toContain(shortKey);
  });

  it("unknown APP_ENV reject karta hai", () => {
    expect(() => parseEnv({ ...validSource, APP_ENV: "staging" })).toThrow(ConfigError);
  });
});

describe("parseAppEnv", () => {
  it("sirf APP_ENV maangta hai, secrets nahi", () => {
    expect(parseAppEnv({ APP_ENV: "production" })).toBe("production");
  });

  it("missing APP_ENV par ConfigError", () => {
    expect(() => parseAppEnv({})).toThrow(ConfigError);
  });
});
