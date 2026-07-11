import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectVaultTreeSummary, selectVaultTreeViewModel } from "./vaultTreeSelectors.js";

describe("selectVaultTreeViewModel", () => {
  it("marks sidebar entries that already have matching entities", () => {
    const viewModel = selectVaultTreeViewModel(seedKnowledgeStore);
    const personalGroup = viewModel.find((group) => group.label === "个人资料");

    expect(personalGroup.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "护照",
          entityId: "passport",
          available: true,
          statusLabel: "已入库",
        }),
      ]),
    );
  });

  it("marks all seeded sidebar entries as available", () => {
    const viewModel = selectVaultTreeViewModel(seedKnowledgeStore);
    const summary = selectVaultTreeSummary(seedKnowledgeStore);
    const missingEntries = viewModel.flatMap((group) =>
      group.children.filter((child) => !child.available),
    );

    expect(summary).toEqual({
      totalCount: 13,
      availableCount: 13,
      missingCount: 0,
      label: "13/13 已入库",
      status: "complete",
    });
    expect(missingEntries).toEqual([]);
    expect(viewModel.flatMap((group) => group.children)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "项目记录", entityId: "project-records" }),
        expect.objectContaining({ title: "合同索引", entityId: "contract-index" }),
        expect.objectContaining({ title: "紧急联系人", entityId: "emergency-contacts" }),
        expect.objectContaining({ title: "证书附件", entityId: "certificate-attachments" }),
      ]),
    );
  });

  it("marks missing entries as creatable drafts for older stores", () => {
    const store = {
      ...seedKnowledgeStore,
      entities: seedKnowledgeStore.entities.filter((entity) => entity.id !== "project-records"),
    };

    const viewModel = selectVaultTreeViewModel(store);
    const summary = selectVaultTreeSummary(store);
    const workGroup = viewModel.find((group) => group.label === "工作");

    expect(summary).toEqual({
      totalCount: 13,
      availableCount: 12,
      missingCount: 1,
      label: "12/13 已入库 · 1 个待创建",
      status: "incomplete",
    });
    expect(workGroup.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "项目记录",
          entityId: null,
          available: false,
          statusLabel: "待创建",
          statusDescription: "项目记录 还没有对应资料，可先放入收集箱",
        }),
      ]),
    );
  });
});
