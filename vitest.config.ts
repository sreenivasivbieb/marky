import { defineConfig } from "vitest/config";
import type { AppEnv } from "./platform/config/src/app-env.ts";

// Tests hamesha "test" environment me chalte hain, taaki tunables ke test overrides lagein (ADR 0017).
const TEST_APP_ENV: AppEnv = "test";

export default defineConfig({
  test: {
    include: ["{apps,modules,platform}/*/src/**/*.test.ts"],
    env: { APP_ENV: TEST_APP_ENV },
  },
});
