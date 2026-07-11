import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectSummarySuggestions } from "../selectors/summarySuggestionSelectors.js";
import { summarySuggestionService } from "./summarySuggestionService.js";

describe("summarySuggestionService", () => {
  it("confirms a summary suggestion into the document body", () => {
    const suggestion = selectSummarySuggestions(seedKnowledgeStore, "travel")[0];
    const result = summarySuggestionService.confirm(seedKnowledgeStore, "travel", suggestion.id);
    const updatedDocument = result.store.documents.find((document) => document.entityId === "travel");
    const updatedEntity = result.store.entities.find((entity) => entity.id === "travel");

    expect(updatedDocument.body).toContain("- 摘要：日本旅行计划；护照有效期检查");
    expect(updatedDocument.body).toContain("- 签证材料");
    expect(updatedDocument.updated).toBe("刚刚");
    expect(updatedEntity.updated).toBe("刚刚");
    expect(result.store.auditLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "summary-suggestion",
          suggestionId: suggestion.id,
          status: "confirmed",
          entityId: "travel",
          summary: "日本旅行计划；护照有效期检查",
        }),
      ]),
    );
    expect(selectSummarySuggestions(result.store, "travel")).toEqual([]);
  });

  it("confirms an edited summary suggestion into the document body", () => {
    const suggestion = selectSummarySuggestions(seedKnowledgeStore, "travel")[0];
    const result = summarySuggestionService.confirm(seedKnowledgeStore, "travel", suggestion.id, {
      summary: "摘要：日本出行资料待检查",
    });
    const updatedDocument = result.store.documents.find((document) => document.entityId === "travel");

    expect(updatedDocument.body).toContain("- 摘要：日本出行资料待检查");
    expect(updatedDocument.body).not.toContain("- 摘要：日本旅行计划；护照有效期检查");
    expect(result.store.auditLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "summary-suggestion",
          suggestionId: suggestion.id,
          status: "confirmed",
          entityId: "travel",
          summary: "日本出行资料待检查",
        }),
      ]),
    );
    expect(selectSummarySuggestions(result.store, "travel")).toEqual([]);
  });

  it("rejects a summary suggestion without changing the document body", () => {
    const suggestion = selectSummarySuggestions(seedKnowledgeStore, "travel")[0];
    const result = summarySuggestionService.reject(seedKnowledgeStore, "travel", suggestion.id);
    const originalDocument = seedKnowledgeStore.documents.find((document) => document.entityId === "travel");
    const updatedDocument = result.store.documents.find((document) => document.entityId === "travel");

    expect(updatedDocument.body).toBe(originalDocument.body);
    expect(result.store.auditLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "summary-suggestion",
          suggestionId: suggestion.id,
          status: "rejected",
          entityId: "travel",
        }),
      ]),
    );
    expect(selectSummarySuggestions(result.store, "travel")).toEqual([]);
  });

  it("throws when the summary suggestion is not pending", () => {
    expect(() =>
      summarySuggestionService.confirm(seedKnowledgeStore, "travel", "missing-suggestion"),
    ).toThrow("摘要建议不存在");
  });

  it("rejects an empty reviewed summary", () => {
    const suggestion = selectSummarySuggestions(seedKnowledgeStore, "travel")[0];

    expect(() =>
      summarySuggestionService.confirm(seedKnowledgeStore, "travel", suggestion.id, {
        summary: " 摘要： ",
      }),
    ).toThrow("摘要内容必填");
  });
});
