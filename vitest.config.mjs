import { defineConfig } from "vitest/config";

// Vitest runs the backend suite (node env, CommonJS) and measures v8 coverage
// over src/. The bootstrap entry (src/index.js) is excluded — it only wires
// config + starts the HTTP listener, with no logic to unit-test.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.js"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      exclude: ["src/index.js"],
      reporter: ["text", "text-summary"],
    },
  },
});
