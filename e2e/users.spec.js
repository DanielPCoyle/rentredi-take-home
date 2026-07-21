const { test, expect } = require("@playwright/test");

// Unique name per test so the shared in-memory store doesn't cause collisions.
function uniqueName(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
}

function cardFor(page, name) {
  return page.locator(".card", { hasText: name });
}

async function createUser(page, name, zip = "78701") {
  await page.getByPlaceholder("Name").fill(name);
  await page.getByPlaceholder("ZIP (e.g. 78701)").fill(zip);
  await page.getByRole("button", { name: "Add user" }).click();
  await expect(cardFor(page, name)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "RentRedi Users" })).toBeVisible();
});

test("creates a user and shows a live local clock", async ({ page }) => {
  const name = uniqueName("Ada");
  await createUser(page, name);

  const card = cardFor(page, name);
  await expect(card.locator(".clock")).toBeVisible();
  // Clock ticks: the value should change within ~2s.
  const first = await card.locator(".clock").innerText();
  await expect(async () => {
    expect(await card.locator(".clock").innerText()).not.toEqual(first);
  }).toPass({ timeout: 3000 });
});

test("updates a user's name", async ({ page }) => {
  const name = uniqueName("Grace");
  const renamed = uniqueName("Grace-Hopper");
  await createUser(page, name);

  const card = cardFor(page, name);
  await card.getByRole("button", { name: "Edit" }).click();
  await card.getByPlaceholder("Name").fill(renamed);
  await card.getByRole("button", { name: "Save" }).click();

  await expect(cardFor(page, renamed)).toBeVisible();
});

test("deletes a user", async ({ page }) => {
  const name = uniqueName("Alan");
  await createUser(page, name);

  await cardFor(page, name).getByRole("button", { name: "Delete" }).click();
  await expect(cardFor(page, name)).toHaveCount(0);
});

test("shows a validation error for a malformed zip", async ({ page }) => {
  await page.getByPlaceholder("Name").fill(uniqueName("Bad"));
  await page.getByPlaceholder("ZIP (e.g. 78701)").fill("abc");
  await page.getByRole("button", { name: "Add user" }).click();

  await expect(page.locator(".error")).toBeVisible();
});
