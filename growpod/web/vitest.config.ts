import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    // Use forked processes rather than worker threads. The thread pool can hit
    // a SIGBUS in restricted sandbox/CI containers; forks are robust everywhere.
    pool: "forks",
  },
});
