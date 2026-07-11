export const relationshipTemplateStorageKey = "graph-atlas-relationship-templates-v1";

export const defaultRelationshipTemplateTypes = [
  "关联证件",
  "用于登录",
  "计划使用",
  "相关证明",
  "证明材料",
  "相关笔记",
  "通讯录",
  "项目记录",
  "合同索引",
  "交付材料",
  "材料",
  "证书附件",
  "保管位置",
  "提交材料",
  "到期提醒",
];

export function normalizeRelationshipTemplate(value) {
  return String(value || "").trim();
}

export function validateRelationshipTemplate(value) {
  const normalized = normalizeRelationshipTemplate(value);
  if (!normalized) {
    throw new Error("关系模板不能为空。");
  }
  if (normalized.length > 20) {
    throw new Error("关系模板不能超过 20 个字符。");
  }

  return normalized;
}

export function dedupeRelationshipTemplates(values) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeRelationshipTemplate(value))
        .filter(Boolean),
    ),
  );
}

export function loadRelationshipTemplates(storage = getRelationshipTemplateStorage()) {
  if (!storage) return defaultRelationshipTemplateTypes;

  try {
    const payload = storage.getItem(relationshipTemplateStorageKey);
    if (!payload) return defaultRelationshipTemplateTypes;

    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed)) return defaultRelationshipTemplateTypes;

    const templates = dedupeRelationshipTemplates(parsed)
      .filter((value) => value.length <= 20);

    return templates.length ? templates : defaultRelationshipTemplateTypes;
  } catch {
    return defaultRelationshipTemplateTypes;
  }
}

export function saveRelationshipTemplates(templates, storage = getRelationshipTemplateStorage()) {
  if (!storage) return;

  storage.setItem(
    relationshipTemplateStorageKey,
    JSON.stringify(dedupeRelationshipTemplates(templates)),
  );
}

function getRelationshipTemplateStorage() {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}
