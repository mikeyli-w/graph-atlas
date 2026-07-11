import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectAiContextPreview } from "./aiContextSelectors.js";

describe("selectAiContextPreview", () => {
  it("includes only low privacy entities with AI access", () => {
    const preview = selectAiContextPreview(seedKnowledgeStore);

    expect(preview.includedEntities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "work",
          title: "工作经历",
          aiLabel: "AI 可见",
        }),
        expect.objectContaining({
          id: "travel",
          title: "旅行清单",
          aiLabel: "AI 可见",
        }),
      ]),
    );
    expect(preview.includedEntities).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "passport" }),
        expect.objectContaining({ id: "profile" }),
      ]),
    );
  });

  it("summarizes excluded material without exposing excluded titles or snippets", () => {
    const preview = selectAiContextPreview(seedKnowledgeStore);

    expect(preview.excludedSummary).toEqual(
      expect.arrayContaining([
        { reason: "高隐私资料默认不进入 AI", count: 2 },
        { reason: "中隐私资料默认不进入云端 AI", count: 9 },
      ]),
    );
    expect(JSON.stringify(preview.excludedSummary)).not.toContain("护照");
    expect(JSON.stringify(preview.excludedSummary)).not.toContain("身份证");
  });

  it("can preview the current search candidate set", () => {
    const preview = selectAiContextPreview(seedKnowledgeStore, {
      candidateEntityIds: ["passport", "travel"],
    });

    expect(preview.totalCandidates).toBe(2);
    expect(preview.includedEntities).toEqual([
      expect.objectContaining({ id: "travel" }),
    ]);
    expect(preview.excludedSummary).toEqual([
      { reason: "高隐私资料默认不进入 AI", count: 1 },
    ]);
  });

  it("shows when no candidate can enter AI context", () => {
    const preview = selectAiContextPreview(seedKnowledgeStore, {
      candidateEntityIds: ["passport"],
    });

    expect(preview.hasUsableContext).toBe(false);
    expect(preview.includedCount).toBe(0);
    expect(preview.excludedCount).toBe(1);
  });
});
