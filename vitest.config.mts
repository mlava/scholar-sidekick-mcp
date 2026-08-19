import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    isolate: true,
    // vitest >=3 no longer resets vi.fn() state via restoreAllMocks();
    // clear call history before every test so mock.calls[0] stays per-test.
    clearMocks: true,
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/bin.ts"],
    },
  },
});
