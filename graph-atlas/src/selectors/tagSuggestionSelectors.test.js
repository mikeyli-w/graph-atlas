import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectTagSuggestions } from "./tagSuggestionSelectors.js";

describe("selectTagSuggestions", () => {
  it("suggests pending tags from document evidence", () => {
    const suggestions = selectTagSuggestions(seedKnowledgeStore, "travel");

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "travel",
          tag: "证件",
          reason: "正文提到「护照」，建议添加标签「证件」。",
          sourceDocumentId: "doc-travel",
          privacyImpact: "低隐私资料标签",
        }),
        expect.objectContaining({
          entityId: "travel",
          tag: "住宿",
          evidence: "酒店与航班",
        }),
      ]),
    );
  });

  it("does not suggest tags already on the entity", () => {
    const store = {
      ...seedKnowledgeStore,
      entities: seedKnowledgeStore.entities.map((entity) =>
        entity.id === "travel" ? { ...entity, tags: [...entity.tags, "证件"] } : entity,
      ),
    };

    expect(selectTagSuggestions(store, "travel")).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tag: "证件",
        }),
      ]),
    );
  });

  it("hides rejected or confirmed tag suggestions from the queue", () => {
    const suggestion = selectTagSuggestions(seedKnowledgeStore, "travel").find(
      (item) => item.tag === "证件",
    );
    const storeWithRejectedSuggestion = {
      ...seedKnowledgeStore,
      auditLog: [
        {
          id: "audit-tag-reject",
          kind: "tag-suggestion",
          suggestionId: suggestion.id,
          status: "rejected",
        },
      ],
    };

    expect(selectTagSuggestions(storeWithRejectedSuggestion, "travel")).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: suggestion.id }),
      ]),
    );
  });
});
