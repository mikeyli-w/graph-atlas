const SUGGESTION_KIND = "relationship-suggestion";

export function selectRelationshipSuggestions(store, activeId) {
  const activeEntity = store.entities.find((entity) => entity.id === activeId);
  if (!activeEntity) return [];

  const activeDocument = store.documents.find((document) => document.entityId === activeId);
  if (!activeDocument?.body) return [];

  const hiddenSuggestionIds = new Set(
    store.auditLog
      .filter((entry) => entry.kind === SUGGESTION_KIND && ["confirmed", "rejected"].includes(entry.status))
      .map((entry) => entry.suggestionId),
  );

  return store.entities
    .filter((entity) => entity.id !== activeId)
    .filter((target) => mentionsTarget(activeDocument.body, target))
    .map((target) => createSuggestion(store, activeEntity, target, activeDocument))
    .filter((suggestion) => !hiddenSuggestionIds.has(suggestion.id))
    .filter((suggestion) => !hasDirectionalEdge(store, suggestion.fromId, suggestion.toId));
}

export function findRelationshipSuggestion(store, activeId, suggestionId) {
  return selectRelationshipSuggestions(store, activeId).find(
    (suggestion) => suggestion.id === suggestionId,
  );
}

function createSuggestion(store, from, to, document) {
  const relationType = inferRelationType(document.body, to);

  return {
    id: `suggestion-${from.id}-${relationType}-${to.id}`,
    fromId: from.id,
    fromTitle: from.title,
    toId: to.id,
    toTitle: to.title,
    relationType,
    reason: `正文提到「${to.title}」，建议建立关系。`,
    evidence: createEvidenceSnippet(document.body, to.title),
    sourceDocumentId: document.id,
    privacyImpact: summarizePrivacyImpact(from, to),
    alreadyConnected: hasDirectionalEdge(store, from.id, to.id),
  };
}

function mentionsTarget(body, target) {
  return [target.title, ...target.tags].some((term) => term && body.includes(term));
}

function inferRelationType(body, target) {
  if (target.type === "人脉" || target.tags.includes("联系人")) return "紧急联系人";
  if (body.includes("提醒") || target.tags.includes("提醒")) return "相关提醒";
  return "相关资料";
}

function createEvidenceSnippet(body, targetTitle) {
  const lines = body
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").replace(/^-\s*/, "").trim())
    .filter(Boolean);
  const matched = lines.find((line) => line.includes(targetTitle)) ||
    lines.find((line) => line.includes("联系人")) ||
    lines[0] ||
    "暂无证据片段";

  return matched.length <= 80 ? matched : `${matched.slice(0, 80)}...`;
}

function summarizePrivacyImpact(from, to) {
  if (from.privacyLevel === "high" || to.privacyLevel === "high") {
    return "包含高隐私资料，确认前请检查必要性";
  }
  if (from.privacyLevel === "medium" || to.privacyLevel === "medium") {
    return "包含中隐私资料，仅建立本地关系";
  }
  return "低隐私资料关系";
}

function hasDirectionalEdge(store, fromId, toId) {
  return store.edges.some((edge) => edge.fromId === fromId && edge.toId === toId);
}
