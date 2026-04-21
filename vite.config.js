import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// When deployed to https://<user>.github.io/<repo>/, `base` must be "/<repo>/".
// Set VITE_BASE at build time (the GitHub Action below does this automatically),
// or override it locally if you're deploying elsewhere.
const base = process.env.VITE_BASE || "./";

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    // The ported component is ~1500 lines and bundles papaparse + lodash.
    // Raise the warning threshold so the default 500 kB warning doesn't spook us.
    chunkSizeWarningLimit: 1500,
  },
});
