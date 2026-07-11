import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { knowledgeService } from "../services/knowledgeService.js";
import { selectSearchViewModel } from "./searchSelectors.js";

describe("selectSearchViewModel", () => {
  it("matches entity title, type, tags and document content", () => {
    const titleMatch = selectSearchViewModel(seedKnowledgeStore, {
      query: "护照",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });
    const contentMatch = selectSearchViewModel(seedKnowledgeStore, {
      query: "到期提醒",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });

    expect(titleMatch.entityResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "passport", title: "护照" }),
      ]),
    );
    expect(contentMatch.entityResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "idcard", matchReason: "内容命中" }),
      ]),
    );
  });

  it("finds attachments and makes their owning entity visible", () => {
    const store = {
      ...seedKnowledgeStore,
      attachments: seedKnowledgeStore.attachments.map((attachment) =>
        attachment.name === "签证记录.pdf"
          ? {
              ...attachment,
              reference: "/Users/me/Documents/visa-history.pdf",
            }
          : attachment,
      ),
    };
    const results = selectSearchViewModel(store, {
      query: "visa-history",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });

    expect(results.attachmentResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "签证记录.pdf",
          reference: "/Users/me/Documents/visa-history.pdf",
          entityId: "passport",
        }),
      ]),
    );
    expect(results.visibleEntityIds).toContain("passport");
  });

  it("finds attachments by local copy text preview", () => {
    const store = {
      ...seedKnowledgeStore,
      attachments: seedKnowledgeStore.attachments.map((attachment) =>
        attachment.name === "签证记录.pdf"
          ? {
              ...attachment,
              localCopy: {
                storageKey: "local-library://graph-atlas/attachments/visa-history.pdf",
                mimeType: "application/pdf",
                byteSize: 831488,
                contentHash: "djb2-visa2026",
                textPreview: "Schengen appointment receipt",
              },
            }
          : attachment,
      ),
    };
    const results = selectSearchViewModel(store, {
      query: "appointment receipt",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });

    expect(results.attachmentResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "签证记录.pdf",
          entityId: "passport",
        }),
      ]),
    );
  });

  it("finds relationships across connected entities", () => {
    const results = selectSearchViewModel(seedKnowledgeStore, {
      query: "旅行清单",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });

    expect(results.relationshipResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromId: "passport",
          toId: "travel",
          label: "计划使用",
        }),
      ]),
    );
    expect(results.visibleEntityIds).toEqual(
      expect.arrayContaining(["passport", "travel"]),
    );
  });

  it("finds source evidence", () => {
    const results = selectSearchViewModel(seedKnowledgeStore, {
      query: "手动创建",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });

    expect(results.sourceResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "passport",
          label: "手动创建",
        }),
      ]),
    );
  });

  it("finds relationship source object labels", () => {
    const result = knowledgeService.addRelationship(seedKnowledgeStore, "travel", {
      targetId: "files",
      relationType: "包含",
      evidence: "手动关系来源对象命中",
    });
    const results = selectSearchViewModel(result.store, {
      query: "关系来源对象命中",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });

    expect(results.relationshipResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.edgeId,
          fromTitle: "旅行清单",
          toTitle: "文件资料",
          sourceLabel: "关系依据：手动关系来源对象命中",
        }),
      ]),
    );
  });

  it("finds newly seeded vault materials by title, content and attachment name", () => {
    const titleResults = selectSearchViewModel(seedKnowledgeStore, {
      query: "项目记录",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });
    const attachmentResults = selectSearchViewModel(seedKnowledgeStore, {
      query: "证书附件清单",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });
    const contentResults = selectSearchViewModel(seedKnowledgeStore, {
      query: "合作合同",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });

    expect(titleResults.entityResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "project-records", title: "项目记录" }),
      ]),
    );
    expect(attachmentResults.attachmentResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "certificate-attachments",
          name: "证书附件清单.pdf",
        }),
      ]),
    );
    expect(contentResults.entityResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "contract-index", matchReason: "内容命中" }),
      ]),
    );
  });

  it("uses tag and privacy filters to decide visible graph nodes without a query", () => {
    const results = selectSearchViewModel(seedKnowledgeStore, {
      query: "",
      tagFilter: "旅行",
      privacyFilter: "low",
    });

    expect(results.hasActiveQuery).toBe(false);
    expect(results.entityResults).toHaveLength(0);
    expect(results.visibleEntityIds).toEqual(["travel"]);
  });

  it("applies tag filtering to attachment and source evidence results", () => {
    const attachmentResults = selectSearchViewModel(seedKnowledgeStore, {
      query: "资料",
      tagFilter: "附件",
      privacyFilter: "全部隐私",
    });
    const sourceResults = selectSearchViewModel(seedKnowledgeStore, {
      query: "手动创建",
      tagFilter: "护照",
      privacyFilter: "全部隐私",
    });

    expect(attachmentResults.attachmentResults).toEqual([
      expect.objectContaining({
        entityId: "files",
        name: "资料目录索引.xlsx",
      }),
    ]);
    expect(sourceResults.sourceResults).toEqual([
      expect.objectContaining({
        entityId: "passport",
        label: "手动创建",
      }),
    ]);
  });

  it("applies privacy filtering to search results", () => {
    const results = selectSearchViewModel(seedKnowledgeStore, {
      query: "护照",
      tagFilter: "全部",
      privacyFilter: "low",
    });

    expect(results.entityResults).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "passport" }),
      ]),
    );
    expect(results.attachmentResults).toHaveLength(0);
    expect(results.relationshipResults).toHaveLength(0);
  });

  it("reports an empty state for an active query with no results", () => {
    const results = selectSearchViewModel(seedKnowledgeStore, {
      query: "完全不存在的资料",
      tagFilter: "全部",
      privacyFilter: "全部隐私",
    });

    expect(results.hasNoResults).toBe(true);
    expect(results.totalResults).toBe(0);
  });
});
