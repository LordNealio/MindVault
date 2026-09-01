import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// This repo contains symlinks to sibling projects (legacybridge, mirror,
// portfolio, …). Without an explicit include, Vitest walks into them and runs
// another project's suite against this project's dependencies.
//
// Default environment is node so the pure-logic suites stay fast; component
// journey tests opt into jsdom with a `@vitest-environment jsdom` docblock.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.{test,spec}.{js,jsx}"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
    setupFiles: ["src/test/setup.js"],
  },
});
