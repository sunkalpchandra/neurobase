import { expect, test } from "@playwright/test";

test.describe("empty, error and not-found states", () => {
  test("unknown company returns the not-found state", async ({ page }) => {
    const response = await page.goto("/companies/no-such-company-slug");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Company not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse the company directory" })).toBeVisible();
  });

  test("search with no matches shows an empty state with a way out", async ({ page }) => {
    await page.goto("/search?q=xqzv%20plorptangle%20wumbleforth");
    await expect(page.getByRole("heading", { name: "No results" })).toBeVisible();
  });

  test("invalid search parameters show an error state instead of crashing", async ({ page }) => {
    await page.goto("/search?q=bci&category=everything");
    await expect(page.getByRole("heading", { name: "Invalid search parameters" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Clear the search" })).toBeVisible();
  });

  test("search without a query offers example queries", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByText("Example queries")).toBeVisible();
    await page.getByRole("link", { name: "retinal prostheses tested in humans" }).click();
    await expect(page).toHaveURL(/q=retinal/);
  });

  test("saved page starts empty for a new visitor", async ({ page }) => {
    await page.goto("/saved");
    await expect(page.getByRole("heading", { name: "Nothing saved yet" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Not following anything" })).toBeVisible();
  });

  test("API errors use the shared envelope", async ({ request }) => {
    const bad = await request.get("/api/search?pageSize=999");
    expect(bad.status()).toBe(400);
    const body = (await bad.json()) as { error: { code: string } };
    expect(body.error.code).toBe("bad_request");
    const missing = await request.get("/api/companies/no-such-company-slug");
    expect(missing.status()).toBe(404);
  });
});
