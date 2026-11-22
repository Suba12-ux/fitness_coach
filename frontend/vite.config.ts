import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const backend = "http://127.0.0.1:8000";

const proxy = {
  "/workflow": backend,
  "/auth": backend,
  "/health": backend,
  "/ready": backend,
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy,
  },
  preview: {
    proxy,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
