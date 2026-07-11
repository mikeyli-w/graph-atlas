import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await expect(page.getByPlaceholder("搜索护照、签证、附件、联系人")).toBeVisible();
});

test("shows seeded vault menu entries as real materials instead of drafts", async ({ page }) => {
  await expect(page.getByText("13/13 已入库", { exact: true })).toBeVisible();
  await expect(page.locator(".tree-child.missing")).toHaveCount(0);

  for (const title of ["项目记录", "合同索引", "紧急联系人", "证书附件"]) {
    await page.getByRole("button", { name: `打开${title}` }).click();
    await expect(page.locator(".detail-panel").getByRole("heading", { name: title })).toBeVisible();
  }
});

test("explains and highlights the active graph neighborhood", async ({ page }) => {
  await expect(page.getByRole("button", { name: "缩小图谱" })).toBeVisible();
  await expect(page.getByRole("button", { name: "放大图谱" })).toBeVisible();
  await expect(page.getByLabel("当前图谱缩放")).toHaveText("100%");
  await expect(page.locator(".graph-header").getByText("护照 · 10 条直接关系 · 13 个节点可见"))
    .toBeVisible();
  await expect(page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ }))
    .toHaveClass(/active/);
  await expect(page.getByRole("button", { name: /个人资料，拖拽可调整图谱位置/ }))
    .toHaveClass(/focus-related/);
  await expect(page.getByRole("button", { name: /项目记录，拖拽可调整图谱位置/ }))
    .toHaveClass(/focus-dimmed/);

  await page.getByRole("button", { name: /工作经历，拖拽可调整图谱位置/ }).click();

  await expect(page.locator(".graph-header").getByText("工作经历 · 4 条直接关系 · 13 个节点可见"))
    .toBeVisible();
  await expect(page.getByRole("button", { name: /项目记录，拖拽可调整图谱位置/ }))
    .toHaveClass(/focus-related/);
  await expect(page.getByRole("button", { name: /身份证，拖拽可调整图谱位置/ }))
    .toHaveClass(/focus-dimmed/);
  await expect(page.locator(".relationship-toolbar").getByText("可点击跳转，手动关系可编辑。"))
    .toBeVisible();
});

test("uses the seeded emergency contact material for travel check", async ({ page }) => {
  await page
    .getByRole("region", { name: "首页任务摘要" })
    .locator(".travel-check-list")
    .getByRole("button", { name: "紧急联系人" })
    .click();

  await expect(page.getByRole("button", { name: /紧急联系人，拖拽可调整图谱位置/ }))
    .toHaveClass(/active/);
  await expect(page.locator(".detail-panel").getByRole("heading", { name: "紧急联系人" }))
    .toBeVisible();
});
