import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90000,
  workers: 1,
  use: { baseURL: "http://localhost:3001", viewport: { width: 1440, height: 900 } },
});
