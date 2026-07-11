import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectRelationshipSuggestions } from "./relationshipSuggestionSelectors.js";

describe("selectRelationshipSuggestions", () => {
  it("suggests pending relationships from document evidence", () => {
    const suggestions = selectRelationshipSuggestions(seedKnowledgeStore, "travel");

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromId: "travel",
          toId: "contacts",
          relationType: "紧急联系人",
          reason: "正文提到「联系人」，建议建立关系。",
          sourceDocumentId: "doc-travel",
        }),
      ]),
    );
  });

  it("does not suggest a relationship that already exists in the same direction", () => {
    const suggestions = selectRelationshipSuggestions(seedKnowledgeStore, "passport");

    expect(suggestions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromId: "passport",
          toId: "contacts",
        }),
      ]),
    );
  });

  it("hides rejected or confirmed suggestions from the queue", () => {
    const suggestion = selectRelationshipSuggestions(seedKnowledgeStore, "travel").find(
      (item) => item.toId === "contacts",
    );
    const storeWithRejectedSuggestion = {
      ...seedKnowledgeStore,
      auditLog: [
        {
          id: "audit-relationship-reject",
          kind: "relationship-suggestion",
          suggestionId: suggestion.id,
          status: "rejected",
        },
      ],
    };

    expect(selectRelationshipSuggestions(storeWithRejectedSuggestion, "travel")).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: suggestion.id }),
      ]),
    );
  });
});
