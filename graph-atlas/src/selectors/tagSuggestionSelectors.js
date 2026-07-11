const SUGGESTION_KIND = "tag-suggestion";

const TAG_RULES = [
  { tag: "出行", terms: ["旅行", "出行", "航班", "签证", "酒店"] },
  { tag: "证件", terms: ["护照", "身份证", "签证", "证件"] },
  { tag: "文件", terms: ["文件", "材料", "扫描", "证明", "附件", "pdf"] },
  { tag: "联系人", terms: ["联系人", "电话", "紧急联系人"] },
  { tag: "提醒", terms: ["提醒", "检查", "有效期"] },
  { tag: "住宿", terms: ["酒店", "入住", "订单"] },
];

export function selectTagSuggestions(store, activeId) {
  const activeEntity = store.entities.find((entity) => entity.id === activeId);
  if (!activeEntity) return [];

  const activeDocument = store.documents.find((document) => document.entityId === activeId);
  if (!activeDocument?.body) return [];

  const existingTags = new Set(activeEntity.tags);
  const hiddenSuggestionIds = new Set(
    store.auditLog
      .filter((entry) => entry.kind === SUGGESTION_KIND && ["confirmed", "rejected"].includes(entry.status))
      .map((entry) => entry.suggestionId),
  );

  return TAG_RULES.map((rule) => createSuggestion(activeEntity, activeDocument, rule))
    .filter(Boolean)
    .filter((suggestion) => !existingTags.has(suggestion.tag))
    .filter((suggestion) => !hiddenSuggestionIds.has(suggestion.id));
}

export function findTagSuggestion(store, activeId, suggestionId) {
  return selectTagSuggestions(store, activeId).find((suggestion) => suggestion.id === suggestionId);
}

function createSuggestion(entity, document, rule) {
  const matchedTerm = rule.terms.find((term) => includesTerm(document.body, term));
  if (!matchedTerm) return null;

  return {
    id: `tag-suggestion-${entity.id}-${rule.tag}`,
    entityId: entity.id,
    entityTitle: entity.title,
    tag: rule.tag,
    reason: `正文提到「${matchedTerm}」，建议添加标签「${rule.tag}」。`,
    evidence: createEvidenceSnippet(document.body, matchedTerm),
    sourceDocumentId: document.id,
    privacyImpact: summarizePrivacyImpact(entity),
  };
}

function includesTerm(body, term) {
  return body.toLowerCase().includes(term.toLowerCase());
}

function createEvidenceSnippet(body, term) {
  const lines = body
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").replace(/^-\s*/, "").trim())
    .filter(Boolean);
  const matched = lines.find((line) => includesTerm(line, term)) || lines[0] || "暂无证据片段";

  return matched.length <= 80 ? matched : `${matched.slice(0, 80)}...`;
}

function summarizePrivacyImpact(entity) {
  if (entity.privacyLevel === "high") {
    return "高隐私资料，仅在本地添加标签";
  }
  if (entity.privacyLevel === "medium") {
    return "中隐私资料，仅在本地添加标签";
  }
  return "低隐私资料标签";
}
