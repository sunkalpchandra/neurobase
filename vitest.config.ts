import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.ts"],
    exclude: ["node_modules", ".next", "tests/e2e"],
    environmentMatchGlobs: [
      ["src/**/*.test.tsx", "jsdom"],
      ["tests/unit/**/*.test.tsx", "jsdom"],
    ],
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/neurobase_test" },
  },
});
