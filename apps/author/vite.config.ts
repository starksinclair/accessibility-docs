import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  /**
   * The parsing worker loads pdf.js on demand (FR-4.7), so its bundle is
   * split. Vite's default worker format cannot be split, and the worker is
   * already created with `{ type: "module" }`.
   */
  worker: {
    format: "es",
  },
  server: {
    port: 5173,
  },
});
