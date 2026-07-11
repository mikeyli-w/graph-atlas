import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    indexedDB.deleteDatabase("graph-atlas-attachments");
  });
  await page.reload();
  await expect(page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ })).toBeVisible();
});

test("turns an empty search into an inbox item that can be confirmed and found", async ({
  page,
}) => {
  const uniqueId = Date.now();
  const title = `Smoke 酒店订单 ${uniqueId}`;
  const attachmentName = `smoke-hotel-${uniqueId}.pdf`;
  const searchInput = page.getByPlaceholder("搜索护照、签证、附件、联系人");

  await searchInput.fill(title);
  const searchResults = page.getByRole("region", { name: "搜索结果" });
  await expect(searchResults.getByRole("heading", { name: "没有找到相关资料" })).toBeVisible();

  await searchResults.getByRole("button", { name: "新增资料" }).click();

  const inboxForm = page.locator(".inbox-form");
  await expect(page.getByRole("heading", { name: "收集箱" })).toBeVisible();
  await inboxForm.getByLabel("标题").fill(title);
  await inboxForm.getByLabel("类型").selectOption({ label: "文件" });
  await inboxForm.getByLabel("隐私级别").selectOption({ label: "低（可导出）" });
  await inboxForm.getByLabel("摘要").fill("浏览器 smoke 新增资料摘要");
  await inboxForm.getByLabel("附件索引").fill(attachmentName);
  await inboxForm.getByRole("button", { name: "加入收集箱" }).click();
  await expect(
    page.getByText(`已加入收集箱：${title}，可在下方确认入库。`),
  ).toBeVisible();

  const inboxItem = page.locator(".inbox-item").filter({ hasText: title });
  await expect(inboxItem).toBeVisible();
  await expect(inboxItem.getByLabel("附件 1 名称")).toHaveValue(attachmentName);
  await inboxItem.getByRole("button", { name: "移除附件 1" }).click();
  await expect(inboxItem.getByText("确认移除？")).toBeVisible();
  await inboxItem.getByRole("button", { name: "取消" }).click();
  await expect(inboxItem.getByLabel("附件 1 名称")).toHaveValue(attachmentName);
  await expect(inboxItem.getByText("确认移除？")).toHaveCount(0);
  await expect(page.getByText(`已取消移除附件索引：${attachmentName}。`)).toBeVisible();
  await inboxItem.getByRole("button", { name: "移除附件 1" }).click();
  await inboxItem.getByRole("button", { name: "确认移除" }).click();
  await expect(inboxItem.getByLabel("附件 1 名称")).toHaveValue("");
  await inboxItem.getByLabel("附件 1 名称").fill(attachmentName);
  await inboxItem.getByRole("button", { name: "确认入库" }).click();

  await expect(page.getByText(`已入库：${title}。`)).toBeVisible();
  await expect(page.getByRole("heading", { name: "搜索结果" })).toBeVisible();
  await expect(
    searchResults.getByRole("button", {
      name: `${title} 文件 · 低（可导出） · 资料命中`,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: `${title}，拖拽可调整图谱位置` }),
  ).toBeVisible();

  await searchInput.fill(attachmentName);
  await expect(page.getByRole("button", { name: new RegExp(attachmentName) })).toBeVisible();
  await expect(page.getByText(`${title} · 索引 · 低（可导出）`)).toBeVisible();
});

test("confirms rejecting an inbox draft before removing it from pending work", async ({
  page,
}) => {
  const uniqueId = Date.now();
  const title = `Smoke 拒绝草稿 ${uniqueId}`;

  await page.getByRole("button", { name: "收集箱" }).click();
  const inboxForm = page.locator(".inbox-form");
  await inboxForm.getByLabel("标题").fill(title);
  await inboxForm.getByLabel("类型").selectOption({ label: "笔记" });
  await inboxForm.getByLabel("摘要").fill("稍后不再整理的临时资料");
  await inboxForm.getByRole("button", { name: "加入收集箱" }).click();
  await expect(
    page.getByText(`已加入收集箱：${title}，可在下方确认入库。`),
  ).toBeVisible();

  const inboxItem = page.locator(".inbox-item").filter({ hasText: title });
  await expect(inboxItem).toBeVisible();
  await inboxItem.getByRole("button", { name: "拒绝" }).click();
  await expect(inboxItem.getByText("确认拒绝这条待整理资料？")).toBeVisible();
  await inboxItem.getByRole("button", { name: "取消" }).click();
  await expect(inboxItem.getByText("确认拒绝这条待整理资料？")).toHaveCount(0);
  await expect(page.getByText(`已取消拒绝：${title} 仍在待整理列表。`)).toBeVisible();
  await expect(inboxItem).toBeVisible();

  await inboxItem.getByRole("button", { name: "拒绝" }).click();
  await inboxItem.getByRole("button", { name: "确认拒绝" }).click();
  await expect(page.getByText(`已拒绝：${title}。`)).toBeVisible();
  await expect(inboxItem).toHaveCount(0);
  await expect(page.getByText("暂无待整理资料。")).toBeVisible();
  await expect(page.getByText("0 条资料待整理 · 1 条已拒绝")).toBeVisible();

  await page.getByRole("button", { name: "MAP 图谱" }).click();
  const searchResults = page.getByRole("region", { name: "搜索结果" });
  await page.getByPlaceholder("搜索护照、签证、附件、联系人").fill(title);
  await expect(searchResults.getByRole("heading", { name: "没有找到相关资料" })).toBeVisible();
  await expect(page.getByRole("button", { name: `${title}，拖拽可调整图谱位置` })).toHaveCount(0);
});

test("keeps a dragged passport node position after reload", async ({ page }) => {
  const passport = page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ });
  const before = await readGraphNodePosition(passport);
  const graphCanvas = page.locator(".graph-canvas");
  const box = await graphCanvas.boundingBox();

  expect(box).not.toBeNull();

  await passport.dragTo(graphCanvas, {
    force: true,
    targetPosition: {
      x: box.width * 0.72,
      y: box.height * 0.32,
    },
  });
  await page.mouse.up();

  await expect
    .poll(async () => {
      const current = await readGraphNodePosition(passport);
      return Math.abs(current.x - before.x) + Math.abs(current.y - before.y);
    })
    .toBeGreaterThan(1);

  const after = await readGraphNodePosition(passport);

  await page.reload();
  await expect(passport).toBeVisible();

  const persisted = await readGraphNodePosition(passport);
  expect(persisted.x).toBeCloseTo(after.x, 1);
  expect(persisted.y).toBeCloseTo(after.y, 1);
  expect(Math.abs(persisted.x - 50) + Math.abs(persisted.y - 47)).toBeGreaterThan(1);
});

async function readGraphNodePosition(locator) {
  return locator.evaluate((element) => ({
    x: Number.parseFloat(element.style.getPropertyValue("--x")),
    y: Number.parseFloat(element.style.getPropertyValue("--y")),
  }));
}
