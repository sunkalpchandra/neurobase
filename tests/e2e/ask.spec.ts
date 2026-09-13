import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./helpers";

test.describe("ask", () => {
  test("offers examples before a question is asked", async ({ page }) => {
    await page.goto("/ask");
    await expect(page.getByRole("heading", { level: 1, name: "Ask" })).toBeVisible();
    await expect(page.getByText("Try one of these")).toBeVisible();
    await page
      .getByRole("link", { name: "Which deep brain stimulation trials are recruiting?" })
      .click();
    await expect(page).toHaveURL(/\/ask\?q=/);
  });

  test("answers from the records and cites every line", async ({ page }) => {
    await page.goto(
      "/ask?q=" + encodeURIComponent("Which deep brain stimulation trials are recruiting?"),
    );
    const answer = page.getByRole("main");
    // The mode is always stated, so a reader knows whether prose was generated.
    await expect(answer.getByText(/Built from records|Generated from records/)).toBeVisible();
    await expect(answer.getByText(/matching record/).first()).toBeVisible();

    const records = page.getByRole("heading", { level: 2, name: "Records this answer used" });
    await expect(records).toBeVisible();
    // Each citation links to the record it came from.
    const firstCitation = page.locator("#citations a").first();
    await expect(firstCitation).toBeVisible();
    const href = await firstCitation.getAttribute("href");
    expect(href).toMatch(/^\/(trials|companies|research|devices|news|patents|researchers)\//);
    await expectNoHorizontalOverflow(page);
  });

  test("explains how the records were found", async ({ page }) => {
    await page.goto(
      "/ask?q=" + encodeURIComponent("What has the FDA cleared for vagus nerve stimulation?"),
    );
    await expect(
      page.getByRole("heading", { level: 2, name: "How the records were found" }),
    ).toBeVisible();
    await expect(page.getByText(/Searched for/)).toBeVisible();
  });

  test("says the records are missing rather than inventing an answer", async ({ page }) => {
    await page.goto("/ask?q=" + encodeURIComponent("xqzv plorptangle wumbleforth zzzq"));
    await expect(page.getByText(/Nothing in the database matches/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "No records matched" })).toBeVisible();
  });

  test("a submitted question reaches the answer", async ({ page }) => {
    await page.goto("/ask");
    await page.getByRole("textbox", { name: "Your question" }).fill("spinal cord stimulation");
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(page).toHaveURL(/q=spinal\+cord\+stimulation|q=spinal%20cord%20stimulation/);
    await expect(page.getByText(/matching record/).first()).toBeVisible();
  });
});
