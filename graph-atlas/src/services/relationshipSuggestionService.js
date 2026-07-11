import { createEdgeId } from "../data/schema.js";
import { findRelationshipSuggestion } from "../selectors/relationshipSuggestionSelectors.js";
import { createRelationshipSource } from "./knowledgeService.js";

const SUGGESTION_KIND = "relationship-suggestion";

export const relationshipSuggestionService = {
  confirm(store, activeId, suggestionId, input = {}) {
    const suggestion = findRelationshipSuggestion(store, activeId, suggestionId);
    if (!suggestion) {
      throw new Error("关系建议不存在");
    }
    const targetId = Object.prototype.hasOwnProperty.call(input, "targetId")
      ? input.targetId?.trim()
      : suggestion.toId;
    const targetEntity = store.entities.find((entity) => entity.id === targetId);
    const relationType = Object.prototype.hasOwnProperty.call(input, "relationType")
      ? input.relationType?.trim()
      : suggestion.relationType;
    const evidence = Object.prototype.hasOwnProperty.call(input, "evidence")
      ? input.evidence?.trim()
      : suggestion.evidence;

    if (!targetEntity) {
      throw new Error("目标资料必填");
    }
    if (suggestion.fromId === targetId) {
      throw new Error("不能关联到当前资料");
    }
    if (!relationType) {
      throw new Error("关系类型必填");
    }

    const updatedAt = new Date().toISOString();
    const edgeId = createEdgeId(suggestion.fromId, relationType, targetId);
    const edgeExists = store.edges.some((edge) => edge.id === edgeId);
    if (edgeExists) {
      throw new Error("关系已存在");
    }

    const confirmedSuggestion = {
      ...suggestion,
      toId: targetId,
      toTitle: targetEntity.title,
      relationType,
      evidence,
    };
    const edge = {
      id: edgeId,
      fromId: suggestion.fromId,
      toId: targetId,
      relationType,
      label: relationType,
      source: "suggestion",
      evidence,
    };
    const sourceExists = store.sources.some(
      (source) => source.targetType === "edge" && source.targetId === edgeId,
    );

    return {
      store: {
        ...store,
        metadata: {
          ...store.metadata,
          updatedAt,
        },
        edges: edgeExists ? store.edges : [...store.edges, edge],
        sources:
          sourceExists
            ? store.sources
            : [
                ...store.sources,
                createRelationshipSource({
                  edge,
                  sourceKind: "suggestion",
                  createdAt: updatedAt,
                }),
              ],
        auditLog: [
          ...store.auditLog,
          createSuggestionAuditEntry(confirmedSuggestion, "confirmed", updatedAt),
        ],
        updatedAt,
      },
    };
  },

  reject(store, activeId, suggestionId) {
    const suggestion = findRelationshipSuggestion(store, activeId, suggestionId);
    if (!suggestion) {
      throw new Error("关系建议不存在");
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

function createSuggestionAuditEntry(suggestion, status, createdAt) {
  return {
    id: `audit-${suggestion.id}-${status}-${Date.now()}`,
    kind: SUGGESTION_KIND,
    suggestionId: suggestion.id,
    status,
    fromId: suggestion.fromId,
    toId: suggestion.toId,
    relationType: suggestion.relationType,
    createdAt,
  };
}
