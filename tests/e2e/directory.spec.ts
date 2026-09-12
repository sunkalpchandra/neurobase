import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, isBelowLg, isMobile } from "./helpers";

test.describe("company directory", () => {
  test("renders a table on wide screens and stacked records on mobile", async ({ page }) => {
    await page.goto("/companies");
    await expect(page.getByRole("heading", { level: 1, name: "Companies" })).toBeVisible();
    const table = page.getByRole("table", { name: "Company directory" });
    const stacked = page.getByRole("list", { name: "Company directory" });
    if (isMobile(page)) {
      await expect(table).toBeHidden();
      await expect(stacked.getByRole("listitem").first()).toBeVisible();
      await expect(stacked.getByRole("term").first()).toBeVisible();
    } else {
      await expect(table).toBeVisible();
      await expect(table.getByRole("columnheader", { name: /Company/ })).toBeVisible();
      await expect(table.getByRole("row").nth(1)).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);
  });

  test("filters move into a drawer below the large breakpoint", async ({ page }) => {
    await page.goto("/companies");
    const trigger = page.getByRole("button", { name: /Filters \(\d+\)/ });
    const column = page.getByRole("complementary", { name: "Filters" });
    if (isBelowLg(page)) {
      await expect(column).toBeHidden();
      await expect(trigger).toBeVisible();
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Filters" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Apply filters" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    } else {
      await expect(column).toBeVisible();
      await expect(trigger).toBeHidden();
    }
  });

  test("sorting and filtering change the result set and keep the URL shareable", async ({
    page,
  }) => {
    await page.goto("/companies?sort=funding&direction=desc");
    await expect(page.getByText(/Showing 1–/)).toBeVisible();
    await page.goto("/companies?invasiveness=noninvasive");
    await expect(page.getByText(/compan(y|ies) match/)).toBeVisible();
    const cells = page.getByRole("table", { name: "Company directory" }).getByRole("cell");
    if (!isMobile(page) && (await cells.count()) > 0) {
      await expect(page.getByRole("table").getByText("Noninvasive").first()).toBeVisible();
    }
  });

  test("shows an empty state when nothing matches", async ({ page }) => {
    await page.goto("/companies?q=zzzz-no-such-company-zzzz");
    await expect(page.getByRole("heading", { name: "No companies match" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Clear search and filters" })).toBeVisible();
  });

  test("pagination moves between pages", async ({ page }) => {
    await page.goto("/companies");
    const next = page
      .getByRole("navigation", { name: "Directory pagination" })
      .getByRole("link", { name: "Next" });
    await expect(next).toBeVisible();
    await next.click();
    await expect(page).toHaveURL(/cursor=/);
    await expect(page.getByText(/Showing 26–/)).toBeVisible();
  });
});
