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

test("creates a manual relationship from the detail view and keeps it searchable", async ({
  page,
}) => {
  const detailPanel = await openTravelDetail(page);
  const relationshipBlock = infoBlock(detailPanel, "关联笔记");

  await relationshipBlock.getByRole("button", { name: "新增关系" }).click();
  await relationshipBlock.getByLabel("目标资料").selectOption({ label: "文件资料" });
  await relationshipBlock.getByLabel("关系类型").fill("包含");
  await relationshipBlock
    .getByLabel("来源说明")
    .fill("手动整理出行资料时确认");
  await relationshipBlock.getByRole("button", { name: "保存关系" }).click();
  await expect(relationshipBlock.getByText("关系已保存：旅行清单 → 文件资料 · 包含。"))
    .toBeVisible();

  const manualRelationship = relationshipBlock
    .locator(".relationship-open")
    .filter({ hasText: "文件资料" })
    .filter({ hasText: "包含" });

  await expect(manualRelationship).toBeVisible();
  await expect(manualRelationship).toContainText("手动创建");
  await expect(manualRelationship).toContainText("手动可编辑");
  await expect(manualRelationship).toContainText("来源");
  await expect(manualRelationship).toContainText("依据");
  await expect(manualRelationship).toContainText("权限");
  await expect(manualRelationship).toContainText("来源说明：手动整理出行资料时确认");
  await manualRelationship.click();
  await expect(detailPanel.getByRole("heading", { name: "文件资料" })).toBeVisible();

  await page.reload();
  const reloadedDetailPanel = await openTravelDetail(page);
  await expect(
    infoBlock(reloadedDetailPanel, "关联笔记")
      .locator(".relationship-open")
      .filter({ hasText: "文件资料" })
      .filter({ hasText: "包含" }),
  ).toBeVisible();

  const searchInput = page.getByPlaceholder("搜索护照、签证、附件、联系人");
  await searchInput.fill("包含");

  const searchResults = page.getByRole("region", { name: "搜索结果" });
  await expect(searchResults.getByRole("heading", { name: "关系" })).toBeVisible();
  await expect(
    searchResults.getByRole("button", { name: /旅行清单 -> 文件资料.*包含/ }),
  ).toBeVisible();

  await detailPanel.getByRole("button", { name: "历史", exact: true }).click();
  const historyBlock = infoBlock(detailPanel, "变更历史");
  await expect(historyBlock.getByText("手动关系")).toBeVisible();
  await expect(historyBlock.getByText("已新增：包含 · 文件资料")).toBeVisible();
  await expect(historyBlock.getByText("来源说明：手动整理出行资料时确认")).toBeVisible();
});

test("removes a manually created relationship after inline confirmation", async ({ page }) => {
  const detailPanel = await openTravelDetail(page);
  const relationshipBlock = infoBlock(detailPanel, "关联笔记");

  await relationshipBlock.getByRole("button", { name: "新增关系" }).click();
  await relationshipBlock.getByLabel("目标资料").selectOption({ label: "文件资料" });
  await relationshipBlock.getByLabel("关系类型").fill("依赖");
  await relationshipBlock
    .getByLabel("来源说明")
    .fill("手动新增后验证可移除");
  await relationshipBlock.getByRole("button", { name: "保存关系" }).click();

  await expect(
    relationshipBlock
      .locator(".relationship-open")
      .filter({ hasText: "文件资料" })
      .filter({ hasText: "依赖" }),
  ).toBeVisible();

  await relationshipBlock.getByRole("button", { name: "移除关系 文件资料 依赖" }).click();
  await relationshipBlock.getByRole("button", { name: "取消" }).click();
  await expect(relationshipBlock.getByText("已取消移除关系：旅行清单 → 文件资料 · 依赖。"))
    .toBeVisible();
  await expect(
    relationshipBlock
      .locator(".relationship-open")
      .filter({ hasText: "文件资料" })
      .filter({ hasText: "依赖" }),
  ).toBeVisible();
  await relationshipBlock.getByRole("button", { name: "移除关系 文件资料 依赖" }).click();
  await relationshipBlock.getByRole("button", { name: "确认移除" }).click();
  await expect(relationshipBlock.getByText("关系已移除：旅行清单 → 文件资料 · 依赖。"))
    .toBeVisible();
  await expect(
    relationshipBlock
      .locator(".relationship-open")
      .filter({ hasText: "文件资料" })
      .filter({ hasText: "依赖" }),
  ).toHaveCount(0);

  await detailPanel.getByRole("button", { name: "历史", exact: true }).click();
  const historyBlock = infoBlock(detailPanel, "变更历史");
  await expect(
    historyBlock.getByText("已移除：依赖 · 文件资料；来源说明：手动新增后验证可移除"),
  ).toBeVisible();

  await page.reload();
  const reloadedDetailPanel = await openTravelDetail(page);
  await expect(
    infoBlock(reloadedDetailPanel, "关联笔记")
      .locator(".relationship-open")
      .filter({ hasText: "文件资料" })
      .filter({ hasText: "依赖" }),
  ).toHaveCount(0);
});

test("starts a manual relationship from the empty relationship state", async ({ page }) => {
  await page.getByRole("button", { name: /身份证，拖拽可调整图谱位置/ }).click();

  const detailPanel = page.locator(".detail-panel");
  await expect(detailPanel.getByRole("heading", { name: "身份证" })).toBeVisible();

  const relationshipBlock = infoBlock(detailPanel, "关联笔记");
  await expect(relationshipBlock.getByText("暂无关系，可建立与其他资料的联系。")).toBeVisible();

  await detailPanel.getByRole("button", { name: "关系", exact: true }).click();
  await expect(infoBlock(detailPanel, "关系说明").getByText("暂无关系，可建立与其他资料的联系。"))
    .toBeVisible();
  await infoBlock(detailPanel, "关系说明").getByRole("button", { name: "建立关系" }).click();

  await expect(detailPanel.getByRole("button", { name: "概览" })).toHaveClass(/active/);
  await relationshipBlock.getByLabel("目标资料").selectOption({ label: "联系人" });
  await relationshipBlock.getByLabel("关系类型").fill("联系人");
  await relationshipBlock.getByLabel("来源说明").fill("身份证联系人空状态补充");
  await relationshipBlock.getByRole("button", { name: "保存关系" }).click();

  await expect(
    relationshipBlock
      .locator(".relationship-open")
      .filter({ hasText: "联系人" })
      .filter({ hasText: "身份证联系人空状态补充" }),
  ).toBeVisible();
  await expect(relationshipBlock.getByText("暂无关系，可建立与其他资料的联系。")).toHaveCount(0);
});

test("edits a manual relationship and keeps the updated evidence searchable", async ({ page }) => {
  const detailPanel = await openTravelDetail(page);
  const relationshipBlock = infoBlock(detailPanel, "关联笔记");

  await relationshipBlock.getByRole("button", { name: "新增关系" }).click();
  await relationshipBlock.getByLabel("目标资料").selectOption({ label: "文件资料" });
  await relationshipBlock.getByLabel("关系类型").fill("包含");
  await relationshipBlock.getByLabel("来源说明").fill("先关联文件资料");
  await relationshipBlock.getByRole("button", { name: "保存关系" }).click();

  await relationshipBlock.getByRole("button", { name: "编辑关系 文件资料 包含" }).click();
  await relationshipBlock.getByLabel("目标资料").selectOption({ label: "联系人" });
  await relationshipBlock.getByLabel("关系类型").fill("联系人");
  await relationshipBlock.getByLabel("来源说明").fill("紧急联系人来源说明");
  await relationshipBlock.getByRole("button", { name: "保存修改" }).click();
  await expect(relationshipBlock.getByText("关系已更新：旅行清单 → 联系人 · 联系人。"))
    .toBeVisible();

  await expect(
    relationshipBlock
      .locator(".relationship-open")
      .filter({ hasText: "联系人" })
      .filter({ hasText: "紧急联系人来源说明" }),
  ).toBeVisible();
  await expect(
    relationshipBlock
      .locator(".relationship-open")
      .filter({ hasText: "文件资料" })
      .filter({ hasText: "包含" }),
  ).toHaveCount(0);

  const searchInput = page.getByPlaceholder("搜索护照、签证、附件、联系人");
  await searchInput.fill("紧急联系人来源");

  const searchResults = page.getByRole("region", { name: "搜索结果" });
  await expect(searchResults.getByRole("heading", { name: "关系" })).toBeVisible();
  await expect(
    searchResults.getByRole("button", { name: /旅行清单 -> 联系人.*联系人/ }),
  ).toBeVisible();

  await detailPanel.getByRole("button", { name: "历史", exact: true }).click();
  const historyBlock = infoBlock(detailPanel, "变更历史");
  await expect(
    historyBlock.getByText("已更新：包含 · 文件资料 → 联系人 · 联系人"),
  ).toBeVisible();
  await expect(historyBlock.getByText("来源说明：紧急联系人来源说明")).toBeVisible();
});

test("creates reciprocal relationships while keeping seed relationships read-only", async ({
  page,
}) => {
  const detailPanel = await openTravelDetail(page);
  const relationshipBlock = infoBlock(detailPanel, "关联笔记");

  await expect(
    relationshipBlock.getByRole("button", { name: "编辑关系 文件资料 材料" }),
  ).toHaveCount(0);
  await expect(
    relationshipBlock
      .locator(".relationship-open")
      .filter({ hasText: "文件资料" })
      .filter({ hasText: "示例关系" }),
  ).toBeVisible();
  await expect(
    relationshipBlock
      .locator(".relationship-open")
      .filter({ hasText: "文件资料" })
      .filter({ hasText: "示例关系，只读" }),
  ).toBeVisible();
  await expect(
    relationshipBlock
      .locator(".relationship-open")
      .filter({ hasText: "文件资料" })
      .filter({ hasText: "可新增手动关系补充" }),
  ).toBeVisible();
  await expect(
    relationshipBlock
      .locator(".relationship-open")
      .filter({ hasText: "文件资料" })
      .filter({ hasText: "派生来源" }),
  ).toBeVisible();

  await relationshipBlock.getByRole("button", { name: "新增关系" }).click();
  await relationshipBlock.getByLabel("目标资料").selectOption({ label: "联系人" });
  await relationshipBlock.getByLabel("关系类型").fill("包含");
  await relationshipBlock.getByLabel("来源说明").fill("双向整理资料");
  await relationshipBlock.getByLabel("同时创建反向关系").check();
  await expect(relationshipBlock.getByText("将创建：联系人 → 旅行清单 · 属于")).toBeVisible();
  await relationshipBlock.getByRole("button", { name: "保存关系" }).click();
  await expect(
    relationshipBlock.getByText(
      "关系已保存：旅行清单 → 联系人 · 包含；反向关系：联系人 → 旅行清单 · 属于。",
    ),
  ).toBeVisible();

  const forwardRelationship = relationshipBlock
    .locator(".relationship-open")
    .filter({ hasText: "联系人" })
    .filter({ hasText: "包含" });
  await expect(forwardRelationship).toBeVisible();
  await forwardRelationship.click();

  await expect(detailPanel.getByRole("heading", { name: "联系人" })).toBeVisible();
  await expect(
    infoBlock(detailPanel, "关联笔记")
      .locator(".relationship-open")
      .filter({ hasText: "旅行清单" })
      .filter({ hasText: "属于" })
      .filter({ hasText: "双向整理资料" }),
  ).toBeVisible();
});

test("uses semantic reverse labels for reciprocal relationships", async ({ page }) => {
  const detailPanel = await openTravelDetail(page);
  const relationshipBlock = infoBlock(detailPanel, "关联笔记");

  await relationshipBlock.getByRole("button", { name: "新增关系" }).click();
  await relationshipBlock.getByLabel("目标资料").selectOption({ label: "文件资料" });
  await relationshipBlock.getByLabel("关系类型").fill("证明");
  await relationshipBlock.getByLabel("来源说明").fill("旅行材料可证明行程安排");
  await relationshipBlock.getByLabel("同时创建反向关系").check();
  await expect(relationshipBlock.getByText("将创建：文件资料 → 旅行清单 · 被证明")).toBeVisible();
  await relationshipBlock.getByRole("button", { name: "保存关系" }).click();
  await expect(
    relationshipBlock.getByText(
      "关系已保存：旅行清单 → 文件资料 · 证明；反向关系：文件资料 → 旅行清单 · 被证明。",
    ),
  ).toBeVisible();

  await relationshipBlock
    .locator(".relationship-open")
    .filter({ hasText: "文件资料" })
    .filter({ hasText: "证明" })
    .click();
  await expect(detailPanel.getByRole("heading", { name: "文件资料" })).toBeVisible();
  await expect(
    infoBlock(detailPanel, "关联笔记")
      .locator(".relationship-open")
      .filter({ hasText: "旅行清单" })
      .filter({ hasText: "被证明" })
      .filter({ hasText: "旅行材料可证明行程安排" }),
  ).toBeVisible();
  await infoBlock(detailPanel, "关联笔记")
    .getByRole("button", { name: "编辑关系 旅行清单 被证明" })
    .click();
  await expect(infoBlock(detailPanel, "关联笔记").getByLabel("关系类型")).toHaveValue("被证明");
});

test("reuses existing relationship vocabulary in the manual relationship form", async ({
  page,
}) => {
  const detailPanel = await openTravelDetail(page);
  const relationshipBlock = infoBlock(detailPanel, "关联笔记");

  await relationshipBlock.getByRole("button", { name: "新增关系" }).click();
  await relationshipBlock.getByLabel("目标资料").selectOption({ label: "微信账号" });
  await relationshipBlock.getByLabel("关系类型").fill("计划使用");
  await relationshipBlock.getByLabel("来源说明").fill("复用当前资料库关系词");
  await relationshipBlock.getByRole("button", { name: "保存关系" }).click();
  await expect(relationshipBlock.getByText("关系已保存：旅行清单 → 微信账号 · 计划使用。"))
    .toBeVisible();
  await expect(
    relationshipBlock
      .locator(".relationship-open")
      .filter({ hasText: "微信账号" })
      .filter({ hasText: "计划使用" })
      .filter({ hasText: "复用当前资料库关系词" }),
  ).toBeVisible();

  const searchInput = page.getByPlaceholder("搜索护照、签证、附件、联系人");
  await searchInput.fill("计划使用");
  await expect(
    page
      .getByRole("region", { name: "搜索结果" })
      .getByRole("button", { name: /旅行清单 -> 微信账号.*计划使用/ }),
  ).toBeVisible();
});

test("offers built-in relationship templates in the manual relationship form", async ({
  page,
}) => {
  const detailPanel = await openTravelDetail(page);
  const relationshipBlock = infoBlock(detailPanel, "关联笔记");

  await relationshipBlock.getByRole("button", { name: "新增关系" }).click();
  await expect(
    relationshipBlock.locator('datalist#relationship-type-options option[value="保管位置"]'),
  ).toHaveCount(1);
  await expect(relationshipBlock.getByText("可输入新关系词，也可用模板或当前资料库已有关系词。"))
    .toBeVisible();

  await relationshipBlock.getByLabel("目标资料").selectOption({ label: "证书附件" });
  await relationshipBlock.getByLabel("关系类型").fill("保管位置");
  await relationshipBlock.getByLabel("来源说明").fill("内置模板关系词验证");
  await relationshipBlock.getByRole("button", { name: "保存关系" }).click();
  await expect(relationshipBlock.getByText("关系已保存：旅行清单 → 证书附件 · 保管位置。"))
    .toBeVisible();
  await expect(
    relationshipBlock
      .locator(".relationship-open")
      .filter({ hasText: "证书附件" })
      .filter({ hasText: "保管位置" })
      .filter({ hasText: "内置模板关系词验证" }),
  ).toBeVisible();

  const searchInput = page.getByPlaceholder("搜索护照、签证、附件、联系人");
  await searchInput.fill("保管位置");
  await expect(
    page
      .getByRole("region", { name: "搜索结果" })
      .getByRole("button", { name: /旅行清单 -> 证书附件.*保管位置/ }),
  ).toBeVisible();
});

test("creates a manual relationship with a custom relationship type", async ({ page }) => {
  const detailPanel = await openTravelDetail(page);
  const relationshipBlock = infoBlock(detailPanel, "关联笔记");

  await relationshipBlock.getByRole("button", { name: "新增关系" }).click();
  await relationshipBlock.getByLabel("目标资料").selectOption({ label: "项目记录" });
  await relationshipBlock.getByLabel("关系类型").fill("复盘资料");
  await relationshipBlock.getByLabel("来源说明").fill("自定义关系词验证");
  await relationshipBlock.getByRole("button", { name: "保存关系" }).click();
  await expect(relationshipBlock.getByText("关系已保存：旅行清单 → 项目记录 · 复盘资料。"))
    .toBeVisible();
  await expect(
    relationshipBlock
      .locator(".relationship-open")
      .filter({ hasText: "项目记录" })
      .filter({ hasText: "复盘资料" })
      .filter({ hasText: "自定义关系词验证" }),
  ).toBeVisible();

  await detailPanel.getByRole("button", { name: "历史", exact: true }).click();
  await expect(infoBlock(detailPanel, "变更历史").getByText("已新增：复盘资料 · 项目记录"))
    .toBeVisible();

  const searchInput = page.getByPlaceholder("搜索护照、签证、附件、联系人");
  await searchInput.fill("复盘资料");
  await expect(
    page
      .getByRole("region", { name: "搜索结果" })
      .getByRole("button", { name: /旅行清单 -> 项目记录.*复盘资料/ }),
  ).toBeVisible();
});

test("shows audited source details for confirmed AI relationship suggestions", async ({
  page,
}) => {
  const detailPanel = await openTravelDetail(page);
  const suggestionsBlock = infoBlock(detailPanel, "关系建议");
  const contactSuggestion = suggestionsBlock
    .locator("article")
    .filter({ hasText: "紧急联系人" });

  await contactSuggestion.getByRole("button", { name: "确认" }).click();

  const confirmedRelationship = infoBlock(detailPanel, "关联笔记")
    .locator(".relationship-open")
    .filter({ hasText: "联系人" })
    .filter({ hasText: "AI 建议确认" });

  await expect(confirmedRelationship).toBeVisible();
  await expect(confirmedRelationship).toContainText("AI 建议确认");
  await expect(confirmedRelationship).toContainText("AI 建议确认，只读");
  await expect(confirmedRelationship).toContainText("权限");
  await expect(confirmedRelationship).toContainText("可新增手动关系补充");
  await expect(confirmedRelationship).toContainText("来源对象");
});

async function openTravelDetail(page) {
  await page.getByRole("button", { name: /旅行清单，拖拽可调整图谱位置/ }).click();

  const detailPanel = page.locator(".detail-panel");
  await expect(detailPanel.getByRole("heading", { name: "旅行清单" })).toBeVisible();

  return detailPanel;
}

function infoBlock(root, title) {
  return root.locator(".info-block").filter({ hasText: title });
}
