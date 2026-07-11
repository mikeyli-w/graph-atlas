import { selectMaterialStatuses } from "../domain/materialStatus.js";
import { getAiVisibility, getPrivacyLabel } from "../domain/privacy.js";
import { selectOutgoingRelationships } from "../domain/relationships.js";

export function selectDetailViewModel(store, activeId) {
  const entity = store.entities.find((item) => item.id === activeId) || store.entities[0];
  const relationships = selectOutgoingRelationships(store, activeId);

  return {
    privacy: {
      level: entity.privacyLevel,
      label: getPrivacyLabel(entity.privacyLevel),
    },
    aiVisibility: getAiVisibility(entity),
    materialStatuses: selectMaterialStatuses(store, entity.id),
    attachments: selectAttachments(store, entity.id),
    sources: selectSources(store, entity.id),
    relationships,
    historyItems: selectHistoryItems(store, entity),
    missingRelationshipCount: relationships.filter((relationship) => relationship.targetMissing).length,
  };
}

function selectAttachments(store, entityId) {
  return store.attachments
    .filter((attachment) => attachment.entityId === entityId)
    .map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      size: attachment.size,
      date: attachment.date,
      reference: attachment.reference || "",
      localCopy: attachment.localCopy || null,
      localCopyLabel: formatLocalCopyLabel(attachment.localCopy),
      localCopyStatusLabel: formatLocalCopyStatusLabel(attachment.localCopy),
      localCopyActionLabel: formatLocalCopyActionLabel(attachment.localCopy, attachment.reference),
    }));
}

function formatLocalCopyLabel(localCopy) {
  if (!localCopy) return "";
  if (localCopy.copyStatus === "skipped-too-large") {
    return `文件超过 ${formatByteLimit(localCopy.copyLimitBytes)}，未保存本地副本`;
  }
  if (!localCopy.contentHash) return "";

  if (localCopy.contentEncoding === "indexeddb") {
    return `本地副本已保存到 IndexedDB · ${localCopy.contentHash}`;
  }
  if (localCopy.contentEncoding === "file-system") {
    return `本地副本已保存到本地附件目录 · ${localCopy.contentHash}`;
  }
  if (localCopy.contentEncoding === "remote") {
    return `完整副本已保存到后端附件存储 · ${localCopy.contentHash}`;
  }

  return `${localCopy.contentBase64 ? "本地副本已保存" : "本地副本已索引"} · ${localCopy.contentHash}`;
}

function formatLocalCopyStatusLabel(localCopy) {
  if (!localCopy) return "";
  if (localCopy.copyStatus === "skipped-too-large") {
    return "未保存完整副本 / 需要外部存储";
  }
  if (localCopy.contentEncoding === "indexeddb") return "完整副本已保存";
  if (localCopy.contentEncoding === "file-system") return "完整副本已保存";
  if (localCopy.contentEncoding === "remote") return "完整副本已保存";
  if (localCopy.contentBase64) return "完整副本已保存";
  if (localCopy.contentHash) return "已建立索引";

  return "";
}

function formatLocalCopyActionLabel(localCopy, reference) {
  if (!localCopy || localCopy.copyStatus !== "skipped-too-large") return "";

  return reference
    ? "已保留附件索引和本地引用；等待文件系统或后端存储 adapter 后再保存完整副本。"
    : "已保留附件索引；等待文件系统或后端存储 adapter 后再保存完整副本。";
}

function formatByteLimit(value) {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes <= 0) return "大小上限";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

function selectSources(store, entityId) {
  const sources = store.sources
    .filter((source) => source.targetType === "entity" && source.targetId === entityId)
    .map((source) => ({
      id: source.id,
      label: source.label || "手动创建",
      kind: source.kind || "manual",
      canEdit: source.kind === "manual" && Boolean(source.createdAt),
      canDelete: source.kind === "manual" && Boolean(source.createdAt),
    }));

  if (sources.length > 0) return sources;

  return [
    {
      id: `source-${entityId}-empty`,
      label: "暂无来源",
      kind: "empty",
      canEdit: false,
      canDelete: false,
    },
  ];
}

function selectHistoryItems(store, entity) {
  const document = store.documents.find((item) => item.entityId === entity.id);
  const auditItems = selectAuditHistoryItems(store, entity.id);
  const baseItems = [
    {
      id: `history-${entity.id}-entity-updated`,
      label: "资料更新",
      value: entity.updated || store.updatedAt || "未知时间",
      description: "基本信息、隐私、标签、附件、来源或关系变化会更新资料。",
    },
  ];

  if (document) {
    baseItems.push({
      id: `history-${document.id}-document-updated`,
      label: "内容更新",
      value: document.updated || entity.updated || store.updatedAt || "未知时间",
      description: document.title || "Markdown 内容",
    });
  }

  baseItems.push({
    id: `history-${entity.id}-created`,
    label: "创建资料",
    value: entity.created || "未知时间",
    description: "本地知识库资料创建记录。",
  });

  return [...auditItems, ...baseItems];
}

function selectAuditHistoryItems(store, entityId) {
  const entityById = new Map(store.entities.map((entity) => [entity.id, entity]));

  return (store.auditLog || [])
    .filter(
      (entry) =>
        entry.entityId === entityId ||
        entry.fromId === entityId ||
        entry.toId === entityId ||
        entry.previousToId === entityId,
    )
    .slice()
    .reverse()
    .map((entry, index) => ({
      id: entry.id || `history-audit-${index}`,
      label: formatAuditKind(entry.kind),
      value: formatAuditTime(entry.createdAt),
      description: formatAuditDescription(entry, entityById),
    }));
}

function formatAuditKind(kind) {
  if (kind === "tag-suggestion") return "标签建议";
  if (kind === "relationship-suggestion") return "关系建议";
  if (kind === "summary-suggestion") return "摘要建议";
  if (kind === "manual-relationship") return "手动关系";

  return "本地记录";
}

function formatAuditDescription(entry, entityById) {
  const status = entry.status === "confirmed" ? "已确认" : "已拒绝";

  if (entry.kind === "tag-suggestion") {
    return `${status}：${entry.tag || "标签建议"}`;
  }
  if (entry.kind === "relationship-suggestion") {
    const targetTitle = entityById.get(entry.toId)?.title || entry.toId || "目标资料";
    return `${status}：${entry.relationType || "关系建议"} · ${targetTitle}`;
  }
  if (entry.kind === "manual-relationship") {
    return formatManualRelationshipAuditDescription(entry, entityById);
  }
  if (entry.kind === "summary-suggestion") {
    return `${status}：${entry.summary || "摘要建议"}`;
  }

  return status;
}

function formatManualRelationshipAuditDescription(entry, entityById) {
  const targetTitle = entityById.get(entry.toId)?.title || entry.toId || "目标资料";
  const relationType = entry.relationType || "关系";
  const evidence = entry.evidence ? `；来源说明：${entry.evidence}` : "";

  if (entry.status === "created") {
    return `已新增：${relationType} · ${targetTitle}${evidence}`;
  }
  if (entry.status === "updated") {
    const previousTargetTitle =
      entityById.get(entry.previousToId)?.title || entry.previousToId || "原目标资料";
    const previousRelation = entry.previousRelationType || "原关系";

    return `已更新：${previousRelation} · ${previousTargetTitle} → ${relationType} · ${targetTitle}${evidence}`;
  }
  if (entry.status === "deleted") {
    return `已移除：${relationType} · ${targetTitle}${evidence}`;
  }

  return `已记录：${relationType} · ${targetTitle}${evidence}`;
}

function formatAuditTime(value) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) return value || "最近";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(/\//g, "-");
}
