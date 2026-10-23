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
      "scripts/**/*.test.mjs",
    ],
    exclude: ["**/node_modules/**", "**/.next/**", "**/out/**"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html", "lcov"],
      include: [
        "src/domain/**/*.ts",
        "src/presentation/grid/**/*.ts",
        "src/presentation/images/**/*.ts",
        "electron/dosbox/**/*.mjs",
        "electron/download/**/*.mjs",
        "electron/imageCache/**/*.mjs",
        "scripts/lib/ingestCache.ts",
        "electron/protocol/**/*.mjs",
        "electron/portable/**/*.mjs",
        "electron/gift/**/*.mjs",
        "src/presentation/hooks/useOnlineStatus.ts",
        "electron/customGames/**/*.mjs",
        "scripts/catalogue/**/*.ts",
        "scripts/build/**/*.mjs",
        "scripts/source/**/*.ts",
        "scripts/starter-pack/starterPack.ts",
        "scripts/stick/**/*.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/types.ts",
        "src/**/index.ts",
        "electron/**/*.test.mjs",
        "scripts/**/*.test.mjs",
        "scripts/**/*.test.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
