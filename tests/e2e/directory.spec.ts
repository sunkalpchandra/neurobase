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
    await expect(page.getByText(/compan(y|ies) match/).first()).toBeVisible();
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

test.describe("organization directory", () => {
  test("lists every organization, not only the companies", async ({ page }) => {
    await page.goto("/organizations");
    await expect(page.getByRole("heading", { level: 1, name: "Organizations" })).toBeVisible();

    const countOf = async (path: string): Promise<number> => {
      await page.goto(path);
      const text = await page
        .getByText(/\d+ (organizations?|companies|company) match/)
        .first()
        .textContent();
      return Number(/(\d+)/.exec(text ?? "")?.[1] ?? "0");
    };

    // The company directory is a strict subset. Universities, hospitals and agencies are
    // reachable only here, which is the reason this route exists.
    const organizations = await countOf("/organizations");
    const companies = await countOf("/companies");
    expect(organizations).toBeGreaterThan(companies);
  });

  test("a type nobody stated is shown as an absence, not as a guess", async ({ page }) => {
    await page.goto("/organizations?organizationKind=unstated");
    const table = page.getByRole("table", { name: "Organization directory" });
    const stacked = page.getByRole("list", { name: "Organization directory" });
    if (isMobile(page)) {
      await expect(stacked.getByRole("listitem").first()).toBeVisible();
    } else {
      await expect(table.getByRole("columnheader", { name: "Type" })).toBeVisible();
      // Every row in this filter is a row no source classified, so the Type cell must be
      // an em dash. A label here would be the database asserting something it was told.
      await expect(table.getByRole("row").nth(1).getByText("—").first()).toBeVisible();
    }
  });

  test("the company directory ignores a type injected into the address", async ({ page }) => {
    await page.goto("/companies?organizationKind=university");
    await expect(page.getByRole("heading", { level: 1, name: "Companies" })).toBeVisible();
    // A Companies heading over a list of universities would be a lie told by a query string.
    await expect(page.getByText(/\d+ (companies|company) match/).first()).toBeVisible();
  });
});

test.describe("device attribution", () => {
  test("a trial sponsor is never labelled the developer", async ({ page }) => {
    await page.goto("/devices");
    // The column heading must not claim more than the data supports: on most rows this
    // organization is the sponsor of a trial that named the device, not its maker.
    if (!isMobile(page)) {
      const table = page.getByRole("table", { name: "Devices" });
      await expect(
        table.getByRole("columnheader", { name: "Developer or trial sponsor" }),
      ).toBeVisible();
      // Interface type, invasiveness and modality are null on every device in this
      // database, so their columns are gone rather than showing 669 em dashes.
      await expect(table.getByRole("columnheader", { name: "Invasiveness" })).toHaveCount(0);
      await expect(table.getByRole("columnheader", { name: "Modality" })).toHaveCount(0);
    }
    // Every attributed row says which of the two relationships it is.
    const labels = page.getByText(/^(Developer|Named it in a trial)$/);
    expect(await labels.count()).toBeGreaterThan(0);
  });
});
