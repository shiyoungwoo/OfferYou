import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/setup-global.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    deps: {
      optimizer: {
        web: {
          include: ["node:fs", "node:path", "node:crypto"]
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  }
});
