import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./helpers";

/**
 * The one end-to-end workflow the product must support: feed → search → company
 * result → company profile → supporting source. Runs against the seeded development
 * sample (npm run db:seed) at every configured viewport.
 */
test("feed → search → company → profile → source", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Research feed" })).toBeVisible();
  const developments = page.getByRole("list", { name: "Developments" });
  await expect(developments.getByRole("listitem").first()).toBeVisible();
  await expect(page.getByText("Development sample").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const searchBox = page.getByRole("search").first().getByRole("searchbox");
  await searchBox.fill("companies working on peripheral nerve stimulation");
  await searchBox.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=/);
  await expect(page.getByRole("heading", { level: 1, name: "Search" })).toBeVisible();
  await expect(page.getByText(/Interpreted from the query/)).toBeVisible();
  await expect(page.getByText(/Lexical search/)).toBeVisible();

  const results = page.getByRole("list", { name: "Search results" });
  await expect(results.getByRole("listitem").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page
    .getByRole("navigation", { name: "Result categories" })
    .getByRole("link", { name: /^Companies/ })
    .click();
  await expect(page).toHaveURL(/category=companies/);
  const firstResult = results.getByRole("listitem").first();
  await expect(firstResult).toBeVisible();
  const companyLink = firstResult.getByRole("link").first();
  const companyName = (await companyLink.textContent())?.trim() ?? "";
  await companyLink.click();

  await expect(page).toHaveURL(/\/companies\//);
  await expect(page.getByRole("heading", { level: 1, name: companyName })).toBeVisible();
  for (const section of [
    "Overview",
    "Technology",
    "Clinical",
    "Research",
    "Funding",
    "Patents",
    "Timeline",
    "Sources",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name: section })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /Save/ }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const ledger = page.locator("#sources");
  const sourceLink = ledger.getByRole("link", { name: /Source record|record/i }).first();
  if (await sourceLink.count()) {
    await sourceLink.click();
    await expect(page).toHaveURL(/\/sources\//);
    await expect(page.getByRole("heading", { level: 2, name: "Provenance" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: /Claims this source supports/ }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});
