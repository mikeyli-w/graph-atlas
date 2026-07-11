export function selectOutgoingRelationships(store, entityId) {
  const entityById = createEntityMap(store);
  const sourceByEdgeId = createEdgeSourceMap(store);

  return store.edges
    .filter((edge) => edge.fromId === entityId)
    .map((edge) => {
      const target = entityById.get(edge.toId);
      const targetMissing = !target;
      const relationshipSource = sourceByEdgeId.get(edge.id) || createDerivedRelationshipSource(edge);
      const sourceKindLabel = getRelationshipSourceLabel(edge.source);
      const sourceObjectLabel = relationshipSource.label;
      const sourcePermission = getRelationshipSourcePermission(edge.source);
      const sourcePermissionLabel = sourcePermission.label;
      const sourceObjectStatusLabel = relationshipSource.derived ? "派生来源" : "来源对象";
      const sourceAuditLabel = `${sourceKindLabel} · ${sourcePermissionLabel}`;
      const sourceAuditRows = createSourceAuditRows({
        sourceKindLabel,
        sourceObjectStatusLabel,
        evidenceLabel: edge.evidence ? `来源说明：${edge.evidence}` : sourceObjectLabel,
        sourcePermissionLabel,
      });
      const sourceAuditDescription = createSourceAuditDescription({
        sourceKindLabel,
        sourceObjectLabel,
        sourceObjectStatusLabel,
        sourcePermissionLabel,
        evidence: edge.evidence,
      });
      const evidenceLabel = edge.evidence ? `来源说明：${edge.evidence}` : sourceObjectLabel;

      return {
        id: edge.id,
        fromId: edge.fromId,
        targetId: edge.toId,
        targetTitle: target?.title || "目标已缺失",
        relation: edge.label || edge.relationType,
        source: edge.source || "unknown",
        evidence: edge.evidence || "",
        evidenceLabel,
        sourceKindLabel,
        sourceObject: relationshipSource,
        sourceObjectLabel,
        sourceObjectStatusLabel,
        sourceAuditLabel,
        sourceAuditRows,
        sourceAuditDescription,
        sourcePermissionLabel,
        sourcePermissionLevel: sourcePermission.level,
        sourcePermissionActionLabel: sourcePermission.actionLabel,
        sourcePermissionReason: sourcePermission.reason,
        sourcePermissionSummary: `权限：${sourcePermission.actionLabel}`,
        canEdit: edge.source === "manual",
        canDelete: edge.source === "manual",
        targetMissing,
        statusLabel: targetMissing ? "需要检查" : "可跳转",
        statusDescription: targetMissing
          ? `目标 ${edge.toId} 不在当前资料库中，请补充资料或修复关系。`
          : "关系目标存在，可直接打开。",
      };
    });
}

function getRelationshipSourceLabel(source) {
  if (source === "manual") return "手动创建";
  if (source === "suggestion") return "AI 建议确认";
  if (source === "seed") return "示例关系";
  return "来源待确认";
}

export function selectRenderableEdges(store) {
  const entityById = createEntityMap(store);

  return store.edges
    .map((edge) => ({
      id: edge.id,
      from: entityById.get(edge.fromId),
      to: entityById.get(edge.toId),
      label: edge.label || edge.relationType,
    }))
    .filter((edge) => edge.from && edge.to);
}

function createEntityMap(store) {
  return new Map(store.entities.map((entity) => [entity.id, entity]));
}

function createEdgeSourceMap(store) {
  return new Map(
    store.sources
      .filter((source) => source.targetType === "edge" && source.targetId)
      .map((source) => [source.targetId, source]),
  );
}

function createDerivedRelationshipSource(edge) {
  return {
    id: `derived-source-${edge.id}`,
    targetType: "edge",
    targetId: edge.id,
    kind: edge.source || "unknown",
    label: createRelationshipSourceLabel(edge),
    evidence: edge.evidence || "",
    derived: true,
  };
}

function createRelationshipSourceLabel(edge) {
  if (edge.evidence) return `关系依据：${edge.evidence}`;
  if (edge.source === "manual") return "手动创建关系";
  if (edge.source === "suggestion") return "AI 建议确认关系";
  if (edge.source === "seed") return "示例关系来源";
  return "关系来源待确认";
}

function getRelationshipSourcePermission(source) {
  if (source === "manual") {
    return {
      level: "editable",
      label: "手动可编辑",
      actionLabel: "可编辑和移除",
      reason: "手动创建的关系由你维护，可编辑目标、类型和来源说明。",
    };
  }
  if (source === "suggestion") {
    return {
      level: "readonly",
      label: "AI 建议确认，只读",
      actionLabel: "只读，可新增手动关系补充",
      reason: "AI 建议确认后的关系保留原始依据，不直接编辑；需要修正时可新增手动关系补充。",
    };
  }
  if (source === "seed") {
    return {
      level: "readonly",
      label: "示例关系，只读",
      actionLabel: "只读，可新增手动关系补充",
      reason: "示例关系用于初始化知识库，不直接编辑；需要修正时可新增手动关系补充。",
    };
  }
  return {
    level: "readonly",
    label: "来源待确认，只读",
    actionLabel: "只读，可新增手动关系补充",
    reason: "这条关系的来源类型暂未识别，先保持只读；需要修正时可新增手动关系补充。",
  };
}

function createSourceAuditRows({
  sourceKindLabel,
  sourceObjectStatusLabel,
  evidenceLabel,
  sourcePermissionLabel,
}) {
  return [
    {
      id: "source",
      label: "来源",
      value: `${sourceKindLabel} · ${sourceObjectStatusLabel}`,
    },
    {
      id: "evidence",
      label: "依据",
      value: evidenceLabel,
    },
    {
      id: "permission",
      label: "权限",
      value: sourcePermissionLabel,
    },
  ];
}

function createSourceAuditDescription({
  sourceKindLabel,
  sourceObjectLabel,
  sourceObjectStatusLabel,
  sourcePermissionLabel,
  evidence,
}) {
  const evidenceText = evidence ? `来源说明：${evidence}` : sourceObjectLabel;
  return `${sourceKindLabel} · ${sourcePermissionLabel} · ${sourceObjectStatusLabel} · ${evidenceText}`;
}
