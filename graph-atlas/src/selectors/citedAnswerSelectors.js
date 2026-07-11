import { getPrivacyLabel } from "../domain/privacy.js";

const NO_EVIDENCE_MESSAGE = "知识库中没有可靠依据";

export function selectCitedAnswerDraft(store, options = {}) {
  const query = options.query?.trim() || "";
  const candidateIds = Array.isArray(options.candidateEntityIds)
    ? new Set(options.candidateEntityIds)
    : null;
  const entityById = new Map(store.entities.map((entity) => [entity.id, entity]));
  const documentsByEntityId = new Map(
    store.documents.map((document) => [document.entityId, document]),
  );
  const sourcesByEntityId = groupSourcesByEntityId(store);
  const attachmentsByEntityId = groupAttachmentsByEntityId(store);
  const excludedReasons = new Map();
  const citations = [];

  for (const entity of store.entities) {
    if (candidateIds && !candidateIds.has(entity.id)) continue;

    const document = documentsByEntityId.get(entity.id);
    const sources = sourcesByEntityId.get(entity.id) || [];
    const attachments = attachmentsByEntityId.get(entity.id) || [];
    const matches = !query || matchesQuery(entity, document, attachments, sources, query);

    if (!canUseForAnswer(entity)) {
      if (matches) {
        const reason = getExcludedReason(entity);
        excludedReasons.set(reason, (excludedReasons.get(reason) || 0) + 1);
      }
      continue;
    }

    if (sources.length === 0) continue;
    if (!matches) continue;

    citations.push({
      id: `citation-${entity.id}`,
      entityId: entity.id,
      documentId: document?.id || null,
      sourceId: sources[0].id,
      title: entity.title,
      sourceTitle: sources[0].label || "手动创建",
      snippet: createEvidenceSnippet(document?.body, attachments),
      privacyState: getPrivacyLabel(entity.privacyLevel),
      relationshipPath: selectRelationshipPath(store, entity.id, entityById),
    });
  }

  const excludedSummary = Array.from(excludedReasons, ([reason, count]) => ({
    reason,
    count,
  }));

  if (citations.length === 0) {
    return {
      query,
      status: "no_evidence",
      answerDraft: NO_EVIDENCE_MESSAGE,
      citations: [],
      excludedSummary,
      suggestedActions: ["新增资料", "检查收集箱", "扩大搜索范围"],
    };
  }

  return {
    query,
    status: "ready",
    answerDraft: `基于允许访问的资料，找到 ${citations.length} 条有来源依据。`,
    citations,
    excludedSummary,
    suggestedActions: [],
  };
}

function canUseForAnswer(entity) {
  return entity.aiAccess === true && entity.privacyLevel === "low";
}

function getExcludedReason(entity) {
  if (entity.privacyLevel === "high") return "高隐私资料默认不进入 AI";
  if (entity.privacyLevel === "medium") return "中隐私资料默认不进入云端 AI";
  return "需要用户确认后才进入 AI";
}

function groupSourcesByEntityId(store) {
  const sourcesByEntityId = new Map();

  for (const source of store.sources) {
    if (source.targetType !== "entity") continue;
    const current = sourcesByEntityId.get(source.targetId) || [];
    current.push(source);
    sourcesByEntityId.set(source.targetId, current);
  }

  return sourcesByEntityId;
}

function groupAttachmentsByEntityId(store) {
  const attachmentsByEntityId = new Map();

  for (const attachment of store.attachments) {
    const current = attachmentsByEntityId.get(attachment.entityId) || [];
    current.push(attachment);
    attachmentsByEntityId.set(attachment.entityId, current);
  }

  return attachmentsByEntityId;
}

function matchesQuery(entity, document, attachments = [], sources = [], query) {
  const normalized = query.toLowerCase();
  return [
    entity.title,
    entity.type,
    entity.tags.join(" "),
    document?.title,
    document?.body,
    attachments.map((attachment) => attachment.name).join(" "),
    sources.map((source) => source.label).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

function createEvidenceSnippet(body = "", attachments = []) {
  const attachmentNames = attachments.map((attachment) => attachment.name).join("、");
  if (attachmentNames) return attachmentNames;

  const firstLine = body
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").replace(/^-\s*/, "").trim())
    .find(Boolean);

  if (!firstLine) return "暂无证据片段";
  if (firstLine.length <= 90) return firstLine;
  return `${firstLine.slice(0, 90)}...`;
}

function selectRelationshipPath(store, entityId, entityById) {
  const edge = store.edges.find((item) => item.toId === entityId) ||
    store.edges.find((item) => item.fromId === entityId);
  if (!edge) return "暂无关系路径";

  const from = entityById.get(edge.fromId);
  const to = entityById.get(edge.toId);
  if (!from || !to) return "关系目标缺失";

  return `${from.title} -> ${to.title}`;
}
