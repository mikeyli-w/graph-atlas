import { getDefaultAiAccess, normalizePrivacyLevel } from "../data/schema.js";

export function getPrivacyLabel(privacyLevel) {
  if (privacyLevel === "high") return "高（仅自己可见）";
  if (privacyLevel === "low") return "低（可导出）";
  return "中（本地保存）";
}

export function getAiVisibility(entity) {
  if (entity.aiAccess) {
    return {
      aiAccess: true,
      label: "AI 可见",
      description: "可进入 AI 预留上下文",
    };
  }

  return {
    aiAccess: false,
    label: "AI 不可见",
    description: getExcludedReason(entity.privacyLevel),
  };
}

export function updatePrivacyAccess(currentEntity, nextPrivacyValue) {
  const privacyLevel = normalizePrivacyLevel(nextPrivacyValue);

  if (privacyLevel === "high") {
    return {
      privacyLevel,
      aiAccess: false,
    };
  }

  if (currentEntity.privacyLevel === "high" && privacyLevel === "low") {
    return {
      privacyLevel,
      aiAccess: false,
    };
  }

  return {
    privacyLevel,
    aiAccess: getDefaultAiAccess(privacyLevel),
  };
}

export function selectAiContextEntities(store) {
  return store.entities.filter((entity) => entity.aiAccess && !isPrivacyExcluded(entity));
}

function isPrivacyExcluded(entity) {
  return entity.privacyLevel === "high" || entity.privacyLevel === "medium";
}

function getExcludedReason(privacyLevel) {
  if (privacyLevel === "high") return "高隐私资料默认不进入 AI";
  if (privacyLevel === "medium") return "中隐私资料默认不进入云端 AI";
  return "需要用户确认后才进入 AI";
}
