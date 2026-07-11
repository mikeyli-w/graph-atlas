import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectDetailViewModel } from "./detailSelectors.js";

describe("selectDetailViewModel", () => {
  it("shows all default passport relationships from edges", () => {
    const store = {
      ...seedKnowledgeStore,
      attachments: seedKnowledgeStore.attachments.map((attachment) =>
        attachment.id === "att-passport-1"
          ? {
              ...attachment,
              reference: "/Users/me/Documents/passport-cover.jpg",
              localCopy: {
                storageKey: "local-library://graph-atlas/attachments/passport-cover.jpg",
                mimeType: "image/jpeg",
                byteSize: 1258291,
                contentHash: "djb2-abcdef12",
                contentEncoding: "base64",
                contentBase64: "/9j/",
                textPreview: "",
              },
            }
          : attachment,
      ),
    };
    const viewModel = selectDetailViewModel(store, "passport");

    expect(viewModel.privacy).toEqual({
      level: "high",
      label: "高（仅自己可见）",
    });
    expect(viewModel.aiVisibility).toEqual({
      aiAccess: false,
      label: "AI 不可见",
      description: "高隐私资料默认不进入 AI",
    });
    expect(viewModel.materialStatuses[0]).toEqual(
      expect.objectContaining({
        id: "ai-invisible",
        label: "AI 不可见",
      }),
    );
    expect(viewModel.attachments).toEqual([
      expect.objectContaining({
        name: "护照首页.jpg",
        size: "1.2 MB",
        reference: "/Users/me/Documents/passport-cover.jpg",
        localCopyLabel: "本地副本已保存 · djb2-abcdef12",
      }),
      expect.objectContaining({
        name: "签证记录.pdf",
        size: "812 KB",
      }),
    ]);
    expect(viewModel.sources).toEqual([
      expect.objectContaining({
        label: "手动创建",
        kind: "manual",
      }),
    ]);
    expect(viewModel.relationships).toHaveLength(10);
    expect(viewModel.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: "profile",
          targetTitle: "个人资料",
          relation: "属于",
          sourceObject: expect.objectContaining({
            targetType: "edge",
            targetId: "edge-passport-属于-profile",
            label: "示例关系来源",
            derived: true,
          }),
          sourcePermissionLabel: "示例关系，只读",
          sourcePermissionLevel: "readonly",
          sourcePermissionActionLabel: "只读，可新增手动关系补充",
          sourcePermissionReason: "示例关系用于初始化知识库，不直接编辑；需要修正时可新增手动关系补充。",
          sourcePermissionSummary: "权限：只读，可新增手动关系补充",
          sourceObjectStatusLabel: "派生来源",
          sourceAuditLabel: "示例关系 · 示例关系，只读",
          sourceAuditRows: [
            {
              id: "source",
              label: "来源",
              value: "示例关系 · 派生来源",
            },
            {
              id: "evidence",
              label: "依据",
              value: "示例关系来源",
            },
            {
              id: "permission",
              label: "权限",
              value: "示例关系，只读",
            },
          ],
          sourceAuditDescription: "示例关系 · 示例关系，只读 · 派生来源 · 示例关系来源",
        }),
        expect.objectContaining({
          targetId: "idcard",
          targetTitle: "身份证",
          relation: "关联证件",
        }),
        expect.objectContaining({
          targetId: "notes",
          targetTitle: "重要笔记",
          relation: "相关笔记",
        }),
        expect.objectContaining({
          targetId: "emergency-contacts",
          targetTitle: "紧急联系人",
          relation: "紧急联系人",
        }),
        expect.objectContaining({
          targetId: "certificate-attachments",
          targetTitle: "证书附件",
          relation: "证明材料",
        }),
      ]),
    );
  });

  it("keeps relationship navigation stable when a target title changes", () => {
    const renamedStore = {
      ...seedKnowledgeStore,
      entities: seedKnowledgeStore.entities.map((entity) =>
        entity.id === "profile" ? { ...entity, title: "新的个人资料标题" } : entity,
      ),
    };
    const viewModel = selectDetailViewModel(renamedStore, "passport");
    const relationship = viewModel.relationships.find((item) => item.targetId === "profile");

    expect(relationship).toEqual(
      expect.objectContaining({
        targetId: "profile",
        targetTitle: "新的个人资料标题",
        relation: "属于",
      }),
    );
  });

  it("shows seeded vault material details for the filled sidebar entries", () => {
    const projectView = selectDetailViewModel(seedKnowledgeStore, "project-records");
    const emergencyView = selectDetailViewModel(seedKnowledgeStore, "emergency-contacts");

    expect(projectView.attachments).toEqual([
      expect.objectContaining({ name: "项目记录索引.xlsx", size: "96 KB" }),
    ]);
    expect(projectView.sources).toEqual([
      expect.objectContaining({ label: "手动创建", kind: "manual" }),
    ]);
    expect(projectView.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: "files",
          targetTitle: "文件资料",
          relation: "交付材料",
        }),
      ]),
    );
    expect(emergencyView.attachments).toEqual([
      expect.objectContaining({ name: "紧急联系人卡片.pdf" }),
    ]);
  });

  it("derives real detail history from entity, document and audit log records", () => {
    const store = {
      ...seedKnowledgeStore,
      auditLog: [
        {
          id: "audit-travel-tag-confirmed",
          kind: "tag-suggestion",
          suggestionId: "tag-suggestion-travel-证件",
          status: "confirmed",
          entityId: "travel",
          tag: "证件",
          createdAt: "2026-06-25T09:15:00.000Z",
        },
        {
          id: "audit-travel-relationship-rejected",
          kind: "relationship-suggestion",
          suggestionId: "suggestion-travel-contacts",
          status: "rejected",
          fromId: "travel",
          toId: "contacts",
          relationType: "紧急联系人",
          createdAt: "2026-06-25T09:20:00.000Z",
        },
        {
          id: "audit-travel-manual-created",
          kind: "manual-relationship",
          status: "created",
          edgeId: "edge-travel-包含-files",
          fromId: "travel",
          toId: "files",
          relationType: "包含",
          evidence: "手动整理出行资料时确认",
          createdAt: "2026-06-25T09:25:00.000Z",
        },
        {
          id: "audit-travel-manual-updated",
          kind: "manual-relationship",
          status: "updated",
          edgeId: "edge-travel-联系人-contacts",
          fromId: "travel",
          toId: "contacts",
          relationType: "联系人",
          evidence: "紧急联系人来源说明",
          previousEdgeId: "edge-travel-包含-files",
          previousToId: "files",
          previousRelationType: "包含",
          previousEvidence: "手动整理出行资料时确认",
          createdAt: "2026-06-25T09:30:00.000Z",
        },
      ],
    };
    const viewModel = selectDetailViewModel(store, "travel");

    expect(viewModel.historyItems).toEqual([
      expect.objectContaining({
        id: "audit-travel-manual-updated",
        label: "手动关系",
        description:
          "已更新：包含 · 文件资料 → 联系人 · 联系人；来源说明：紧急联系人来源说明",
      }),
      expect.objectContaining({
        id: "audit-travel-manual-created",
        label: "手动关系",
        description: "已新增：包含 · 文件资料；来源说明：手动整理出行资料时确认",
      }),
      expect.objectContaining({
        id: "audit-travel-relationship-rejected",
        label: "关系建议",
        description: "已拒绝：紧急联系人 · 联系人",
      }),
      expect.objectContaining({
        id: "audit-travel-tag-confirmed",
        label: "标签建议",
        description: "已确认：证件",
      }),
      expect.objectContaining({
        id: "history-travel-entity-updated",
        label: "资料更新",
        value: "昨天 16:30",
      }),
      expect.objectContaining({
        label: "内容更新",
        description: "旅行清单 内容",
      }),
      expect.objectContaining({
        id: "history-travel-created",
        label: "创建资料",
        value: "2024-11-20",
      }),
    ]);
  });

  it("shows a local copy size limit hint when attachment content is too large", () => {
    const store = {
      ...seedKnowledgeStore,
      attachments: seedKnowledgeStore.attachments.map((attachment) =>
        attachment.id === "att-passport-1"
          ? {
              ...attachment,
              reference: "local-library://graph-atlas/attachments/passport-cover.jpg",
              localCopy: {
                storageKey: "local-library://graph-atlas/attachments/passport-cover.jpg",
                mimeType: "image/jpeg",
                byteSize: 262145,
                contentHash: "",
                contentEncoding: "",
                contentBase64: "",
                textPreview: "",
                copyStatus: "skipped-too-large",
                copyLimitBytes: 262144,
              },
            }
          : attachment,
      ),
    };
    const viewModel = selectDetailViewModel(store, "passport");

    expect(viewModel.attachments[0]).toEqual(
      expect.objectContaining({
        localCopyLabel: "文件超过 256 KB，未保存本地副本",
        localCopyStatusLabel: "未保存完整副本 / 需要外部存储",
        localCopyActionLabel:
          "已保留附件索引和本地引用；等待文件系统或后端存储 adapter 后再保存完整副本。",
      }),
    );
  });

  it("labels IndexedDB-backed local copies as saved", () => {
    const store = {
      ...seedKnowledgeStore,
      attachments: seedKnowledgeStore.attachments.map((attachment) =>
        attachment.id === "att-passport-1"
          ? {
              ...attachment,
              localCopy: {
                storageKey: "local-library://graph-atlas/attachments/passport-cover.jpg",
                mimeType: "image/jpeg",
                byteSize: 1258291,
                contentHash: "djb2-indexeddb",
                contentEncoding: "indexeddb",
                contentBase64: "",
                textPreview: "",
                copyStatus: "stored-indexeddb",
                copyLimitBytes: 5242880,
              },
            }
          : attachment,
      ),
    };
    const viewModel = selectDetailViewModel(store, "passport");

    expect(viewModel.attachments[0]).toEqual(
      expect.objectContaining({
        localCopyLabel: "本地副本已保存到 IndexedDB · djb2-indexeddb",
      }),
    );
  });

  it("labels file-system-backed local copies as saved in the local attachment directory", () => {
    const store = {
      ...seedKnowledgeStore,
      attachments: seedKnowledgeStore.attachments.map((attachment) =>
        attachment.id === "att-passport-1"
          ? {
              ...attachment,
              localCopy: {
                storageKey: "file-system://graph-atlas/attachments/djb2-local-passport.pdf",
                mimeType: "application/pdf",
                byteSize: 6000000,
                contentHash: "djb2-local12",
                contentEncoding: "file-system",
                contentBase64: "",
                textPreview: "local file system preview",
                copyStatus: "stored-file-system",
                copyLimitBytes: 0,
              },
            }
          : attachment,
      ),
    };
    const viewModel = selectDetailViewModel(store, "passport");

    expect(viewModel.attachments[0]).toEqual(
      expect.objectContaining({
        localCopyLabel: "本地副本已保存到本地附件目录 · djb2-local12",
        localCopyStatusLabel: "完整副本已保存",
      }),
    );
  });

  it("labels remote-backed local copies as saved in backend storage", () => {
    const store = {
      ...seedKnowledgeStore,
      attachments: seedKnowledgeStore.attachments.map((attachment) =>
        attachment.id === "att-passport-1"
          ? {
              ...attachment,
              localCopy: {
                storageKey: "remote://graph-atlas/attachments/passport.pdf",
                mimeType: "application/pdf",
                byteSize: 6000000,
                contentHash: "djb2-remote1",
                contentEncoding: "remote",
                contentBase64: "",
                textPreview: "remote preview",
                copyStatus: "stored-remote",
                copyLimitBytes: 0,
              },
            }
          : attachment,
      ),
    };
    const viewModel = selectDetailViewModel(store, "passport");

    expect(viewModel.attachments[0]).toEqual(
      expect.objectContaining({
        localCopyLabel: "完整副本已保存到后端附件存储 · djb2-remote1",
        localCopyStatusLabel: "完整副本已保存",
      }),
    );
  });

  it("shows an empty source state when provenance is missing", () => {
    const storeWithoutSources = {
      ...seedKnowledgeStore,
      sources: seedKnowledgeStore.sources.filter((source) => source.targetId !== "passport"),
    };
    const viewModel = selectDetailViewModel(storeWithoutSources, "passport");

    expect(viewModel.sources).toEqual([
      {
        id: "source-passport-empty",
        label: "暂无来源",
        kind: "empty",
        canEdit: false,
        canDelete: false,
      },
    ]);
  });

  it("marks relationships whose target entity is missing", () => {
    const storeWithMissingTarget = {
      ...seedKnowledgeStore,
      edges: [
        ...seedKnowledgeStore.edges,
        {
          id: "edge-passport-missing-target",
          fromId: "passport",
          toId: "missing-visa",
          relationType: "关联签证",
          label: "关联签证",
          source: "test",
        },
      ],
    };
    const viewModel = selectDetailViewModel(storeWithMissingTarget, "passport");

    expect(viewModel.missingRelationshipCount).toBe(1);
    expect(viewModel.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: "missing-visa",
          targetTitle: "目标已缺失",
          targetMissing: true,
          statusLabel: "需要检查",
          statusDescription: "目标 missing-visa 不在当前资料库中，请补充资料或修复关系。",
        }),
      ]),
    );
  });

  it("keeps unknown relationship sources readable and readonly", () => {
    const storeWithUnknownSource = {
      ...seedKnowledgeStore,
      edges: [
        ...seedKnowledgeStore.edges,
        {
          id: "edge-passport-legacy-sync-profile",
          fromId: "passport",
          toId: "profile",
          relationType: "同步关系",
          label: "同步关系",
          source: "legacy-sync",
        },
      ],
    };
    const viewModel = selectDetailViewModel(storeWithUnknownSource, "passport");

    expect(viewModel.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "edge-passport-legacy-sync-profile",
          targetId: "profile",
          targetTitle: "个人资料",
          relation: "同步关系",
          canEdit: false,
          canDelete: false,
          sourceKindLabel: "来源待确认",
          sourceObjectLabel: "关系来源待确认",
          sourcePermissionLabel: "来源待确认，只读",
          sourcePermissionLevel: "readonly",
          sourcePermissionActionLabel: "只读，可新增手动关系补充",
          sourcePermissionReason:
            "这条关系的来源类型暂未识别，先保持只读；需要修正时可新增手动关系补充。",
          sourceAuditLabel: "来源待确认 · 来源待确认，只读",
          sourceAuditDescription:
            "来源待确认 · 来源待确认，只读 · 派生来源 · 关系来源待确认",
        }),
      ]),
    );
  });
});
