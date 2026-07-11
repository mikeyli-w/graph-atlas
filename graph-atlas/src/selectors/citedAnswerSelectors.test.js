import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectCitedAnswerDraft } from "./citedAnswerSelectors.js";

describe("selectCitedAnswerDraft", () => {
  it("returns cited answer draft only from AI-allowed material with sources", () => {
    const draft = selectCitedAnswerDraft(seedKnowledgeStore, {
      query: "旅行",
    });

    expect(draft.status).toBe("ready");
    expect(draft.answerDraft).toBe("基于允许访问的资料，找到 1 条有来源依据。");
    expect(draft.citations).toEqual([
      expect.objectContaining({
        entityId: "travel",
        sourceId: "source-travel-manual",
        title: "旅行清单",
        sourceTitle: "手动创建",
        privacyState: "低（可导出）",
        relationshipPath: "护照 -> 旅行清单",
      }),
    ]);
  });

  it("does not use high privacy material even when it matches the query", () => {
    const draft = selectCitedAnswerDraft(seedKnowledgeStore, {
      query: "护照",
      candidateEntityIds: ["passport"],
    });

    expect(draft.status).toBe("no_evidence");
    expect(draft.answerDraft).toBe("知识库中没有可靠依据");
    expect(draft.citations).toEqual([]);
    expect(draft.excludedSummary).toEqual(
      expect.arrayContaining([{ reason: "高隐私资料默认不进入 AI", count: 1 }]),
    );
    expect(JSON.stringify(draft)).not.toContain("护照首页.jpg");
  });

  it("does not draft an answer when matching allowed material lacks a source", () => {
    const storeWithoutTravelSource = {
      ...seedKnowledgeStore,
      sources: seedKnowledgeStore.sources.filter((source) => source.targetId !== "travel"),
    };
    const draft = selectCitedAnswerDraft(storeWithoutTravelSource, {
      query: "旅行",
    });

    expect(draft).toEqual(
      expect.objectContaining({
        status: "no_evidence",
        answerDraft: "知识库中没有可靠依据",
        citations: [],
        suggestedActions: ["新增资料", "检查收集箱", "扩大搜索范围"],
      }),
    );
  });

  it("can reserve an answer interface for a candidate set", () => {
    const draft = selectCitedAnswerDraft(seedKnowledgeStore, {
      query: "工作",
      candidateEntityIds: ["work"],
    });

    expect(draft.status).toBe("ready");
    expect(draft.citations).toEqual([
      expect.objectContaining({
        entityId: "work",
        sourceId: "source-work-manual",
        relationshipPath: "护照 -> 工作经历",
      }),
    ]);
  });
});
