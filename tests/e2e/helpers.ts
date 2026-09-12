import { expect, type Page } from "@playwright/test";

/** Fails when the document is wider than the viewport (horizontal overflow). */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
  });
  expect(overflow.scrollWidth, "document scroll width").toBeLessThanOrEqual(
    overflow.clientWidth + 1,
  );
}

export function isMobile(page: Page): boolean {
  const size = page.viewportSize();
  return size !== null && size.width < 768;
}

export function isBelowLg(page: Page): boolean {
  const size = page.viewportSize();
  return size !== null && size.width < 1024;
}
