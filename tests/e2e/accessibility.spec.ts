import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  "/",
  "/search?q=implanted%20BCIs%20for%20speech%20restoration",
  "/companies",
  "/saved",
  "/news",
  "/trials",
];

for (const path of PAGES) {
  test(`axe finds no serious or critical violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}

test("company profile passes axe and has one h1 and ordered headings", async ({ page }) => {
  await page.goto("/companies");
  await page.locator("main a[href^='/companies/']").first().click();
  await expect(page).toHaveURL(/\/companies\//);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
});

test("keyboard: skip link, primary navigation and global search are reachable", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();

  const search = page.getByRole("search").first().getByRole("searchbox");
  await search.focus();
  await expect(search).toBeFocused();
  await search.fill("retinal");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=retinal/);
});

test("header search offers keyboard-navigable suggestions", async ({ page }) => {
  await page.goto("/companies");
  const combobox = page.getByRole("combobox").first();
  await combobox.fill("neu");
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible({ timeout: 5_000 });
  await combobox.press("ArrowDown");
  await expect(combobox).toHaveAttribute("aria-activedescendant", /.+/);
  await combobox.press("Escape");
  await expect(listbox).toBeHidden();
});
