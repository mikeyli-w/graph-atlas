import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { seedKnowledgeStore } from "../src/data/seedKnowledgeStore.js";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

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
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("graph-atlas-attachment-directory");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
  await page.reload();
  await expect(page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ })).toBeVisible();
});

test("shows settings release readiness and opens the inbox", async ({ page }) => {
  await page.getByRole("button", { name: "设置" }).click();

  const settingsView = page.locator(".settings-view");
  const localData = settingsView.locator(".settings-metrics");
  const materialMetric = localData.locator("> div").filter({ hasText: "资料" });
  const relationshipMetric = localData.locator("> div").filter({ hasText: "关系" });

  await expect(settingsView.getByRole("heading", { name: "设置" })).toBeVisible();
  await expect(settingsView.getByRole("heading", { name: "本地数据" })).toBeVisible();
  await expect(materialMetric.getByText("13")).toBeVisible();
  await expect(materialMetric.getByText("资料", { exact: true })).toBeVisible();
  await expect(relationshipMetric.getByText("20")).toBeVisible();
  await expect(relationshipMetric.getByText("关系", { exact: true })).toBeVisible();
  await expect(settingsView.getByRole("heading", { name: "隐私分布" })).toBeVisible();
  await expect(settingsView.getByText("高（仅自己可见）")).toBeVisible();
  await expect(settingsView.getByText("低（可导出）")).toBeVisible();
  await expect(settingsView.getByRole("heading", { name: "发布准备度" })).toBeVisible();
  await expect(settingsView.getByText("10/10 项自动检查通过")).toBeVisible();
  await expect(settingsView.getByText(`版本 ${packageJson.version}`)).toBeVisible();
  await expect(settingsView.getByText("静态前端发布")).toBeVisible();
  await expect(settingsView.getByText("本地优先，当前不会自动上传或云同步")).toBeVisible();
  await expect(settingsView.getByText("通过 · 隐私与安全 · AI 不是首页任务入口")).toBeVisible();
  await expect(settingsView.getByText("IndexedDB 附件副本", { exact: true })).toBeVisible();
  await expect(settingsView.getByText("本地备份包", { exact: true }).first()).toBeVisible();
  await expect(settingsView.getByText("大文件长期保存", { exact: true })).toBeVisible();
  await expect(settingsView.getByText("0 个大文件待外部存储")).toBeVisible();
  await expect(settingsView.getByText("文件系统 adapter", { exact: true })).toBeVisible();
  await expect(settingsView.getByText("后端同步 adapter", { exact: true })).toBeVisible();
  await expect(settingsView.getByText("当前不会自动上传或云同步。")).toBeVisible();

  await settingsView.getByRole("button", { name: "恢复布局" }).click();
  await expect(settingsView.getByText("确认恢复默认布局？")).toBeVisible();
  await settingsView.getByRole("button", { name: "取消" }).click();
  await expect(settingsView.getByText("确认恢复默认布局？")).toHaveCount(0);
  await expect(settingsView.getByText("已取消恢复默认布局，当前节点位置未更改。")).toBeVisible();
  await settingsView.getByRole("button", { name: "恢复布局" }).click();
  await settingsView.getByRole("button", { name: "确认恢复" }).click();
  await expect(settingsView.getByText("默认布局已恢复。")).toBeVisible();

  await settingsView.getByRole("button", { name: "收集箱" }).click();
  await expect(page.getByRole("heading", { name: "收集箱" })).toBeVisible();
});

test("shows local attachment directory capability after authorization", async ({ page }) => {
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => navigator.storage.getDirectory();
  });
  await page.reload();
  await expect(page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ })).toBeVisible();

  await page.getByRole("button", { name: "设置" }).click();

  const settingsView = page.locator(".settings-view");
  await expect(settingsView.getByText("文件系统 adapter", { exact: true })).toBeVisible();
  await expect(settingsView.getByText("未启用 · 只保存到本机，不会自动云同步"))
    .toBeVisible();

  await settingsView.getByRole("button", { name: "选择附件目录" }).click();

  await expect(settingsView.getByText("已授权 · 只保存到本机，不会自动云同步")).toBeVisible();
  await expect(settingsView.getByText("本地附件目录已启用")).toBeVisible();

  await settingsView.getByRole("button", { name: "清除目录授权" }).click();
  await expect(settingsView.getByText("确认清除目录授权？")).toBeVisible();
  await settingsView.getByRole("button", { name: "取消" }).click();
  await expect(settingsView.getByText("确认清除目录授权？")).toHaveCount(0);
  await expect(settingsView.getByText("已取消清除本地附件目录授权，当前配置未更改。"))
    .toBeVisible();
  await expect(settingsView.getByText("已授权 · 只保存到本机，不会自动云同步")).toBeVisible();

  await settingsView.getByRole("button", { name: "清除目录授权" }).click();
  await settingsView.getByRole("button", { name: "确认清除" }).click();
  await expect(settingsView.getByText("目录授权已清除")).toBeVisible();
  await expect(settingsView.getByText("未启用 · 只保存到本机，不会自动云同步"))
    .toBeVisible();
});

test("shows remote attachment upload configuration status", async ({ page }) => {
  await page.getByRole("button", { name: "设置" }).click();

  const settingsView = page.locator(".settings-view");
  await expect(settingsView.getByText("后端附件上传", { exact: true })).toBeVisible();
  await expect(settingsView.getByText("未配置 · 可选客户端 endpoint")).toBeVisible();

  await settingsView.getByRole("button", { name: "保存后端配置" }).click();
  await expect(settingsView.getByText("未填写后端 endpoint，配置保持未启用。")).toBeVisible();
  await expect(settingsView.getByText("未配置 · 可选客户端 endpoint")).toBeVisible();

  await settingsView.getByLabel("后端上传 endpoint").fill("/mock-attachment-upload");
  await settingsView.getByLabel("后端上传 token").fill("smoke-token");
  await settingsView.getByRole("button", { name: "保存后端配置" }).click();
  const largeFileSummary = settingsView.getByLabel("大文件长期保存");

  await expect(settingsView.getByText("后端附件上传配置已保存")).toBeVisible();
  await expect(settingsView.getByText("已配置 · 可选客户端 endpoint")).toBeVisible();
  await expect(largeFileSummary.getByText("后端附件上传已配置", { exact: true })).toBeVisible();
  await expect(largeFileSummary.getByText("后续新选择的大文件可保存到已配置的后端 endpoint"))
    .toBeVisible();

  await settingsView.getByRole("button", { name: "清除后端配置" }).click();
  await expect(settingsView.getByText("确认清除后端配置？")).toBeVisible();
  await settingsView.getByRole("button", { name: "取消" }).click();
  await expect(settingsView.getByText("确认清除后端配置？")).toHaveCount(0);
  await expect(settingsView.getByText("已取消清除后端附件上传配置，当前配置未更改。"))
    .toBeVisible();
  await expect(settingsView.getByText("已配置 · 可选客户端 endpoint")).toBeVisible();

  await settingsView.getByRole("button", { name: "清除后端配置" }).click();
  await settingsView.getByRole("button", { name: "确认清除" }).click();
  await expect(settingsView.getByText("后端附件上传配置已清除")).toBeVisible();
  await expect(settingsView.getByText("未配置 · 可选客户端 endpoint")).toBeVisible();
  await expect(largeFileSummary.getByText("0 个大文件待外部存储")).toBeVisible();

  await settingsView.getByLabel("选择历史大文件补拷贝").setInputFiles({
    name: "no-pending-large-file.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("no pending large file"),
  });

  await expect(settingsView.getByText("当前没有历史大文件需要补拷贝。")).toBeVisible();
});

test("configures manual cloud sync snapshots without overwriting local data", async ({ page }) => {
  const cloudRequests = [];

  await page.route("**/mock-cloud-sync/**", async (route) => {
    const request = route.request();
    const url = request.url();
    cloudRequests.push({
      method: request.method(),
      url,
      body: request.method() === "POST" ? request.postDataJSON() : null,
      authorization: request.headers().authorization,
    });

    if (url.endsWith("/capabilities")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ label: "Mock Cloud Sync" }),
      });
      return;
    }

    if (url.endsWith("/snapshots") && request.method() === "POST") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          snapshotId: "cloud-snapshot-smoke",
          updatedAt: "2026-07-01T02:00:00.000Z",
        }),
      });
      return;
    }

    if (url.endsWith("/snapshots/latest")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          snapshotId: "cloud-snapshot-preview",
          updatedAt: "2026-07-01T02:10:00.000Z",
          summary: {
            entityCount: 99,
            relationshipCount: 88,
            attachmentCount: 77,
            updatedAt: "2026-07-01T02:05:00.000Z",
          },
        }),
      });
      return;
    }

    await route.fulfill({ status: 404, body: "{}" });
  });

  await page.getByRole("button", { name: "设置" }).click();

  const settingsView = page.locator(".settings-view");
  const localData = settingsView.locator(".settings-metrics");
  const materialMetric = localData.locator("> div").filter({ hasText: "资料" });

  await expect(settingsView.getByText("云同步", { exact: true })).toBeVisible();
  await expect(settingsView.getByText("未配置 · 手动快照客户端，不自动上传或合并"))
    .toBeVisible();
  await expect(settingsView.getByText("云同步未配置")).toBeVisible();

  await settingsView.getByRole("button", { name: "保存云同步配置" }).click();
  await expect(settingsView.getByText("未填写云同步 endpoint，配置保持未启用。")).toBeVisible();

  await settingsView.getByLabel("云同步 endpoint").fill("/mock-cloud-sync");
  await settingsView.getByLabel("云同步 token").fill("sync-token");
  await settingsView.getByRole("button", { name: "保存云同步配置" }).click();
  await expect(settingsView.getByText("云同步配置已保存")).toBeVisible();
  await expect(settingsView.getByText("已配置 · 手动快照客户端，不自动上传或合并"))
    .toBeVisible();

  await settingsView.getByRole("button", { name: "测试连接" }).click();
  await expect(settingsView.getByText("云同步连接成功：Mock Cloud Sync。")).toBeVisible();
  await expect(settingsView.getByText("连接成功 · 手动快照客户端，不自动上传或合并"))
    .toBeVisible();

  await settingsView.getByRole("button", { name: "推送当前资料库快照" }).click();
  await expect(settingsView.getByText("确认推送当前资料库快照？")).toBeVisible();
  await settingsView.getByRole("button", { name: "取消" }).click();
  await expect(settingsView.getByText("已取消推送云同步快照，当前资料库未上传。"))
    .toBeVisible();
  await settingsView.getByRole("button", { name: "推送当前资料库快照" }).click();
  await settingsView.getByRole("button", { name: "确认推送" }).click();
  await expect(settingsView.getByText("当前资料库快照已推送：cloud-snapshot-smoke。"))
    .toBeVisible();
  await expect(settingsView.getByText("最近成功 · 手动快照客户端，不自动上传或合并"))
    .toBeVisible();

  await settingsView.getByRole("button", { name: "检查远端快照" }).click();
  await expect(settingsView.getByText("远端快照已读取为预览，不会自动覆盖本地资料库。"))
    .toBeVisible();
  const snapshotPreview = settingsView.getByLabel("远端快照预览");
  await expect(snapshotPreview.getByText("cloud-snapshot-preview")).toBeVisible();
  await expect(snapshotPreview.getByText(/cloud-snapshot-preview · 99 份资料/)).toBeVisible();
  await expect(snapshotPreview.getByText("88 条关系")).toBeVisible();
  await expect(snapshotPreview.getByText("77 个附件索引")).toBeVisible();
  await expect(snapshotPreview.getByText("本地 13 份资料 · 远端 99 份资料")).toBeVisible();
  await expect(snapshotPreview.getByText("只能预览数量差异，无法判断具体冲突。"))
    .toBeVisible();
  await expect(materialMetric.getByText("13")).toBeVisible();

  await settingsView.getByRole("button", { name: "清除云同步配置" }).click();
  await expect(settingsView.getByText("确认清除云同步配置？")).toBeVisible();
  await settingsView.getByRole("button", { name: "取消" }).click();
  await expect(settingsView.getByText("已取消清除云同步配置，当前配置未更改。"))
    .toBeVisible();
  await expect(settingsView.getByText("可预览 · 手动快照客户端，不自动上传或合并"))
    .toBeVisible();
  await settingsView.getByRole("button", { name: "清除云同步配置" }).click();
  await settingsView.getByRole("button", { name: "确认清除" }).click();
  await expect(settingsView.getByText("云同步配置已清除。")).toBeVisible();
  await expect(settingsView.getByText("未配置 · 手动快照客户端，不自动上传或合并"))
    .toBeVisible();

  expect(cloudRequests).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        method: "GET",
        authorization: "Bearer sync-token",
      }),
      expect.objectContaining({
        method: "POST",
        authorization: "Bearer sync-token",
        body: expect.objectContaining({
          format: "graph-atlas-cloud-snapshot",
          summary: expect.objectContaining({
            entityCount: 13,
            relationshipCount: 20,
          }),
        }),
      }),
    ]),
  );
});

test("previews full remote snapshot differences without changing local data", async ({ page }) => {
  const remoteStore = {
    ...seedKnowledgeStore,
    entities: [
      ...seedKnowledgeStore.entities.map((entity) =>
        entity.id === "passport"
          ? {
              ...entity,
              updatedAt: "2026-07-01T03:00:00.000Z",
            }
          : entity,
      ),
      {
        ...seedKnowledgeStore.entities[0],
        id: "remote-insurance",
        title: "远端保险资料",
        updatedAt: "2026-07-01T04:00:00.000Z",
      },
    ],
  };

  await page.route("**/mock-cloud-sync-diff/**", async (route) => {
    const url = route.request().url();

    if (url.endsWith("/snapshots/latest")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          snapshotId: "cloud-snapshot-diff",
          updatedAt: "2026-07-01T04:30:00.000Z",
          store: remoteStore,
        }),
      });
      return;
    }

    await route.fulfill({ status: 404, body: "{}" });
  });

  await page.getByRole("button", { name: "设置" }).click();

  const settingsView = page.locator(".settings-view");
  const materialMetric = settingsView.locator(".settings-metrics > div").filter({ hasText: "资料" });

  await settingsView.getByLabel("云同步 endpoint").fill("/mock-cloud-sync-diff");
  await settingsView.getByRole("button", { name: "保存云同步配置" }).click();
  await settingsView.getByRole("button", { name: "检查远端快照" }).click();

  const snapshotPreview = settingsView.getByLabel("远端快照预览");
  await expect(snapshotPreview.getByText("cloud-snapshot-diff")).toBeVisible();
  await expect(snapshotPreview.getByText("本地 13 份资料 · 远端 14 份资料")).toBeVisible();
  await expect(snapshotPreview.getByText("远端新增：远端保险资料")).toBeVisible();
  await expect(snapshotPreview.getByText("可能冲突：护照")).toBeVisible();
  await expect(snapshotPreview.getByText("发现远端差异；当前只预览，不会自动合并或覆盖。"))
    .toBeVisible();
  await expect(materialMetric.getByText("13")).toBeVisible();
});

test("flags incompatible remote cloud snapshots as preview-only risks", async ({ page }) => {
  await page.route("**/mock-cloud-sync-incompatible/**", async (route) => {
    const url = route.request().url();

    if (url.endsWith("/snapshots/latest")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          snapshotId: "cloud-snapshot-incompatible",
          updatedAt: "2026-07-01T05:00:00.000Z",
          store: {
            ...seedKnowledgeStore,
            version: "future-store",
          },
        }),
      });
      return;
    }

    await route.fulfill({ status: 404, body: "{}" });
  });

  await page.getByRole("button", { name: "设置" }).click();

  const settingsView = page.locator(".settings-view");

  await settingsView.getByLabel("云同步 endpoint").fill("/mock-cloud-sync-incompatible");
  await settingsView.getByRole("button", { name: "保存云同步配置" }).click();
  await settingsView.getByRole("button", { name: "检查远端快照" }).click();

  await expect(settingsView.getByText("远端快照需检查，当前不会覆盖本地资料库。"))
    .toBeVisible();
  const snapshotPreview = settingsView.getByLabel("远端快照预览");
  await expect(snapshotPreview.getByText("cloud-snapshot-incompatible")).toBeVisible();
  await expect(snapshotPreview.getByText(/远端快照需检查/)).toBeVisible();
  await expect(settingsView.getByText("连接失败 · 手动快照客户端，不自动上传或合并"))
    .toBeVisible();
  await expect(settingsView.getByRole("button", { name: /恢复远端/ })).toHaveCount(0);
});

test("manages local relationship templates and uses them in relationship forms", async ({
  page,
}) => {
  await page.getByRole("button", { name: "设置" }).click();
  const settingsView = page.locator(".settings-view");

  await expect(settingsView.getByRole("heading", { name: "关系模板" })).toBeVisible();
  await expect(settingsView.getByText("15 个模板词")).toBeVisible();
  await settingsView.getByLabel("新增关系模板").fill("复诊资料");
  await settingsView.getByRole("button", { name: "保存模板" }).click();
  await expect(settingsView.getByText("关系模板已新增：复诊资料。")).toBeVisible();
  await expect(settingsView.getByText("16 个模板词")).toBeVisible();

  let relationshipBlock = await openTravelRelationshipForm(page);
  await expect(
    relationshipBlock.locator('datalist#relationship-type-options option[value="复诊资料"]'),
  ).toHaveCount(1);
  await relationshipBlock.getByLabel("目标资料").selectOption({ label: "证书附件" });
  await relationshipBlock.getByLabel("关系类型").fill("复诊资料");
  await relationshipBlock.getByLabel("来源说明").fill("本地关系模板验证");
  await relationshipBlock.getByRole("button", { name: "保存关系" }).click();
  await expect(relationshipBlock.getByText("关系已保存：旅行清单 → 证书附件 · 复诊资料。"))
    .toBeVisible();

  await page.getByPlaceholder("搜索护照、签证、附件、联系人").fill("复诊资料");
  await expect(
    page
      .getByRole("region", { name: "搜索结果" })
      .getByRole("button", { name: /旅行清单 -> 证书附件.*复诊资料/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "设置" }).click();
  await settingsView.getByRole("button", { name: "移除关系模板 提交材料" }).click();
  await expect(settingsView.getByText("关系模板已移除：提交材料。")).toBeVisible();
  await expect(settingsView.getByText("15 个模板词")).toBeVisible();

  relationshipBlock = await openTravelRelationshipForm(page);
  await expect(
    relationshipBlock.locator('datalist#relationship-type-options option[value="提交材料"]'),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "设置" }).click();
  await settingsView.getByRole("button", { name: "恢复默认模板" }).click();
  await expect(settingsView.getByText("默认关系模板已恢复。")).toBeVisible();
  await expect(settingsView.getByText("15 个模板词")).toBeVisible();

  relationshipBlock = await openTravelRelationshipForm(page);
  await expect(
    relationshipBlock.locator('datalist#relationship-type-options option[value="保管位置"]'),
  ).toHaveCount(1);
});

test("edits and confirms a tag suggestion from the travel detail view", async ({ page }) => {
  const detailPanel = await openTravelDetail(page);
  const tagBlock = infoBlock(detailPanel, "标签");
  const suggestion = tagBlock.locator("article").filter({ hasText: "证件" });

  await expect(suggestion).toHaveCount(1);
  await suggestion.getByRole("button", { name: "修改" }).click();
  await suggestion.getByLabel("标签名称").fill("出行证件");
  await suggestion.getByRole("button", { name: "确认修改" }).click();

  await expect(tagBlock.getByText("标签建议已确认：出行证件。")).toBeVisible();
  await expect(tagChip(tagBlock, "出行证件")).toBeVisible();
  await expect(tagChip(tagBlock, "证件")).toHaveCount(0);
  await expect(tagBlock.locator("article").filter({ hasText: "证件" })).toHaveCount(0);
});

test("rejects a tag suggestion without adding the tag", async ({ page }) => {
  const detailPanel = await openTravelDetail(page);
  const tagBlock = infoBlock(detailPanel, "标签");
  const suggestion = tagBlock.locator("article").filter({ hasText: "住宿" });

  await expect(suggestion).toHaveCount(1);
  await suggestion.getByRole("button", { name: "拒绝" }).click();

  await expect(tagBlock.getByText("标签建议已拒绝：住宿。")).toBeVisible();
  await expect(tagChip(tagBlock, "住宿")).toHaveCount(0);
  await expect(tagBlock.locator("article").filter({ hasText: "住宿" })).toHaveCount(0);
});

test("edits and confirms a relationship suggestion from the travel detail view", async ({ page }) => {
  const detailPanel = await openTravelDetail(page);
  const relationshipSuggestionBlock = infoBlock(detailPanel, "关系建议");
  const suggestion = relationshipSuggestionBlock.locator("article").filter({ hasText: "联系人" });

  await expect(suggestion).toHaveCount(1);
  await suggestion.getByRole("button", { name: "修改" }).click();
  await suggestion.getByLabel("目标资料").selectOption({ label: "文件资料" });
  await suggestion.getByLabel("关系类型").selectOption({ label: "包含" });
  await suggestion.getByLabel("来源说明").fill("用户确认前改为文件资料关系");
  await suggestion.getByRole("button", { name: "确认修改" }).click();

  await expect(
    relationshipSuggestionBlock.getByText("关系建议已确认：旅行清单 → 文件资料 · 包含。"),
  ).toBeVisible();
  await expect(
    infoBlock(detailPanel, "关联笔记")
      .locator(".relationship-open")
      .filter({ hasText: "文件资料" })
      .filter({ hasText: "包含" })
      .filter({ hasText: "AI 建议确认" })
      .filter({ hasText: "来源说明：用户确认前改为文件资料关系" }),
  ).toBeVisible();
  await expect(relationshipSuggestionBlock.locator("article").filter({ hasText: "联系人" }))
    .toHaveCount(0);
});

test("rejects a relationship suggestion without adding a relationship", async ({ page }) => {
  const detailPanel = await openTravelDetail(page);
  const relationshipSuggestionBlock = infoBlock(detailPanel, "关系建议");
  const relationshipBlock = infoBlock(detailPanel, "关联笔记");
  const suggestion = relationshipSuggestionBlock.locator("article").filter({ hasText: "联系人" });

  await expect(suggestion).toHaveCount(1);
  await suggestion.getByRole("button", { name: "拒绝" }).click();

  await expect(
    relationshipSuggestionBlock.getByText("关系建议已拒绝：旅行清单 → 联系人 · 紧急联系人。"),
  ).toBeVisible();
  await expect(relationshipSuggestionBlock.locator("article").filter({ hasText: "联系人" }))
    .toHaveCount(0);
  await expect(
    relationshipBlock
      .locator(".relationship-open")
      .filter({ hasText: "联系人" })
      .filter({ hasText: "紧急联系人" })
      .filter({ hasText: "AI 建议确认" }),
  ).toHaveCount(0);
});

test("edits and confirms a summary suggestion from the travel detail view", async ({ page }) => {
  const detailPanel = await openTravelDetail(page);

  await detailPanel.getByRole("button", { name: "属性" }).click();

  const summaryBlock = infoBlock(detailPanel, "摘要建议");
  const suggestion = summaryBlock.locator("article").filter({
    hasText: "日本旅行计划；护照有效期检查",
  });

  await expect(suggestion).toHaveCount(1);
  await suggestion.getByRole("button", { name: "修改" }).click();
  await suggestion.getByLabel("摘要内容").fill("日本出行资料待检查");
  await suggestion.getByRole("button", { name: "确认修改" }).click();

  await expect(summaryBlock.getByText("摘要建议已确认：日本出行资料待检查。"))
    .toBeVisible();
  await expect(infoBlock(detailPanel, "Markdown 内容").locator("textarea")).toHaveValue(
    /- 摘要：日本出行资料待检查/,
  );
  await expect(summaryBlock.getByText("暂无摘要建议。")).toBeVisible();
});

test("rejects a summary suggestion without changing Markdown", async ({ page }) => {
  const detailPanel = await openTravelDetail(page);

  await detailPanel.getByRole("button", { name: "属性" }).click();

  const summaryBlock = infoBlock(detailPanel, "摘要建议");
  const markdownBlock = infoBlock(detailPanel, "Markdown 内容");
  const suggestion = summaryBlock.locator("article").filter({
    hasText: "日本旅行计划；护照有效期检查",
  });

  await expect(suggestion).toHaveCount(1);
  await suggestion.getByRole("button", { name: "拒绝" }).click();

  await expect(summaryBlock.getByText("摘要建议已拒绝：日本旅行计划；护照有效期检查。"))
    .toBeVisible();
  await expect(summaryBlock.getByText("暂无摘要建议。")).toBeVisible();
  await expect(markdownBlock.locator("textarea")).not.toHaveValue(
    /- 摘要：日本旅行计划；护照有效期检查/,
  );
});

async function openTravelDetail(page) {
  const travelNode = page.getByRole("button", { name: /旅行清单，拖拽可调整图谱位置/ });
  if (await travelNode.count()) {
    await travelNode.click();
  } else {
    await page.getByRole("button", { name: "旅行清单" }).click();
  }

  const detailPanel = page.locator(".detail-panel");
  await expect(detailPanel.getByRole("heading", { name: "旅行清单" })).toBeVisible();

  return detailPanel;
}

async function openTravelRelationshipForm(page) {
  const detailPanel = await openTravelDetail(page);
  const relationshipBlock = infoBlock(detailPanel, "关联笔记");

  await relationshipBlock.getByRole("button", { name: "新增关系" }).click();

  return relationshipBlock;
}

function infoBlock(root, title) {
  return root.locator(".info-block").filter({ hasText: title });
}

function tagChip(root, tag) {
  return root.locator(".tag-chip").filter({ hasText: new RegExp(`^${tag}`) });
}
