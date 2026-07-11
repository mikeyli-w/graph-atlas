import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("graph-atlas-attachments");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
  await page.reload();
  await expect(page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ })).toBeVisible();
});

test("opens the folded cited answer panel and shows sourced citations", async ({ page }) => {
  const panel = page.getByRole("region", { name: "引用式 AI 问答" });

  await expect(panel.getByText("引用式问答")).toBeVisible();
  await expect(panel.getByText("全库可见上下文 · 需要来源")).toBeVisible();
  await expect(panel.getByPlaceholder("输入一个需要引用依据的问题")).toBeHidden();

  await panel.getByText("引用式问答").click();
  await panel.getByPlaceholder("输入一个需要引用依据的问题").fill("旅行");
  await panel.getByRole("button", { name: "生成引用草案" }).click();

  const answer = panel.locator(".answer-draft");
  const citation = answer.locator("article").filter({ hasText: "旅行清单" });

  await expect(answer.getByText("基于允许访问的资料，找到 1 条有来源依据。")).toBeVisible();
  await expect(citation.locator("strong").filter({ hasText: /^旅行清单$/ })).toBeVisible();
  await expect(citation.getByText("手动创建 · 低（可导出）")).toBeVisible();
  await expect(citation.getByText("日本旅行材料.zip")).toBeVisible();
  await expect(citation.getByText("护照 -> 旅行清单")).toBeVisible();
});

test("does not draft an answer for high privacy scoped material", async ({ page }) => {
  const searchInput = page.getByPlaceholder("搜索护照、签证、附件、联系人");
  const privacyFilter = page.locator(".top-actions select").nth(1);
  const panel = page.getByRole("region", { name: "引用式 AI 问答" });

  await privacyFilter.selectOption({ label: "高隐私" });
  await searchInput.fill("护照");
  await expect(panel.getByText("当前搜索范围 · 需要来源")).toBeVisible();

  await panel.getByText("引用式问答").click();
  await panel.getByPlaceholder("输入一个需要引用依据的问题").fill("护照");
  await panel.getByRole("button", { name: "生成引用草案" }).click();

  const answer = panel.locator(".answer-draft");

  await expect(answer.getByText("知识库中没有可靠依据")).toBeVisible();
  await expect(answer.getByText("1 条：高隐私资料默认不进入 AI")).toBeVisible();
  await expect(answer.getByText("新增资料")).toBeVisible();
  await expect(answer.getByText("检查收集箱")).toBeVisible();
  await expect(answer.getByText("扩大搜索范围")).toBeVisible();
  await expect(answer).not.toContainText("护照首页.jpg");
});
