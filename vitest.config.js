import { defineConfig } from "vitest/config";

// This repo contains symlinks to sibling projects (legacybridge, mirror,
// portfolio, …). Without an explicit include, Vitest walks into them and runs
// another project's suite against this project's dependencies.
export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{js,jsx}"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
  },
});
