export function selectMaterialStatuses(store, entityId) {
  const entity = store.entities.find((item) => item.id === entityId);
  if (!entity) return [];

  const attachmentCount = store.attachments.filter(
    (attachment) => attachment.entityId === entity.id,
  ).length;
  const statuses = [];

  if (entity.privacyLevel === "high" && !entity.aiAccess) {
    statuses.push(createStatus("ai-invisible"));
  }

  if (entity.lifecycleStatus === "pending") {
    statuses.push(createStatus("pending"));
  } else {
    statuses.push(createStatus("saved"));
  }

  if (attachmentCount === 0) {
    statuses.push(createStatus("missing-attachments"));
  }

  if (entity.needsReview || entity.tags.includes("计划")) {
    statuses.push(createStatus("needs-review"));
  }

  return statuses;
}

function createStatus(id) {
  const statusById = {
    "ai-invisible": {
      id: "ai-invisible",
      label: "AI 不可见",
      description: "不会进入 AI 上下文",
    },
    saved: {
      id: "saved",
      label: "已保存",
      description: "已进入本地资料库",
    },
    pending: {
      id: "pending",
      label: "待整理",
      description: "已收集，尚未确认入库",
    },
    "missing-attachments": {
      id: "missing-attachments",
      label: "缺附件",
      description: "缺少关键附件索引",
    },
    "needs-review": {
      id: "needs-review",
      label: "需检查",
      description: "可能过期、缺失或需要确认",
    },
  };

  return statusById[id];
}
