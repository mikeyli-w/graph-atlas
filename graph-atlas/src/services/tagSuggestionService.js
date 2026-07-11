import { findTagSuggestion } from "../selectors/tagSuggestionSelectors.js";

const SUGGESTION_KIND = "tag-suggestion";

export const tagSuggestionService = {
  confirm(store, activeId, suggestionId, input = {}) {
    const suggestion = findTagSuggestion(store, activeId, suggestionId);
    if (!suggestion) {
      throw new Error("标签建议不存在");
    }
    const tag = Object.prototype.hasOwnProperty.call(input, "tag")
      ? normalizeTagInput(input.tag)
      : suggestion.tag;

    if (!tag) {
      throw new Error("标签名称必填");
    }

    const updatedAt = new Date().toISOString();
    const confirmedSuggestion = {
      ...suggestion,
      tag,
    };

    return {
      store: {
        ...store,
        metadata: {
          ...store.metadata,
          updatedAt,
        },
        entities: store.entities.map((entity) =>
          entity.id === suggestion.entityId
            ? {
                ...entity,
                tags: entity.tags.includes(tag)
                  ? entity.tags
                  : [...entity.tags, tag],
                updated: "刚刚",
              }
            : entity,
        ),
        auditLog: [
          ...store.auditLog,
          createSuggestionAuditEntry(confirmedSuggestion, "confirmed", updatedAt),
        ],
        updatedAt,
      },
    };
  },

  reject(store, activeId, suggestionId) {
    const suggestion = findTagSuggestion(store, activeId, suggestionId);
    if (!suggestion) {
      throw new Error("标签建议不存在");
    }

    const updatedAt = new Date().toISOString();

    return {
      store: {
        ...store,
        metadata: {
          ...store.metadata,
          updatedAt,
        },
        auditLog: [
          ...store.auditLog,
          createSuggestionAuditEntry(suggestion, "rejected", updatedAt),
        ],
        updatedAt,
      },
    };
  },
};

function normalizeTagInput(value) {
  return String(value || "")
    .trim()
    .replace(/^#+/, "")
    .trim()
    .replace(/\s+/g, " ");
}

function createSuggestionAuditEntry(suggestion, status, createdAt) {
  return {
    id: `audit-${suggestion.id}-${status}-${Date.now()}`,
    kind: SUGGESTION_KIND,
    suggestionId: suggestion.id,
    status,
    entityId: suggestion.entityId,
    tag: suggestion.tag,
    sourceDocumentId: suggestion.sourceDocumentId,
    createdAt,
  };
}
