import { expect, test } from "@playwright/test";

test("saving a development from the feed lists it on the saved page", async ({ page }) => {
  await page.goto("/");
  const first = page.getByRole("list", { name: "Developments" }).getByRole("listitem").first();
  const title = (await first.getByRole("heading", { level: 3 }).textContent())?.trim() ?? "";
  const save = first.getByRole("button", { name: /^Save/ });
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await expect(save).toHaveText(/Saved/);

  await page.goto("/saved");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("following a company yields recommendations with a reason", async ({ page }) => {
  await page.goto("/companies");
  const companyLink = page.locator("main a[href^='/companies/']").first();
  await companyLink.click();
  await expect(page).toHaveURL(/\/companies\//);
  const follow = page.getByRole("button", { name: /^Follow/ });
  await follow.click();
  await expect(follow).toHaveAttribute("aria-pressed", "true");
  await page.goto("/saved");
  await expect(page.getByRole("heading", { level: 2, name: "For you" })).toBeVisible();
  const recommended = page.getByRole("list", { name: "Recommended developments" });
  if (await recommended.count()) {
    await expect(recommended.getByText(/Recommended: Because you follow/).first()).toBeVisible();
  }
});
