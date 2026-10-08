import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// A dedicated config so tests never load vite.config.ts (and its lovable plugins).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
