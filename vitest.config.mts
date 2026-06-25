import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    globals: false,
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "electron/**/*.test.mjs",
      "scripts/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/.next/**", "**/out/**"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html", "lcov"],
      include: [
        "src/domain/**/*.ts",
        "src/presentation/grid/**/*.ts",
        "electron/dosbox/**/*.mjs",
        "scripts/catalogue/**/*.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/types.ts",
        "src/**/index.ts",
        "electron/**/*.test.mjs",
      ],
    },
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
