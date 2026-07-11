import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await expect(page.getByPlaceholder("搜索护照、签证、附件、联系人")).toBeVisible();
});

test("keeps desktop graph and detail panes vertically scrollable", async ({ page }) => {
  const graphPanel = page.locator(".graph-panel");
  const detailPanel = page.locator(".detail-panel");
  const topbar = page.locator(".topbar");

  await expect(graphPanel).toBeVisible();
  await expect(detailPanel).toBeVisible();
  await expect(topbar).toBeVisible();

  await expectCanScroll(page, ".graph-panel");
  await graphPanel.hover();
  await page.mouse.wheel(0, 650);
  await expectScrollTopGreaterThan(page, ".graph-panel", 0);

  await expectCanScroll(page, ".detail-panel");
  await detailPanel.hover();
  await page.mouse.wheel(0, 650);
  await expectScrollTopGreaterThan(page, ".detail-panel", 0);

  await expect(topbar).toBeVisible();
  await expect(page.getByPlaceholder("搜索护照、签证、附件、联系人")).toBeVisible();
});

test("keeps narrow desktop navigation usable without clipping top actions", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 720 });
  await page.reload();
  await expect(page.getByPlaceholder("搜索护照、签证、附件、联系人")).toBeVisible();

  await expect(page.locator(".detail-panel")).toBeHidden();
  await expect(page.locator(".top-actions")).toBeVisible();
  await expect(page.locator(".top-actions").getByRole("button", { name: "新增资料" }))
    .toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectElementNotClipped(page, ".topbar");

  await expectCanScroll(page, ".graph-panel");
  await page.locator(".graph-panel").hover();
  await page.mouse.wheel(0, 650);
  await expectScrollTopGreaterThan(page, ".graph-panel", 0);
});

async function expectCanScroll(page, selector) {
  await expect
    .poll(async () =>
      page.evaluate((paneSelector) => {
        const pane = document.querySelector(paneSelector);
        if (!pane) return false;
        return pane.scrollHeight > pane.clientHeight + 1;
      }, selector),
    )
    .toBe(true);
}

async function expectScrollTopGreaterThan(page, selector, minimum) {
  await expect
    .poll(async () =>
      page.evaluate((paneSelector) => {
        const pane = document.querySelector(paneSelector);
        return pane?.scrollTop || 0;
      }, selector),
    )
    .toBeGreaterThan(minimum);
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);
  expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewportWidth);
}

async function expectElementNotClipped(page, selector) {
  await expect
    .poll(async () =>
      page.evaluate((elementSelector) => {
        const element = document.querySelector(elementSelector);
        if (!element) return false;
        return element.scrollHeight <= element.clientHeight + 1;
      }, selector),
    )
    .toBe(true);
}
