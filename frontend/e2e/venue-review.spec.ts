import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const password = "TechZephyr!2026";
const out = "/opt/cursor/artifacts/venue-review";
const stamp = Date.now().toString(36);
const goodTitle = `Institute evening ${stamp}`;
const blockedTitle = `Needs missing ${stamp}`;

test.beforeAll(() => mkdirSync(out, { recursive: true }));

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /enter workspace/i }).click();
  await page.waitForURL("**/dashboard");
}

test("club category is kept and venues can accept or reject", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "club@cit.local");
  await page.getByRole("button", { name: /book a venue/i }).click();
  await expect(page.getByText(/A club can request an institute event/i)).toBeVisible();
  const category = page.locator("select").filter({ has: page.locator('option[value="institute_event"]') });
  await category.selectOption("institute_event");
  await expect(category).toHaveValue("institute_event");
  await page.screenshot({ path: `${out}/club-category.png` });

  const schedules = await page.request.get("/backend/api/v1/schedules");
  const approved = ((await schedules.json()) as { items: Array<{ id: string; status: string }> }).items.find((item) => item.status === "approved");
  expect(approved).toBeTruthy();
  const draft = {
    attendance: 80,
    duration_periods: 2,
    windows: [{ day: "FRI", from_period: 10, to_period: 12 }],
    room_types: ["auditorium"],
    requested_room: null,
    mandatory_for_groups: [],
    assumptions: [],
    follow_up: null,
  };
  const good = await page.request.post("/backend/api/v1/booking-requests", {
    data: { scheduleVersionId: approved!.id, title: goodTitle, requestedCategory: "institute_event", draft: { ...draft, needs: ["projector"] } },
  });
  expect(good.ok()).toBeTruthy();
  const goodBody = await good.json();
  expect(goodBody.appliedCategory).toBe("institute_event");
  expect(["approved", "alternative_offered"]).toContain(goodBody.proposedDecision.status);
  const acceptedLabel = String(goodBody.proposedDecision.status).replaceAll("_", " ");
  const blocked = await page.request.post("/backend/api/v1/booking-requests", {
    data: { scheduleVersionId: approved!.id, title: blockedTitle, requestedCategory: "guest_lecture", draft: { ...draft, needs: ["mic"] } },
  });
  expect(blocked.ok()).toBeTruthy();
  expect((await blocked.json()).appliedCategory).toBe("guest_lecture");

  await page.goto("/bookings");
  const ownGood = page.locator("article", { has: page.getByRole("heading", { name: goodTitle }) });
  await expect(ownGood.getByText(/waiting for an admin or coordinator/i)).toBeVisible();
  await expect(ownGood.getByRole("button", { name: "Accept" })).toHaveCount(0);
  await page.screenshot({ path: `${out}/club-waiting.png` });

  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, "reviewer@cit.local");
  await page.goto("/bookings");
  const incoming = page.locator("article", { has: page.getByRole("heading", { name: goodTitle }) });
  const impossible = page.locator("article", { has: page.getByRole("heading", { name: blockedTitle }) });
  await expect(incoming.getByRole("button", { name: "Accept" })).toBeEnabled();
  await expect(incoming.getByRole("button", { name: "Reject" })).toBeEnabled();
  await expect(impossible.getByRole("button", { name: "Accept" })).toBeDisabled();
  await expect(impossible.getByText(/no valid slot/i)).toBeVisible();
  await page.screenshot({ path: `${out}/reviewer-actions.png` });

  await incoming.getByRole("button", { name: "Accept" }).click();
  await expect(incoming.locator(".job-status")).toHaveText(acceptedLabel);
  await expect(incoming.getByRole("button", { name: "Accept" })).toHaveCount(0);
  await impossible.getByRole("button", { name: "Reject" }).click();
  await expect(impossible.locator(".job-status")).toHaveText("rejected");
  await expect(impossible.getByRole("button", { name: "Reject" })).toHaveCount(0);
  await page.screenshot({ path: `${out}/reviewer-decided.png` });
});
