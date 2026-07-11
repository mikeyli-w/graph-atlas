import { getAiVisibility, getPrivacyLabel } from "../domain/privacy.js";

export function selectAiContextPreview(store, options = {}) {
  const candidateIds = Array.isArray(options.candidateEntityIds)
    ? new Set(options.candidateEntityIds)
    : null;
  const documentsByEntityId = new Map(
    store.documents.map((document) => [document.entityId, document]),
  );
  const sourcesByEntityId = new Map();

  for (const source of store.sources) {
    if (source.targetType !== "entity") continue;
    const current = sourcesByEntityId.get(source.targetId) || [];
    current.push(source);
    sourcesByEntityId.set(source.targetId, current);
  }

  const candidates = store.entities.filter(
    (entity) => !candidateIds || candidateIds.has(entity.id),
  );
  const includedEntities = [];
  const excludedReasons = new Map();

  for (const entity of candidates) {
    if (canEnterAiContext(entity)) {
      const document = documentsByEntityId.get(entity.id);
      const sources = sourcesByEntityId.get(entity.id) || [];
      includedEntities.push({
        id: entity.id,
        title: entity.title,
        type: entity.type,
        privacyLabel: getPrivacyLabel(entity.privacyLevel),
        aiLabel: getAiVisibility(entity).label,
        sourceLabel: sources[0]?.label || "暂无可靠来源",
        snippet: createSnippet(document?.body),
      });
      continue;
    }

    const reason = getExcludedReason(entity);
    excludedReasons.set(reason, (excludedReasons.get(reason) || 0) + 1);
  }

  const excludedSummary = Array.from(excludedReasons, ([reason, count]) => ({
    reason,
    count,
  }));
  const excludedCount = excludedSummary.reduce((total, item) => total + item.count, 0);

  return {
    totalCandidates: candidates.length,
    includedCount: includedEntities.length,
    excludedCount,
    hasUsableContext: includedEntities.length > 0,
    includedEntities,
    excludedSummary,
  };
}

function canEnterAiContext(entity) {
  return entity.aiAccess === true && entity.privacyLevel === "low";
}

function getExcludedReason(entity) {
  if (entity.privacyLevel === "high") return "高隐私资料默认不进入 AI";
  if (entity.privacyLevel === "medium") return "中隐私资料默认不进入云端 AI";
  return "需要用户确认后才进入 AI";
}

function createSnippet(body = "") {
  const firstLine = body
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").replace(/^-\s*/, "").trim())
    .find(Boolean);

  if (!firstLine) return "暂无可预览内容";
  if (firstLine.length <= 72) return firstLine;
  return `${firstLine.slice(0, 72)}...`;
}
