import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The deterministic suite. It runs once and exits, reads fixtures from disk,
 * and makes no network call: no model client, no Supabase client, no fetch.
 */
export default defineConfig({
  // `tsconfig.json` sets `jsx: "preserve"`, because Next compiles the JSX itself.
  // Vitest transforms a file at a time and has no compiler after it, so the JSX has
  // to be turned into React calls here. Without this, a test that renders a component
  // fails on the first tag it reads.
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
    watch: false,
    globals: false,
  },
});
