import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    // Inline small assets so the app shell is self-contained
    assetsInlineLimit: 4096,
  },
  server: {
    port: 5173,
    // Required for SpeechRecognition (secure context) in local dev
    https: false, // Use ngrok or localhost — see README
  },
});
