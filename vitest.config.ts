import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The deterministic suite. It runs once and exits, reads fixtures from disk,
 * and makes no network call: no model client, no Supabase client, no fetch.
 */
export default defineConfig({
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
