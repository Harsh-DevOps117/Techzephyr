import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const password = "TechZephyr!2026";
const out = "/opt/cursor/artifacts/roles";

const accounts = [
  { id: "admin", email: "admin@cit.local", allow: ["/dashboard", "/datasets", "/schedule", "/approvals", "/approve", "/bookings", "/repair", "/manual", "/jobs", "/profile"], deny: [] as string[] },
  { id: "reviewer", email: "reviewer@cit.local", allow: ["/dashboard", "/datasets", "/schedule", "/approvals", "/approve", "/bookings", "/repair", "/manual", "/jobs", "/profile"], deny: [] as string[] },
  { id: "coordinator", email: "coordinator.cse@cit.local", allow: ["/dashboard", "/datasets", "/schedule", "/bookings", "/repair", "/manual", "/jobs", "/profile"], deny: ["/approvals", "/approve"] },
  { id: "faculty", email: "faculty.cse@cit.local", allow: ["/dashboard", "/datasets", "/schedule", "/bookings", "/repair", "/jobs", "/profile"], deny: ["/approvals", "/approve", "/manual"] },
  { id: "club", email: "club@cit.local", allow: ["/dashboard", "/schedule", "/bookings", "/jobs", "/profile"], deny: ["/datasets", "/approvals", "/approve", "/repair", "/manual"] },
];

const results: { account: string; route: string; expect: string; result: string }[] = [];

test.beforeAll(() => mkdirSync(out, { recursive: true }));

test("landing", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /campus week/i })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("lenis"))).toBe(true);
  await revealPage(page);
  await page.screenshot({ path: `${out}/landing-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await revealPage(page);
  await page.screenshot({ path: `${out}/landing-mobile.png`, fullPage: true });
});

async function settle(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => {
    const node = document.querySelector("[data-page-transition]");
    if (!node) return true;
    return Number(getComputedStyle(node).opacity) > 0.98;
  });
}

async function revealPage(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    for (let y = 0; y <= height; y += 320) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(200);
}

for (const account of accounts) {
  test(account.id, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(account.email);
    await page.locator('input[type="password"]').fill(password);
    if (account.id === "admin") {
      await page.screenshot({ path: `${out}/login-desktop.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `${out}/login-mobile.png` });
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    await page.getByRole("button", { name: /enter workspace/i }).click();
    await page.waitForURL("**/dashboard");
    await settle(page);
    await expect(page.locator(".sidebar-foot strong")).not.toHaveText("CIT user");
    await expect(page.getByTestId("forbidden")).toHaveCount(0);
    if (account.id === "club") {
      await expect(page.getByRole("link", { name: /data manager/i })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /plan a repair/i })).toHaveCount(0);
    }
    if (account.id === "faculty" || account.id === "coordinator") {
      await expect(page.getByRole("link", { name: /next: approvals/i })).toHaveCount(0);
    }

    for (const route of account.allow) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(route);
      await settle(page);
      await expect(page.getByTestId("forbidden")).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("Cannot reach the API");
      results.push({ account: account.id, route, expect: "allowed", result: "pass" });
      const name = route === "/dashboard" ? "dashboard" : route.slice(1);
      if (["dashboard", "schedule", "bookings", "profile"].includes(name) || account.id === "admin") {
        await page.screenshot({ path: `${out}/${account.id}-${name}-desktop.png` });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(350);
        await page.screenshot({ path: `${out}/${account.id}-${name}-mobile.png` });
      }
    }

    for (const route of account.deny) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(route);
      await settle(page);
      await expect(page.getByTestId("forbidden")).toBeVisible();
      results.push({ account: account.id, route, expect: "forbidden", result: "pass" });
      await page.screenshot({ path: `${out}/${account.id}-${route.slice(1)}-forbidden.png` });
    }
  });
}

test.afterAll(() => {
  writeFileSync(`${out}/matrix.json`, JSON.stringify(results, null, 2));
});
