import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    // A dummy key lets the API route load its client. Validation answers 400
    // before any model call, and no test sends a valid request.
    env: { ANTHROPIC_API_KEY: "test-key-never-used" },
  },
});
