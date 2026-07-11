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

test("covers detail navigation, search, privacy, favorite and reset actions", async ({
  page,
}) => {
  const detailPanel = page.locator(".detail-panel");
  const passport = page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ });
  const idCard = page.getByRole("button", { name: /身份证，拖拽可调整图谱位置/ });
  const wechat = page.getByRole("button", { name: /微信账号，拖拽可调整图谱位置/ });
  const contact = page.getByRole("button", { name: "联系人，拖拽可调整图谱位置", exact: true });
  const searchInput = page.getByPlaceholder("搜索护照、签证、附件、联系人");
  const clearSearchButton = page.getByRole("button", { name: "清除当前搜索" });
  const favoriteButton = detailPanel.getByRole("button", { name: "从收藏中移除当前资料" });

  await expect(detailPanel.getByRole("heading", { name: "护照" })).toBeVisible();
  await expect(passport).toHaveClass(/active/);
  await expect(clearSearchButton).toBeDisabled();
  await page.keyboard.press("Control+K");
  await expect(searchInput).toBeFocused();
  await searchInput.fill("证件");
  await expect(clearSearchButton).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(searchInput).toHaveValue("");
  await expect(clearSearchButton).toBeDisabled();
  await searchInput.fill("签证");
  await clearSearchButton.click();
  await expect(searchInput).toHaveValue("");
  await expect(clearSearchButton).toBeDisabled();
  await detailPanel.getByLabel("资料标题").focus();
  await page.keyboard.press("Control+K");
  await expect(detailPanel.getByLabel("资料标题")).toBeFocused();

  await idCard.click();
  await expect(detailPanel.getByRole("heading", { name: "身份证" })).toBeVisible();
  await expect(idCard).toHaveClass(/active/);

  await wechat.click();
  await expect(detailPanel.getByRole("heading", { name: "微信账号" })).toBeVisible();
  await expect(wechat).toHaveClass(/active/);
  const wechatAttachmentBlock = infoBlock(detailPanel, "附件");
  await expect(wechatAttachmentBlock.getByText("暂无附件，可添加文件索引。")).toBeVisible();
  await wechatAttachmentBlock.getByRole("button", { name: "添加文件索引" }).click();
  await wechatAttachmentBlock.getByLabel("附件名称").fill("微信恢复码截图.png");
  await wechatAttachmentBlock.getByLabel("大小或类型").fill("320 KB");
  await wechatAttachmentBlock.getByLabel("附件日期").fill("今天");
  await wechatAttachmentBlock.getByLabel("附件本地引用").fill("/Users/me/Documents/wechat-recovery.png");
  await wechatAttachmentBlock.getByRole("button", { name: "保存附件索引" }).click();
  await expect(wechatAttachmentBlock.getByText("附件索引已保存：微信恢复码截图.png。"))
    .toBeVisible();
  await expect(wechatAttachmentBlock.locator(".attachment strong").getByText("微信恢复码截图.png")).toBeVisible();
  await expect(wechatAttachmentBlock.getByText("/Users/me/Documents/wechat-recovery.png")).toBeVisible();
  await expect(wechatAttachmentBlock.getByText("暂无附件，可添加文件索引。")).toHaveCount(0);

  await searchInput.fill("微信恢复码");
  const searchResults = page.getByRole("region", { name: "搜索结果" });
  await expect(searchResults.getByRole("heading", { name: "附件" })).toBeVisible();
  await expect(searchResults.getByRole("button", { name: /微信恢复码截图\.png.*微信账号/ })).toBeVisible();
  await searchInput.fill("");

  await wechatAttachmentBlock.getByRole("button", { name: "编辑" }).click();
  await wechatAttachmentBlock.getByLabel("附件名称").fill("微信账号恢复资料.png");
  await wechatAttachmentBlock.getByLabel("大小或类型").fill("更新索引");
  await wechatAttachmentBlock.getByLabel("附件本地引用").fill("/Users/me/Documents/wechat-recovery-updated.png");
  await wechatAttachmentBlock.getByRole("button", { name: "保存修改" }).click();
  await expect(wechatAttachmentBlock.getByText("附件索引已更新：微信账号恢复资料.png。"))
    .toBeVisible();
  await expect(wechatAttachmentBlock.locator(".attachment strong").getByText("微信账号恢复资料.png")).toBeVisible();
  await expect(wechatAttachmentBlock.getByText("/Users/me/Documents/wechat-recovery-updated.png")).toBeVisible();

  await searchInput.fill("微信账号恢复资料");
  await expect(searchResults.getByRole("button", { name: /微信账号恢复资料\.png.*微信账号/ })).toBeVisible();
  await searchInput.fill("");

  await wechatAttachmentBlock.getByRole("button", { name: "移除" }).click();
  await wechatAttachmentBlock.getByRole("button", { name: "取消" }).click();
  await expect(wechatAttachmentBlock.getByText("已取消移除附件索引：微信账号恢复资料.png。"))
    .toBeVisible();
  await expect(wechatAttachmentBlock.locator(".attachment strong").getByText("微信账号恢复资料.png")).toBeVisible();
  await wechatAttachmentBlock.getByRole("button", { name: "移除" }).click();
  await wechatAttachmentBlock.getByRole("button", { name: "确认移除" }).click();
  await expect(wechatAttachmentBlock.getByText("附件索引已移除：微信账号恢复资料.png。"))
    .toBeVisible();
  await expect(wechatAttachmentBlock.getByText("暂无附件，可添加文件索引。")).toBeVisible();
  await searchInput.fill("微信账号恢复资料");
  await expect(searchResults.getByRole("heading", { name: "附件" })).toHaveCount(0);
  await searchInput.fill("");

  await contact.click();
  await expect(detailPanel.getByRole("heading", { name: "联系人" })).toBeVisible();
  await expect(contact).toHaveClass(/active/);

  await passport.click();
  await expect(detailPanel.getByRole("heading", { name: "护照" })).toBeVisible();

  await searchInput.fill("护照");
  await expect(passport).toBeVisible();
  await expect(page.getByRole("region", { name: "搜索结果" })).toBeVisible();

  await searchInput.fill("");
  await expect(selectFieldValue(detailPanel, "更新时间")).toHaveText("今天 10:23");
  await detailPanel.getByLabel("隐私级别").selectOption({ label: "低（可导出）" });
  await expect(detailPanel.getByText("隐私级别已保存到本地。")).toBeVisible();
  await expect(selectPriorityValue(detailPanel, "隐私")).toHaveText("低（可导出）");
  await expect(selectFieldValue(detailPanel, "更新时间")).toHaveText("刚刚");

  await detailPanel.getByLabel("资料标题").fill("护照资料");
  await detailPanel.getByLabel("资料类型").fill("旅行证件");
  await detailPanel.getByRole("button", { name: "保存基本信息" }).click();
  await expect(detailPanel.getByText("基本信息已保存：护照资料 · 旅行证件。")).toBeVisible();
  await expect(detailPanel.getByRole("heading", { name: "护照资料" })).toBeVisible();
  await expect(detailPanel.locator(".detail-title").getByText("旅行证件")).toBeVisible();
  await searchInput.fill("护照资料");
  await expect(searchResults.getByRole("button", { name: /护照资料.*旅行证件/ })).toBeVisible();
  await searchInput.fill("");

  await expect(favoriteButton).toHaveClass(/active/);
  await expect(favoriteButton).toHaveAttribute("aria-pressed", "true");
  await favoriteButton.click();
  const unfavoriteButton = detailPanel.getByRole("button", { name: "收藏当前资料" });
  await expect(unfavoriteButton).not.toHaveClass(/active/);
  await expect(unfavoriteButton).toHaveAttribute("aria-pressed", "false");
  await expect(detailPanel.getByText("已取消收藏。")).toBeVisible();
  await unfavoriteButton.click();
  await expect(detailPanel.getByRole("button", { name: "从收藏中移除当前资料" })).toHaveClass(/active/);
  await expect(detailPanel.getByText("已加入收藏。")).toBeVisible();

  const tagBlock = infoBlock(detailPanel, "标签");
  await tagBlock.getByLabel("新增标签").click();
  await tagBlock.getByPlaceholder("新增标签").fill("临时标签甲");
  await tagBlock.getByRole("button", { name: "保存" }).click();
  await expect(tagBlock.getByText("标签已保存：临时标签甲。")).toBeVisible();
  await expect(tagChip(tagBlock, "临时标签甲")).toBeVisible();
  await tagChip(tagBlock, "临时标签甲").getByRole("button", { name: "编辑" }).click();
  await tagBlock.getByLabel("编辑标签").fill("临时标签乙");
  await tagBlock.getByRole("button", { name: "保存修改" }).click();
  await expect(tagBlock.getByText("标签已更新：临时标签甲 → 临时标签乙。")).toBeVisible();
  await expect(tagChip(tagBlock, "临时标签乙")).toBeVisible();
  await expect(tagChip(tagBlock, "临时标签甲")).toHaveCount(0);

  await searchInput.fill("临时标签乙");
  await expect(searchResults.getByRole("button", { name: /护照.*证件/ })).toBeVisible();
  await searchInput.fill("");

  await tagChip(tagBlock, "临时标签乙").getByRole("button", { name: "移除" }).click();
  await tagChip(tagBlock, "临时标签乙").getByRole("button", { name: "取消" }).click();
  await expect(tagBlock.getByText("已取消移除标签：临时标签乙。")).toBeVisible();
  await expect(tagChip(tagBlock, "临时标签乙")).toBeVisible();
  await tagChip(tagBlock, "临时标签乙").getByRole("button", { name: "移除" }).click();
  await tagChip(tagBlock, "临时标签乙").getByRole("button", { name: "确认移除" }).click();
  await expect(tagBlock.getByText("标签已移除：临时标签乙。")).toBeVisible();
  await expect(tagChip(tagBlock, "临时标签乙")).toHaveCount(0);
  await searchInput.fill("临时标签乙");
  await expect(searchResults.getByRole("button", { name: /护照.*证件/ })).toHaveCount(0);
  await searchInput.fill("");

  await detailPanel.getByRole("button", { name: "属性", exact: true }).click();
  await detailPanel.getByLabel("Markdown 内容").fill("桌面端编辑后的护照资料");
  await expect(detailPanel.getByText("Markdown 已自动保存到本地。")).toBeVisible();
  await expect(detailPanel.getByLabel("Markdown 内容")).toHaveValue("桌面端编辑后的护照资料");
  await detailPanel.getByRole("button", { name: "概览", exact: true }).click();

  const sourceBlock = infoBlock(detailPanel, "来自哪里");
  await sourceBlock.getByLabel("来源说明").fill("来源：护照纸质原件核验");
  await sourceBlock.getByRole("button", { name: "补充来源" }).click();
  await expect(sourceBlock.getByText("来源说明已补充：来源：护照纸质原件核验。")).toBeVisible();
  await expect(sourceBlock.locator(".source-list strong").getByText("来源：护照纸质原件核验")).toBeVisible();
  await sourceBlock.getByRole("button", { name: "编辑" }).click();
  await sourceBlock.getByLabel("编辑来源说明").fill("来源：护照原件与扫描件核验");
  await sourceBlock.getByRole("button", { name: "保存" }).click();
  await expect(sourceBlock.getByText("来源说明已更新：来源：护照原件与扫描件核验。")).toBeVisible();
  await expect(sourceBlock.locator(".source-list strong").getByText("来源：护照原件与扫描件核验")).toBeVisible();

  await searchInput.fill("扫描件核验");
  await expect(searchResults.getByRole("heading", { name: "来源" })).toBeVisible();
  await expect(
    searchResults.getByRole("button", {
      name: /来源：护照原件与扫描件核验.*护照.*manual/,
    }),
  ).toBeVisible();
  await searchInput.fill("");
  await sourceBlock.getByRole("button", { name: "移除" }).click();
  await sourceBlock.getByRole("button", { name: "取消" }).click();
  await expect(sourceBlock.getByText("已取消移除来源说明：来源：护照原件与扫描件核验。")).toBeVisible();
  await expect(sourceBlock.locator(".source-list strong").getByText("来源：护照原件与扫描件核验")).toBeVisible();
  await sourceBlock.getByRole("button", { name: "移除" }).click();
  await sourceBlock.getByRole("button", { name: "确认移除" }).click();
  await expect(sourceBlock.getByText("来源说明已移除：来源：护照原件与扫描件核验。")).toBeVisible();
  await expect(sourceBlock.locator(".source-list strong").getByText("来源：护照原件与扫描件核验")).toHaveCount(0);
  await searchInput.fill("扫描件核验");
  await expect(page.getByRole("heading", { name: "来源" })).toHaveCount(0);
  await searchInput.fill("");

  await detailPanel.getByRole("button", { name: "历史", exact: true }).click();
  const historyBlock = infoBlock(detailPanel, "变更历史");
  await expect(historyBlock.getByText("资料更新")).toBeVisible();
  await expect(historyBlock.getByText("内容更新")).toBeVisible();
  await expect(historyBlock.getByText("创建资料")).toBeVisible();
  await expect(historyBlock.getByText("今天同步标签")).toHaveCount(0);

  await searchInput.fill("护照");
  await page.getByRole("button", { name: "重置" }).click();
  await expect(page.getByText("确认重置资料库？")).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();
  await expect(page.getByText("确认重置资料库？")).toBeHidden();
  await expect(page.getByText("已取消重置资料库，当前资料库未更改。")).toBeVisible();
  await expect(searchInput).toHaveValue("护照");
  await page.getByRole("button", { name: "重置" }).click();
  await expect(page.getByText("确认重置资料库？")).toBeVisible();
  await page.getByRole("button", { name: "确认重置" }).click();

  await expect(detailPanel.getByRole("heading", { name: "护照" })).toBeVisible();
  await expect(searchInput).toHaveValue("");
  await expect(page.getByText("资料库已重置为示例数据。")).toBeVisible();
  await expect(selectPriorityValue(detailPanel, "隐私")).toHaveText("高（仅自己可见）");
  await expect(selectFieldValue(detailPanel, "更新时间")).toHaveText("今天 10:23");
  await expect(detailPanel.getByRole("button", { name: "从收藏中移除当前资料" })).toHaveClass(/active/);
  await expect(page.getByText("确认重置资料库？")).toBeHidden();
});

function selectFieldValue(root, label) {
  return root.locator(".field-row").filter({ hasText: label }).locator("strong");
}

function selectPriorityValue(root, label) {
  return root.locator(".detail-priority-strip > div").filter({ hasText: label }).locator("strong");
}

function infoBlock(root, title) {
  return root.locator(".info-block").filter({ hasText: title });
}

function tagChip(root, tag) {
  return root.locator(".tag-chip").filter({ hasText: new RegExp(`^${tag}`) });
}
