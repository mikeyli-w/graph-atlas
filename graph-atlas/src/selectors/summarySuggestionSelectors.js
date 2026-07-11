const SUGGESTION_KIND = "summary-suggestion";

export function selectSummarySuggestions(store, activeId) {
  const activeEntity = store.entities.find((entity) => entity.id === activeId);
  if (!activeEntity) return [];

  const activeDocument = store.documents.find((document) => document.entityId === activeId);
  if (!activeDocument?.body || hasSummaryLine(activeDocument.body)) return [];

  const summary = createSummary(activeDocument.body);
  if (!summary) return [];

  const suggestion = {
    id: `summary-suggestion-${activeEntity.id}`,
    entityId: activeEntity.id,
    entityTitle: activeEntity.title,
    summary,
    proposedBody: insertSummaryLine(activeDocument.body, summary),
    reason: "根据正文要点建议补充摘要。",
    evidence: createEvidenceSnippet(activeDocument.body),
    sourceDocumentId: activeDocument.id,
    privacyImpact: summarizePrivacyImpact(activeEntity),
  };
  const hiddenSuggestionIds = new Set(
    store.auditLog
      .filter((entry) => entry.kind === SUGGESTION_KIND && ["confirmed", "rejected"].includes(entry.status))
      .map((entry) => entry.suggestionId),
  );

  return hiddenSuggestionIds.has(suggestion.id) ? [] : [suggestion];
}

export function findSummarySuggestion(store, activeId, suggestionId) {
  return selectSummarySuggestions(store, activeId).find(
    (suggestion) => suggestion.id === suggestionId,
  );
}

function hasSummaryLine(body) {
  return body
    .split("\n")
    .map((line) => line.trim())
    .some((line) => /^-?\s*摘要[:：]/.test(line));
}

function createSummary(body) {
  const lines = createContentLines(body).filter((line) => !line.startsWith("摘要"));
  const summaryParts = lines.slice(0, 2).map((line) => line.replace(/[。；;,.，]+$/, ""));

  return summaryParts.join("；").slice(0, 80);
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

function createEvidenceSnippet(body) {
  const evidence = createContentLines(body).slice(0, 3).join(" / ");

  return evidence.length <= 120 ? evidence : `${evidence.slice(0, 120)}...`;
}

function createContentLines(body) {
  return body
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").replace(/^-\s*/, "").trim())
    .filter(Boolean);
}

function summarizePrivacyImpact(entity) {
  if (entity.privacyLevel === "high") {
    return "高隐私资料，仅在本地补充摘要";
  }
  if (entity.privacyLevel === "medium") {
    return "中隐私资料，仅在本地补充摘要";
  }
  return "低隐私资料摘要";
}
