import { expect, test } from "@playwright/test";

test("cookie session survives API calls and is cleared on sign out", async ({ context, page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("admin@cit.local");
  await page.locator('input[type="password"]').fill("TechZephyr!2026");
  await page.getByRole("button", { name: /enter workspace/i }).click();
  await page.waitForURL("**/dashboard");

  const cookies = await context.cookies();
  for (const name of ["tz_access", "tz_refresh"]) {
    const cookie = cookies.find((item) => item.name === name);
    expect(cookie, `${name} should be set`).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
  }
  expect(await page.evaluate(() => localStorage.getItem("tz_access_token"))).toBeNull();
  expect((await page.request.get("/backend/api/v1/auth/me")).status()).toBe(200);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/");
  await expect.poll(async () => (await context.cookies()).some((item) => item.name === "tz_access" || item.name === "tz_refresh")).toBe(false);
  expect((await page.request.get("/backend/api/v1/auth/me")).status()).toBe(401);
});
