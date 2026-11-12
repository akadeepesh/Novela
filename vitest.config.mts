import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    // A fresh in-memory IndexedDB for every test file.
    setupFiles: ["fake-indexeddb/auto"],
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
})
