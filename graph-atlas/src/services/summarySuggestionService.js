import { findSummarySuggestion } from "../selectors/summarySuggestionSelectors.js";

const SUGGESTION_KIND = "summary-suggestion";

export const summarySuggestionService = {
  confirm(store, activeId, suggestionId, input = {}) {
    const suggestion = findSummarySuggestion(store, activeId, suggestionId);
    if (!suggestion) {
      throw new Error("摘要建议不存在");
    }
    const summary = Object.prototype.hasOwnProperty.call(input, "summary")
      ? normalizeSummaryInput(input.summary)
      : suggestion.summary;
    if (!summary) {
      throw new Error("摘要内容必填");
    }

    const updatedAt = new Date().toISOString();
    const confirmedSuggestion = {
      ...suggestion,
      summary,
      proposedBody: insertSummaryLine(
        store.documents.find((document) => document.id === suggestion.sourceDocumentId)?.body || "",
        summary,
      ),
    };

    return {
      store: {
        ...store,
        metadata: {
          ...store.metadata,
          updatedAt,
        },
        documents: store.documents.map((document) =>
          document.id === suggestion.sourceDocumentId
            ? {
                ...document,
                body: confirmedSuggestion.proposedBody,
                updated: "刚刚",
              }
            : document,
        ),
        entities: store.entities.map((entity) =>
          entity.id === suggestion.entityId
            ? {
                ...entity,
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
    const suggestion = findSummarySuggestion(store, activeId, suggestionId);
    if (!suggestion) {
      throw new Error("摘要建议不存在");
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

function normalizeSummaryInput(value) {
  return String(value || "")
    .trim()
    .replace(/^[-\s]*摘要[:：]\s*/, "")
    .trim()
    .replace(/\s+/g, " ");
}

function insertSummaryLine(body, summary) {
  const lines = body.split("\n");
  const headingIndex = lines.findIndex((line) => /^#\s+/.test(line.trim()));
  const summaryLine = `- 摘要：${summary}`;

  if (headingIndex < 0) {
    return [summaryLine, ...lines].join("\n");
  }

  return [
    ...lines.slice(0, headingIndex + 1),
    summaryLine,
    ...lines.slice(headingIndex + 1),
  ].join("\n");
}

function createSuggestionAuditEntry(suggestion, status, createdAt) {
  return {
    id: `audit-${suggestion.id}-${status}-${Date.now()}`,
    kind: SUGGESTION_KIND,
    suggestionId: suggestion.id,
    status,
    entityId: suggestion.entityId,
    summary: suggestion.summary,
    sourceDocumentId: suggestion.sourceDocumentId,
    createdAt,
  };
}
