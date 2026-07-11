import { describe, expect, it } from "vitest";

import { seedKnowledgeStore, selectLegacyNodes } from "../data/seedKnowledgeStore.js";
import { selectDetailViewModel } from "../selectors/detailSelectors.js";
import { selectSearchViewModel } from "../selectors/searchSelectors.js";
import { createKnowledgeStoreRepository } from "../repositories/knowledgeStoreRepository.js";
import { getReverseRelationshipType, knowledgeService } from "./knowledgeService.js";

describe("knowledgeService.addEntity", () => {
  it("rejects an empty title", () => {
    expect(() =>
      knowledgeService.addEntity(seedKnowledgeStore, {
        title: " ",
        type: "文件",
        privacy: "中（本地保存）",
      }),
    ).toThrow("标题必填");
  });

  it("creates high privacy material with AI access disabled", () => {
    const result = knowledgeService.addEntity(seedKnowledgeStore, {
      title: "新护照扫描件",
      type: "证件",
      privacy: "高（仅自己可见）",
      summary: "补充一份新扫描件",
      relatedEntityId: "passport",
    });
    const entity = result.store.entities.find((item) => item.id === result.entityId);

    expect(entity).toEqual(
      expect.objectContaining({
        title: "新护照扫描件",
        type: "证件",
        privacyLevel: "high",
        aiAccess: false,
        lifecycleStatus: "pending",
      }),
    );
  });

  it("adds material to the graph/list compatible view", () => {
    const result = knowledgeService.addEntity(seedKnowledgeStore, {
      title: "旅行保险单",
      type: "文件",
      privacy: "中（本地保存）",
      relatedEntityId: "travel",
      attachments: [
        {
          name: "保险单.pdf",
          size: "480 KB",
          date: "今天",
          reference: "/Users/me/Documents/policy.pdf",
        },
      ],
    });

    expect(selectLegacyNodes(result.store)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.entityId,
          title: "旅行保险单",
          type: "文件",
        }),
      ]),
    );
    expect(result.store.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromId: result.entityId,
          toId: "travel",
          relationType: "关联",
          label: "关联",
          source: "manual",
          evidence: "新增资料时关联当前资料",
        }),
      ]),
    );
    expect(selectDetailViewModel(result.store, result.entityId).relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: "travel",
          relation: "关联",
          canEdit: true,
          canDelete: true,
          evidenceLabel: "来源说明：新增资料时关联当前资料",
          sourceAuditLabel: "手动创建 · 手动可编辑",
        }),
      ]),
    );
    const searchViewModel = selectSearchViewModel(result.store, {
      query: "新增资料时关联当前资料",
    });

    expect(searchViewModel.relationshipResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromId: result.entityId,
          toId: "travel",
          label: "关联",
        }),
      ]),
    );
    expect(result.store.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: result.entityId,
          name: "保险单.pdf",
          reference: "/Users/me/Documents/policy.pdf",
        }),
      ]),
    );
  });

  it("can be saved and reloaded from the repository", () => {
    const storage = createMemoryStorage();
    const repository = createKnowledgeStoreRepository(storage);
    const result = knowledgeService.addEntity(seedKnowledgeStore, {
      title: "酒店订单",
      type: "文件",
      privacy: "低（可导出）",
    });

    repository.saveStore(result.store);

    expect(createKnowledgeStoreRepository(storage).loadStore().entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.entityId,
          title: "酒店订单",
          aiAccess: true,
          lifecycleStatus: "pending",
        }),
      ]),
    );
  });
});

describe("knowledgeService.resetToSeed", () => {
  it("restores example data as an isolated seed copy", () => {
    const reset = knowledgeService.resetToSeed();
    const originalTitle = seedKnowledgeStore.entities[0].title;

    reset.entities[0].title = "被本地编辑污染的标题";

    expect(reset).not.toBe(seedKnowledgeStore);
    expect(reset.entities).toHaveLength(seedKnowledgeStore.entities.length);
    expect(reset.documents).toHaveLength(seedKnowledgeStore.documents.length);
    expect(reset.attachments).toHaveLength(seedKnowledgeStore.attachments.length);
    expect(reset.sources).toHaveLength(seedKnowledgeStore.sources.length);
    expect(seedKnowledgeStore.entities[0].title).toBe(originalTitle);
    expect(knowledgeService.resetToSeed().entities[0].title).toBe(originalTitle);
  });
});

describe("knowledgeService.addEntityAttachment", () => {
  it("adds an attachment index to an existing entity and detail view", () => {
    const result = knowledgeService.addEntityAttachment(seedKnowledgeStore, "wechat", {
      name: "微信恢复码截图.png",
      size: "320 KB",
      date: "今天",
      reference: "/Users/me/Documents/wechat-recovery.png",
    });
    const attachment = selectDetailViewModel(result.store, "wechat").attachments.find(
      (item) => item.id === result.attachmentId,
    );

    expect(attachment).toEqual(
      expect.objectContaining({
        name: "微信恢复码截图.png",
        size: "320 KB",
        date: "今天",
        reference: "/Users/me/Documents/wechat-recovery.png",
      }),
    );
    expect(result.store.entities.find((entity) => entity.id === "wechat").updated).toBe("刚刚");
  });

  it("keeps the new attachment searchable by file name and reference", () => {
    const result = knowledgeService.addEntityAttachment(seedKnowledgeStore, "wechat", {
      name: "微信恢复码截图.png",
      reference: "/Users/me/Documents/wechat-recovery.png",
    });
    const byName = selectSearchViewModel(result.store, {
      query: "微信恢复码",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });
    const byReference = selectSearchViewModel(result.store, {
      query: "wechat-recovery",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });

    expect(byName.attachmentResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.attachmentId,
          entityId: "wechat",
          name: "微信恢复码截图.png",
        }),
      ]),
    );
    expect(byReference.attachmentResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.attachmentId,
          entityTitle: "微信账号",
        }),
      ]),
    );
  });

  it("rejects invalid attachment input without mutating the store", () => {
    expect(() =>
      knowledgeService.addEntityAttachment(seedKnowledgeStore, "missing", {
        name: "文件.pdf",
      }),
    ).toThrow("资料不存在");
    expect(() =>
      knowledgeService.addEntityAttachment(seedKnowledgeStore, "wechat", {
        name: " ",
      }),
    ).toThrow("附件名称必填");

    const result = knowledgeService.addEntityAttachment(seedKnowledgeStore, "wechat", {
      name: "微信恢复码截图.png",
    });

    expect(() =>
      knowledgeService.addEntityAttachment(result.store, "wechat", {
        name: "微信恢复码截图.png",
      }),
    ).toThrow("附件索引已存在");
  });

  it("edits and removes an attachment index while keeping search in sync", () => {
    const added = knowledgeService.addEntityAttachment(seedKnowledgeStore, "wechat", {
      name: "微信恢复码截图.png",
      reference: "/Users/me/Documents/wechat-recovery.png",
    });
    const updated = knowledgeService.updateEntityAttachment(added.store, added.attachmentId, {
      name: "微信账号恢复资料.png",
      size: "更新索引",
      date: "刚刚",
      reference: "/Users/me/Documents/wechat-recovery-updated.png",
    });
    const detailViewModel = selectDetailViewModel(updated, "wechat");
    const searchViewModel = selectSearchViewModel(updated, {
      query: "恢复资料",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });
    const removed = knowledgeService.deleteEntityAttachment(updated, added.attachmentId);

    expect(detailViewModel.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: added.attachmentId,
          name: "微信账号恢复资料.png",
          size: "更新索引",
          date: "刚刚",
          reference: "/Users/me/Documents/wechat-recovery-updated.png",
        }),
      ]),
    );
    expect(searchViewModel.attachmentResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: added.attachmentId,
          name: "微信账号恢复资料.png",
        }),
      ]),
    );
    expect(removed.attachments.some((attachment) => attachment.id === added.attachmentId)).toBe(false);
    expect(selectSearchViewModel(removed, {
      query: "恢复资料",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    }).attachmentResults).toHaveLength(0);
  });

  it("rejects invalid attachment edits and deletes", () => {
    const added = knowledgeService.addEntityAttachment(seedKnowledgeStore, "wechat", {
      name: "微信恢复码截图.png",
    });

    expect(() =>
      knowledgeService.updateEntityAttachment(seedKnowledgeStore, "missing-attachment", {
        name: "文件.pdf",
      }),
    ).toThrow("附件索引不存在");
    expect(() =>
      knowledgeService.updateEntityAttachment(added.store, added.attachmentId, {
        name: " ",
      }),
    ).toThrow("附件名称必填");
    expect(() =>
      knowledgeService.updateEntityAttachment(added.store, added.attachmentId, {
        name: "微信恢复码截图.png",
      }),
    ).not.toThrow();

    const duplicated = knowledgeService.addEntityAttachment(added.store, "wechat", {
      name: "微信登录截图.png",
    });
    expect(() =>
      knowledgeService.updateEntityAttachment(duplicated.store, duplicated.attachmentId, {
        name: "微信恢复码截图.png",
      }),
    ).toThrow("附件索引已存在");
    expect(() => knowledgeService.deleteEntityAttachment(seedKnowledgeStore, "missing-attachment"))
      .toThrow("附件索引不存在");
  });

  it("keeps attachment ids unique when indexes are added quickly", () => {
    const first = knowledgeService.addEntityAttachment(seedKnowledgeStore, "wechat", {
      name: "微信恢复码截图.png",
    });
    const second = knowledgeService.addEntityAttachment(first.store, "wechat", {
      name: "微信登录截图.png",
    });

    expect(second.attachmentId).not.toBe(first.attachmentId);
    expect(new Set(second.store.attachments.map((attachment) => attachment.id)).size)
      .toBe(second.store.attachments.length);
  });
});

describe("knowledgeService.addRelationship", () => {
  it("maps reciprocal relationship types with clearer reverse semantics", () => {
    expect(getReverseRelationshipType("包含")).toBe("属于");
    expect(getReverseRelationshipType("属于")).toBe("包含");
    expect(getReverseRelationshipType("证明")).toBe("被证明");
    expect(getReverseRelationshipType("被证明")).toBe("证明");
    expect(getReverseRelationshipType("使用")).toBe("被使用");
    expect(getReverseRelationshipType("被使用")).toBe("使用");
    expect(getReverseRelationshipType("提醒")).toBe("被提醒");
    expect(getReverseRelationshipType("被提醒")).toBe("提醒");
    expect(getReverseRelationshipType("归档")).toBe("被归档");
    expect(getReverseRelationshipType("被归档")).toBe("归档");
    expect(getReverseRelationshipType("依赖")).toBe("被依赖");
    expect(getReverseRelationshipType("被依赖")).toBe("依赖");
    expect(getReverseRelationshipType("联系人")).toBe("联系人");
    expect(getReverseRelationshipType("关联")).toBe("关联");
  });

  it("creates an ID-based manual edge that appears in the detail view", () => {
    const result = knowledgeService.addRelationship(seedKnowledgeStore, "travel", {
      targetId: "files",
      relationType: "包含",
      evidence: "旅行清单需要统一查看文件资料。",
    });
    const relationship = selectDetailViewModel(result.store, "travel").relationships.find(
      (item) => item.targetId === "files" && item.relation === "包含",
    );

    expect(result.store.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.edgeId,
          fromId: "travel",
          toId: "files",
          relationType: "包含",
          label: "包含",
          source: "manual",
          evidence: "旅行清单需要统一查看文件资料。",
        }),
      ]),
    );
    expect(result.store.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `source-${result.edgeId}-manual`,
          targetType: "edge",
          targetId: result.edgeId,
          kind: "manual",
          label: "关系依据：旅行清单需要统一查看文件资料。",
          evidence: "旅行清单需要统一查看文件资料。",
        }),
      ]),
    );
    expect(result.store.auditLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "manual-relationship",
          status: "created",
          edgeId: result.edgeId,
          fromId: "travel",
          toId: "files",
          relationType: "包含",
          evidence: "旅行清单需要统一查看文件资料。",
        }),
      ]),
    );
    expect(relationship).toEqual(
      expect.objectContaining({
        targetId: "files",
        targetTitle: "文件资料",
        relation: "包含",
        sourceObject: expect.objectContaining({
          targetType: "edge",
          targetId: result.edgeId,
          kind: "manual",
        }),
        sourcePermissionLabel: "手动可编辑",
        sourcePermissionLevel: "editable",
        sourcePermissionActionLabel: "可编辑和移除",
        sourcePermissionReason: "手动创建的关系由你维护，可编辑目标、类型和来源说明。",
        sourcePermissionSummary: "权限：可编辑和移除",
        sourceObjectStatusLabel: "来源对象",
        sourceAuditLabel: "手动创建 · 手动可编辑",
        sourceAuditRows: [
          {
            id: "source",
            label: "来源",
            value: "手动创建 · 来源对象",
          },
          {
            id: "evidence",
            label: "依据",
            value: "来源说明：旅行清单需要统一查看文件资料。",
          },
          {
            id: "permission",
            label: "权限",
            value: "手动可编辑",
          },
        ],
        sourceAuditDescription:
          "手动创建 · 手动可编辑 · 来源对象 · 来源说明：旅行清单需要统一查看文件资料。",
      }),
    );
  });

  it("keeps relationship navigation stable when the target title changes", () => {
    const result = knowledgeService.addRelationship(seedKnowledgeStore, "travel", {
      targetId: "files",
      relationType: "包含",
    });
    const renamed = {
      ...result.store,
      entities: result.store.entities.map((entity) =>
        entity.id === "files" ? { ...entity, title: "文件资料（新标题）" } : entity,
      ),
    };
    const relationship = selectDetailViewModel(renamed, "travel").relationships.find(
      (item) => item.id === result.edgeId,
    );

    expect(relationship).toEqual(
      expect.objectContaining({
        targetId: "files",
        targetTitle: "文件资料（新标题）",
        relation: "包含",
      }),
    );
  });

  it("rejects invalid manual relationship input", () => {
    expect(() =>
      knowledgeService.addRelationship(seedKnowledgeStore, "missing", {
        targetId: "files",
        relationType: "包含",
      }),
    ).toThrow("当前资料不存在");
    expect(() =>
      knowledgeService.addRelationship(seedKnowledgeStore, "travel", {
        targetId: "missing",
        relationType: "包含",
      }),
    ).toThrow("目标资料必填");
    expect(() =>
      knowledgeService.addRelationship(seedKnowledgeStore, "travel", {
        targetId: "travel",
        relationType: "关联",
      }),
    ).toThrow("不能关联到当前资料");
    expect(() =>
      knowledgeService.addRelationship(seedKnowledgeStore, "travel", {
        targetId: "files",
        relationType: " ",
      }),
    ).toThrow("关系类型必填");

    const result = knowledgeService.addRelationship(seedKnowledgeStore, "travel", {
      targetId: "files",
      relationType: "包含",
    });

    expect(() =>
      knowledgeService.addRelationship(result.store, "travel", {
        targetId: "files",
        relationType: "包含",
      }),
    ).toThrow("关系已存在");
  });

  it("makes the manual relationship searchable by target and relation type", () => {
    const result = knowledgeService.addRelationship(seedKnowledgeStore, "travel", {
      targetId: "files",
      relationType: "包含",
      evidence: "整理旅行资料时确认",
    });
    const byRelationType = selectSearchViewModel(result.store, {
      query: "包含",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });
    const byTarget = selectSearchViewModel(result.store, {
      query: "文件资料",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });

    expect(byRelationType.relationshipResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.edgeId,
          fromId: "travel",
          toId: "files",
          label: "包含",
        }),
      ]),
    );
    expect(byTarget.relationshipResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.edgeId,
          fromTitle: "旅行清单",
          toTitle: "文件资料",
        }),
      ]),
    );

    const byEvidence = selectSearchViewModel(result.store, {
      query: "整理旅行",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });
    expect(byEvidence.relationshipResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.edgeId,
        }),
      ]),
    );
  });

  it("creates reciprocal manual relationships atomically", () => {
    const result = knowledgeService.addRelationship(seedKnowledgeStore, "travel", {
      targetId: "contacts",
      relationType: "包含",
      evidence: "双向整理资料",
      reciprocal: true,
    });

    expect(result.edgeIds).toEqual([
      "edge-travel-包含-contacts",
      "edge-contacts-属于-travel",
    ]);
    expect(
      result.store.sources.filter(
        (source) => source.targetType === "edge" && result.edgeIds.includes(source.targetId),
      ),
    ).toHaveLength(2);
    expect(
      result.store.auditLog.filter(
        (entry) => entry.kind === "manual-relationship" && result.edgeIds.includes(entry.edgeId),
      ),
    ).toEqual([
      expect.objectContaining({
        status: "created",
        fromId: "travel",
        toId: "contacts",
        relationType: "包含",
      }),
      expect.objectContaining({
        status: "created",
        fromId: "contacts",
        toId: "travel",
        relationType: "属于",
      }),
    ]);
    expect(selectDetailViewModel(result.store, "travel").relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: "contacts",
          relation: "包含",
          evidenceLabel: "来源说明：双向整理资料",
          sourceKindLabel: "手动创建",
        }),
      ]),
    );
    expect(selectDetailViewModel(result.store, "contacts").relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: "travel",
          relation: "属于",
          evidenceLabel: "来源说明：双向整理资料",
          sourceKindLabel: "手动创建",
        }),
      ]),
    );
    expect(() =>
      knowledgeService.addRelationship(seedKnowledgeStore, "travel", {
        targetId: "files",
        relationType: "材料",
        reciprocal: true,
      }),
    ).toThrow("关系已存在");
  });

  it("creates reciprocal manual relationships with semantic reverse labels", () => {
    const result = knowledgeService.addRelationship(seedKnowledgeStore, "travel", {
      targetId: "files",
      relationType: "证明",
      evidence: "旅行材料可证明行程安排",
      reciprocal: true,
    });

    expect(result.edgeIds).toEqual([
      "edge-travel-证明-files",
      "edge-files-被证明-travel",
    ]);
    expect(selectDetailViewModel(result.store, "travel").relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: "files",
          relation: "证明",
          evidenceLabel: "来源说明：旅行材料可证明行程安排",
        }),
      ]),
    );
    expect(selectDetailViewModel(result.store, "files").relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: "travel",
          relation: "被证明",
          evidenceLabel: "来源说明：旅行材料可证明行程安排",
        }),
      ]),
    );
  });

  it("updates manual relationships while keeping ID-based targets", () => {
    const result = knowledgeService.addRelationship(seedKnowledgeStore, "travel", {
      targetId: "files",
      relationType: "依赖",
      evidence: "旧来源说明",
    });
    const updated = knowledgeService.updateRelationship(result.store, result.edgeId, {
      targetId: "contacts",
      relationType: "联系人",
      evidence: "紧急联系人来源说明",
    });
    const renamed = {
      ...updated.store,
      entities: updated.store.entities.map((entity) =>
        entity.id === "contacts" ? { ...entity, title: "紧急联系人" } : entity,
      ),
    };

    expect(updated.edgeId).toBe("edge-travel-联系人-contacts");
    expect(updated.store.auditLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "manual-relationship",
          status: "created",
          edgeId: result.edgeId,
          toId: "files",
          relationType: "依赖",
        }),
        expect.objectContaining({
          kind: "manual-relationship",
          status: "updated",
          edgeId: "edge-travel-联系人-contacts",
          fromId: "travel",
          toId: "contacts",
          relationType: "联系人",
          evidence: "紧急联系人来源说明",
          previousEdgeId: result.edgeId,
          previousToId: "files",
          previousRelationType: "依赖",
          previousEvidence: "旧来源说明",
        }),
      ]),
    );
    expect(
      updated.store.sources.some(
        (source) => source.targetType === "edge" && source.targetId === result.edgeId,
      ),
    ).toBe(false);
    expect(updated.store.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "source-edge-travel-联系人-contacts-manual",
          targetType: "edge",
          targetId: "edge-travel-联系人-contacts",
          label: "关系依据：紧急联系人来源说明",
        }),
      ]),
    );
    expect(selectDetailViewModel(renamed, "travel").relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "edge-travel-联系人-contacts",
          targetId: "contacts",
          targetTitle: "紧急联系人",
          relation: "联系人",
          evidenceLabel: "来源说明：紧急联系人来源说明",
          sourceKindLabel: "手动创建",
          canEdit: true,
        }),
      ]),
    );

    const byEvidence = selectSearchViewModel(updated.store, {
      query: "紧急联系人来源",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });
    expect(byEvidence.relationshipResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "edge-travel-联系人-contacts",
          fromTitle: "旅行清单",
          toTitle: "联系人",
        }),
      ]),
    );
  });

  it("rejects invalid manual relationship edits", () => {
    const result = knowledgeService.addRelationship(seedKnowledgeStore, "travel", {
      targetId: "files",
      relationType: "依赖",
    });

    expect(() =>
      knowledgeService.updateRelationship(seedKnowledgeStore, "edge-passport-属于-profile", {
        targetId: "files",
        relationType: "关联",
      }),
    ).toThrow("只能编辑手动创建的关系");
    expect(() =>
      knowledgeService.updateRelationship(result.store, result.edgeId, {
        targetId: "travel",
        relationType: "关联",
      }),
    ).toThrow("不能关联到当前资料");
    expect(() =>
      knowledgeService.updateRelationship(result.store, result.edgeId, {
        targetId: "contacts",
        relationType: "",
      }),
    ).toThrow("关系类型必填");
    expect(() =>
      knowledgeService.updateRelationship(result.store, result.edgeId, {
        targetId: "files",
        relationType: "材料",
      }),
    ).toThrow("关系已存在");
  });

  it("deletes manual relationships without allowing seed relationships to be removed", () => {
    const result = knowledgeService.addRelationship(seedKnowledgeStore, "travel", {
      targetId: "files",
      relationType: "包含",
    });
    const removed = knowledgeService.deleteRelationship(result.store, result.edgeId);

    expect(removed.edges.some((edge) => edge.id === result.edgeId)).toBe(false);
    expect(
      removed.sources.some(
        (source) => source.targetType === "edge" && source.targetId === result.edgeId,
      ),
    ).toBe(false);
    expect(removed.auditLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "manual-relationship",
          status: "created",
          edgeId: result.edgeId,
          fromId: "travel",
          toId: "files",
          relationType: "包含",
        }),
        expect.objectContaining({
          kind: "manual-relationship",
          status: "deleted",
          edgeId: result.edgeId,
          fromId: "travel",
          toId: "files",
          relationType: "包含",
        }),
      ]),
    );
    expect(selectDetailViewModel(removed, "travel").relationships).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.edgeId,
        }),
      ]),
    );
    expect(() => knowledgeService.deleteRelationship(seedKnowledgeStore, "missing-edge"))
      .toThrow("关系不存在");
    expect(() =>
      knowledgeService.deleteRelationship(seedKnowledgeStore, "edge-passport-属于-profile"),
    ).toThrow("只能删除手动创建的关系");
  });
});

describe("knowledgeService.addEntitySource", () => {
  it("adds a manual entity source that appears in detail and search", () => {
    const result = knowledgeService.addEntitySource(seedKnowledgeStore, "travel", {
      label: "来源：2026 日本旅行资料夹",
    });
    const detailViewModel = selectDetailViewModel(result.store, "travel");
    const searchViewModel = selectSearchViewModel(result.store, {
      query: "日本旅行资料夹",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });

    expect(result.store.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.sourceId,
          targetType: "entity",
          targetId: "travel",
          kind: "manual",
          label: "来源：2026 日本旅行资料夹",
        }),
      ]),
    );
    expect(result.store.entities.find((entity) => entity.id === "travel").updated).toBe("刚刚");
    expect(detailViewModel.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.sourceId,
          label: "来源：2026 日本旅行资料夹",
          kind: "manual",
          canEdit: true,
          canDelete: true,
        }),
      ]),
    );
    expect(searchViewModel.sourceResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.sourceId,
          entityId: "travel",
          label: "来源：2026 日本旅行资料夹",
        }),
      ]),
    );
  });

  it("rejects invalid manual entity source input", () => {
    expect(() =>
      knowledgeService.addEntitySource(seedKnowledgeStore, "missing", {
        label: "来源说明",
      }),
    ).toThrow("资料不存在");
    expect(() =>
      knowledgeService.addEntitySource(seedKnowledgeStore, "travel", {
        label: " ",
      }),
    ).toThrow("来源说明必填");
  });

  it("edits and removes only supplemental manual entity sources", () => {
    const added = knowledgeService.addEntitySource(seedKnowledgeStore, "travel", {
      label: "来源：旧资料夹",
    });
    const updated = knowledgeService.updateEntitySource(added.store, added.sourceId, {
      label: "来源：新资料夹",
    });
    const removed = knowledgeService.deleteEntitySource(updated, added.sourceId);

    expect(selectDetailViewModel(updated, "travel").sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: added.sourceId,
          label: "来源：新资料夹",
          canEdit: true,
          canDelete: true,
        }),
      ]),
    );
    expect(updated.entities.find((entity) => entity.id === "travel").updated).toBe("刚刚");
    expect(removed.sources.some((source) => source.id === added.sourceId)).toBe(false);
    expect(removed.entities.find((entity) => entity.id === "travel").updated).toBe("刚刚");
  });

  it("rejects invalid manual entity source edits and deletes", () => {
    expect(() =>
      knowledgeService.updateEntitySource(seedKnowledgeStore, "source-travel-manual", {
        label: "不应改默认来源",
      }),
    ).toThrow("只能编辑手动补充的来源");
    expect(() =>
      knowledgeService.updateEntitySource(seedKnowledgeStore, "missing-source", {
        label: "来源",
      }),
    ).toThrow("来源不存在");
    expect(() =>
      knowledgeService.deleteEntitySource(seedKnowledgeStore, "source-travel-manual"),
    ).toThrow("只能移除手动补充的来源");

    const added = knowledgeService.addEntitySource(seedKnowledgeStore, "travel", {
      label: "来源：旧资料夹",
    });
    expect(() =>
      knowledgeService.updateEntitySource(added.store, added.sourceId, {
        label: " ",
      }),
    ).toThrow("来源说明必填");
  });
});

describe("knowledgeService.updateEntity", () => {
  it("edits entity title and type while keeping search and legacy nodes in sync", () => {
    const result = knowledgeService.updateEntity(seedKnowledgeStore, "passport", {
      title: "护照资料",
      type: "旅行证件",
    });
    const passport = result.entities.find((entity) => entity.id === "passport");
    const document = result.documents.find((item) => item.entityId === "passport");
    const searchViewModel = selectSearchViewModel(result, {
      query: "护照资料",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });

    expect(passport).toEqual(
      expect.objectContaining({
        title: "护照资料",
        type: "旅行证件",
        updated: "刚刚",
      }),
    );
    expect(document).toEqual(
      expect.objectContaining({
        title: "护照资料 内容",
        updated: "刚刚",
      }),
    );
    expect(selectLegacyNodes(result)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "passport",
          title: "护照资料",
          type: "旅行证件",
        }),
      ]),
    );
    expect(searchViewModel.entityResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "passport",
          title: "护照资料",
          type: "旅行证件",
        }),
      ]),
    );
  });

  it("rejects invalid entity title or type edits", () => {
    expect(() =>
      knowledgeService.updateEntity(seedKnowledgeStore, "missing-node", {
        title: "资料",
      }),
    ).toThrow("节点不存在");
    expect(() =>
      knowledgeService.updateEntity(seedKnowledgeStore, "passport", {
        title: " ",
      }),
    ).toThrow("标题必填");
    expect(() =>
      knowledgeService.updateEntity(seedKnowledgeStore, "passport", {
        type: " ",
      }),
    ).toThrow("类型必填");
  });
});

describe("knowledgeService.updateEntityPosition", () => {
  it("updates a graph node position without changing content updated labels", () => {
    const result = knowledgeService.updateEntityPosition(seedKnowledgeStore, "passport", {
      x: 62.345,
      y: 28.111,
    });
    const passport = result.entities.find((entity) => entity.id === "passport");
    const originalPassport = seedKnowledgeStore.entities.find((entity) => entity.id === "passport");

    expect(passport).toEqual(
      expect.objectContaining({
        x: 62.35,
        y: 28.11,
        updated: originalPassport.updated,
      }),
    );
    expect(result.updatedAt).not.toBe(seedKnowledgeStore.updatedAt);
    expect(result.metadata.updatedAt).toBe(result.updatedAt);
  });

  it("keeps dragged positions inside the graph canvas bounds", () => {
    const result = knowledgeService.updateEntityPosition(seedKnowledgeStore, "passport", {
      x: -14,
      y: 128,
    });
    const passport = result.entities.find((entity) => entity.id === "passport");

    expect(passport).toEqual(expect.objectContaining({ x: 0, y: 100 }));
  });

  it("rejects invalid drag targets or coordinates", () => {
    expect(() =>
      knowledgeService.updateEntityPosition(seedKnowledgeStore, "missing-node", { x: 10, y: 20 }),
    ).toThrow("节点不存在");

    expect(() =>
      knowledgeService.updateEntityPosition(seedKnowledgeStore, "passport", { x: "left", y: 20 }),
    ).toThrow("节点坐标必须是数字");
  });
});

describe("knowledgeService.resetGraphLayout", () => {
  it("restores seed node positions without changing content updated labels", () => {
    const moved = knowledgeService.updateEntityPosition(seedKnowledgeStore, "passport", {
      x: 7,
      y: 93,
    });
    const result = knowledgeService.resetGraphLayout(moved);
    const passport = result.entities.find((entity) => entity.id === "passport");
    const seedPassport = seedKnowledgeStore.entities.find((entity) => entity.id === "passport");

    expect(passport).toEqual(
      expect.objectContaining({
        x: seedPassport.x,
        y: seedPassport.y,
        updated: seedPassport.updated,
      }),
    );
    expect(result.updatedAt).not.toBe(seedKnowledgeStore.updatedAt);
    expect(result.metadata.updatedAt).toBe(result.updatedAt);
  });

  it("keeps custom node positions when restoring the default layout", () => {
    const customEntity = {
      ...seedKnowledgeStore.entities[0],
      id: "custom-node",
      title: "自定义资料",
      x: 12,
      y: 88,
    };
    const store = {
      ...seedKnowledgeStore,
      entities: [...seedKnowledgeStore.entities, customEntity],
    };
    const result = knowledgeService.resetGraphLayout(store);
    const customNode = result.entities.find((entity) => entity.id === "custom-node");

    expect(customNode).toEqual(expect.objectContaining({ x: 12, y: 88 }));
  });
});

describe("knowledgeService graph layout snapshots", () => {
  it("saves the current graph layout as a version", () => {
    const moved = knowledgeService.updateEntityPosition(seedKnowledgeStore, "passport", {
      x: 62.345,
      y: 28.111,
    });
    const result = knowledgeService.saveGraphLayout(moved, {
      title: "旅行资料布局",
      note: "出行资料分组",
    });
    const snapshot = result.layoutSnapshots[0];

    expect(snapshot).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^layout-/),
        title: "旅行资料布局",
        note: "出行资料分组",
        createdAt: result.updatedAt,
      }),
    );
    expect(snapshot.positions).toEqual(
      expect.arrayContaining([
        {
          entityId: "passport",
          x: 62.35,
          y: 28.11,
        },
      ]),
    );
    expect(result.metadata.updatedAt).toBe(result.updatedAt);
  });

  it("updates saved graph layout titles and notes", () => {
    const saved = knowledgeService.saveGraphLayout(seedKnowledgeStore, {
      title: "旅行资料布局",
      note: "初始备注",
    });
    const result = knowledgeService.updateGraphLayoutSnapshot(
      saved,
      saved.layoutSnapshots[0].id,
      {
        title: "出行前布局",
        note: "按出境资料整理",
      },
    );

    expect(result.layoutSnapshots[0]).toEqual(
      expect.objectContaining({
        title: "出行前布局",
        note: "按出境资料整理",
      }),
    );
    expect(result.layoutSnapshots[0].positions).toEqual(saved.layoutSnapshots[0].positions);
    expect(result.metadata.updatedAt).toBe(result.updatedAt);
  });

  it("copies a saved graph layout as a new version", () => {
    const saved = knowledgeService.saveGraphLayout(seedKnowledgeStore, {
      title: "旅行资料布局",
      note: "出行资料分组",
    });
    const result = knowledgeService.copyGraphLayoutSnapshot(
      saved,
      saved.layoutSnapshots[0].id,
      { title: "旅行资料布局备份" },
    );

    expect(result.layoutSnapshots).toHaveLength(2);
    expect(result.layoutSnapshots[0]).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^layout-/),
        title: "旅行资料布局备份",
        note: "出行资料分组",
        createdAt: result.updatedAt,
      }),
    );
    expect(result.layoutSnapshots[0].id).not.toBe(saved.layoutSnapshots[0].id);
    expect(result.layoutSnapshots[0].positions).toEqual(saved.layoutSnapshots[0].positions);
    expect(result.metadata.updatedAt).toBe(result.updatedAt);
  });

  it("generates unique default titles when copying the same graph layout", () => {
    const saved = knowledgeService.saveGraphLayout(seedKnowledgeStore, {
      title: "旅行资料布局",
      note: "出行资料分组",
    });
    const firstCopy = knowledgeService.copyGraphLayoutSnapshot(
      saved,
      saved.layoutSnapshots[0].id,
    );
    const secondCopy = knowledgeService.copyGraphLayoutSnapshot(
      firstCopy,
      saved.layoutSnapshots[0].id,
    );

    expect(firstCopy.layoutSnapshots[0]).toEqual(
      expect.objectContaining({
        title: "旅行资料布局 副本",
        note: "出行资料分组",
      }),
    );
    expect(secondCopy.layoutSnapshots[0]).toEqual(
      expect.objectContaining({
        title: "旅行资料布局 副本 2",
        note: "出行资料分组",
      }),
    );
    expect(secondCopy.layoutSnapshots.map((snapshot) => snapshot.title)).toEqual([
      "旅行资料布局 副本 2",
      "旅行资料布局 副本",
      "旅行资料布局",
    ]);
  });

  it("applies a saved graph layout to matching nodes", () => {
    const moved = knowledgeService.updateEntityPosition(seedKnowledgeStore, "passport", {
      x: 62,
      y: 28,
    });
    const saved = knowledgeService.saveGraphLayout(moved, { title: "旅行资料布局" });
    const reset = knowledgeService.resetGraphLayout(saved);
    const result = knowledgeService.applyGraphLayout(reset, saved.layoutSnapshots[0].id);
    const passport = result.entities.find((entity) => entity.id === "passport");

    expect(passport).toEqual(expect.objectContaining({ x: 62, y: 28 }));
    expect(result.layoutSnapshots).toHaveLength(1);
    expect(result.metadata.updatedAt).toBe(result.updatedAt);
  });

  it("captures and restores graph positions for layout apply undo", () => {
    const beforeApply = knowledgeService.updateEntityPosition(seedKnowledgeStore, "passport", {
      x: 42.222,
      y: 33.333,
    });
    const undoPositions = knowledgeService.captureGraphLayoutPositions(beforeApply);
    const saved = knowledgeService.saveGraphLayout(
      knowledgeService.updateEntityPosition(seedKnowledgeStore, "passport", {
        x: 62,
        y: 28,
      }),
      { title: "旅行资料布局" },
    );
    const currentStore = {
      ...beforeApply,
      layoutSnapshots: saved.layoutSnapshots,
    };
    const applied = knowledgeService.applyGraphLayout(currentStore, saved.layoutSnapshots[0].id);
    const restored = knowledgeService.restoreGraphLayoutPositions(applied, undoPositions);
    const passport = restored.entities.find((entity) => entity.id === "passport");

    expect(undoPositions).toEqual(
      expect.arrayContaining([
        {
          entityId: "passport",
          x: 42.22,
          y: 33.33,
        },
      ]),
    );
    expect(passport).toEqual(expect.objectContaining({ x: 42.22, y: 33.33 }));
    expect(restored.layoutSnapshots).toEqual(applied.layoutSnapshots);
    expect(restored.metadata.updatedAt).toBe(restored.updatedAt);
  });

  it("deletes saved graph layouts and rejects missing versions", () => {
    const saved = knowledgeService.saveGraphLayout(seedKnowledgeStore, {});
    const result = knowledgeService.deleteGraphLayout(saved, saved.layoutSnapshots[0].id);

    expect(result.layoutSnapshots).toEqual([]);
    expect(() => knowledgeService.applyGraphLayout(result, "missing-layout")).toThrow(
      "布局版本不存在",
    );
    expect(() => knowledgeService.deleteGraphLayout(result, "missing-layout")).toThrow(
      "布局版本不存在",
    );
    expect(() =>
      knowledgeService.updateGraphLayoutSnapshot(result, "missing-layout", {
        title: "缺失布局",
      }),
    ).toThrow("布局版本不存在");
    expect(() => knowledgeService.copyGraphLayoutSnapshot(result, "missing-layout")).toThrow(
      "布局版本不存在",
    );
  });

  it("rejects blank saved graph layout titles", () => {
    const saved = knowledgeService.saveGraphLayout(seedKnowledgeStore, {});

    expect(() =>
      knowledgeService.updateGraphLayoutSnapshot(saved, saved.layoutSnapshots[0].id, {
        title: " ",
      }),
    ).toThrow("布局名称必填");
  });
});

describe("knowledgeService.addEntityTag", () => {
  it("adds a normalized tag to an entity and marks the entity updated", () => {
    const result = knowledgeService.addEntityTag(seedKnowledgeStore, "passport", " #签证 材料 ");
    const passport = result.entities.find((entity) => entity.id === "passport");

    expect(passport).toEqual(
      expect.objectContaining({
        tags: expect.arrayContaining(["签证 材料"]),
        updated: "刚刚",
      }),
    );
    expect(result.updatedAt).not.toBe(seedKnowledgeStore.updatedAt);
    expect(result.metadata.updatedAt).toBe(result.updatedAt);
    expect(selectLegacyNodes(result)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "passport",
          tags: expect.arrayContaining(["签证 材料"]),
        }),
      ]),
    );
  });

  it("rejects empty, duplicate or missing-node tags", () => {
    expect(() => knowledgeService.addEntityTag(seedKnowledgeStore, "passport", " # ")).toThrow(
      "标签必填",
    );
    expect(() => knowledgeService.addEntityTag(seedKnowledgeStore, "passport", "护照")).toThrow(
      "标签已存在",
    );
    expect(() => knowledgeService.addEntityTag(seedKnowledgeStore, "missing-node", "签证")).toThrow(
      "节点不存在",
    );
  });

  it("edits and removes entity tags while keeping search filters in sync", () => {
    const added = knowledgeService.addEntityTag(seedKnowledgeStore, "passport", " #签证 材料 ");
    const updated = knowledgeService.updateEntityTag(
      added,
      "passport",
      "签证 材料",
      "出行证件",
    );
    const removed = knowledgeService.deleteEntityTag(updated, "passport", "护照");

    expect(updated.entities.find((entity) => entity.id === "passport")).toEqual(
      expect.objectContaining({
        tags: expect.arrayContaining(["出行证件"]),
        updated: "刚刚",
      }),
    );
    expect(updated.entities.find((entity) => entity.id === "passport").tags).not.toContain(
      "签证 材料",
    );
    expect(selectSearchViewModel(updated, {
      query: "出行证件",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    }).entityResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "passport",
          title: "护照",
        }),
      ]),
    );
    expect(removed.entities.find((entity) => entity.id === "passport").tags).not.toContain("护照");
    expect(selectLegacyNodes(removed)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "passport",
          tags: expect.arrayContaining(["出行证件"]),
        }),
      ]),
    );
  });

  it("rejects invalid entity tag edits and deletes", () => {
    expect(() =>
      knowledgeService.updateEntityTag(seedKnowledgeStore, "missing-node", "护照", "出行证件"),
    ).toThrow("节点不存在");
    expect(() =>
      knowledgeService.updateEntityTag(seedKnowledgeStore, "passport", "missing-tag", "出行证件"),
    ).toThrow("标签不存在");
    expect(() =>
      knowledgeService.updateEntityTag(seedKnowledgeStore, "passport", "护照", " "),
    ).toThrow("标签必填");
    expect(() =>
      knowledgeService.updateEntityTag(seedKnowledgeStore, "passport", "护照", "证件"),
    ).toThrow("标签已存在");
    expect(() =>
      knowledgeService.deleteEntityTag(seedKnowledgeStore, "missing-node", "护照"),
    ).toThrow("节点不存在");
    expect(() =>
      knowledgeService.deleteEntityTag(seedKnowledgeStore, "passport", "missing-tag"),
    ).toThrow("标签不存在");

    const singleTagStore = {
      ...seedKnowledgeStore,
      entities: seedKnowledgeStore.entities.map((entity) =>
        entity.id === "passport" ? { ...entity, tags: ["护照"] } : entity,
      ),
    };

    expect(() => knowledgeService.deleteEntityTag(singleTagStore, "passport", "护照")).toThrow(
      "至少保留一个标签",
    );
  });
});

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}
