import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectSummarySuggestions } from "./summarySuggestionSelectors.js";

describe("selectSummarySuggestions", () => {
  it("suggests a local summary from document evidence", () => {
    const suggestions = selectSummarySuggestions(seedKnowledgeStore, "travel");

    expect(suggestions).toEqual([
      expect.objectContaining({
        id: "summary-suggestion-travel",
        entityId: "travel",
        summary: "日本旅行计划；护照有效期检查",
        proposedBody: expect.stringContaining("- 摘要：日本旅行计划；护照有效期检查"),
        evidence: "日本旅行计划 / 护照有效期检查 / 签证材料",
        sourceDocumentId: "doc-travel",
        privacyImpact: "低隐私资料摘要",
      }),
    ]);
  });

  it("does not suggest a summary when the document already has one", () => {
    const store = {
      ...seedKnowledgeStore,
      documents: seedKnowledgeStore.documents.map((document) =>
        document.entityId === "travel"
          ? {
              ...document,
              body: "# 日本旅行计划\n- 摘要：已有整理过的摘要\n- 护照有效期检查",
            }
          : document,
      ),
    };

    expect(selectSummarySuggestions(store, "travel")).toEqual([]);
  });

  it("hides rejected or confirmed summary suggestions from the queue", () => {
    const suggestion = selectSummarySuggestions(seedKnowledgeStore, "travel")[0];
    const storeWithRejectedSuggestion = {
      ...seedKnowledgeStore,
      auditLog: [
        {
          id: "audit-summary-reject",
          kind: "summary-suggestion",
          suggestionId: suggestion.id,
          status: "rejected",
        },
      ],
    };

    expect(selectSummarySuggestions(storeWithRejectedSuggestion, "travel")).toEqual([]);
  });
});
