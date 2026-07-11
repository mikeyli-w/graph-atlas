export const KNOWLEDGE_STORE_VERSION = "v1_knowledge_store";
export const SCHEMA_VERSION = 1;

export const privacyLevels = ["high", "medium", "low"];

export function normalizePrivacyLevel(value) {
  if (privacyLevels.includes(value)) return value;
  if (value === "高（仅自己可见）") return "high";
  if (value === "中（加密保存）" || value === "中（本地保存）") return "medium";
  if (value === "低（可导出）") return "low";
  return "medium";
}

export function getDefaultAiAccess(privacyLevel) {
  return privacyLevel === "low";
}

export function createEdgeId(fromId, relationType, toId) {
  return `edge-${fromId}-${slugify(relationType)}-${toId}`;
}

export function validateKnowledgeStore(store) {
  const errors = [];

  if (!store || typeof store !== "object") {
    return { valid: false, errors: ["Store must be an object."] };
  }

  if (store.version !== KNOWLEDGE_STORE_VERSION) {
    errors.push(`Expected version ${KNOWLEDGE_STORE_VERSION}.`);
  }

  if (!store.metadata || store.metadata.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`Expected metadata.schemaVersion ${SCHEMA_VERSION}.`);
  }

  for (const collectionName of [
    "entities",
    "edges",
    "documents",
    "attachments",
    "sources",
    "inbox",
    "auditLog",
  ]) {
    if (!Array.isArray(store[collectionName])) {
      errors.push(`${collectionName} must be an array.`);
    }
  }

  if ("layoutSnapshots" in store && !Array.isArray(store.layoutSnapshots)) {
    errors.push("layoutSnapshots must be an array.");
  }

  if (errors.length > 0) return { valid: false, errors };

  const entityIds = new Set();
  for (const entity of store.entities) {
    if (!entity.id) {
      errors.push("Entity is missing id.");
      continue;
    }
    if (entityIds.has(entity.id)) {
      errors.push(`Duplicate entity id: ${entity.id}.`);
    }
    entityIds.add(entity.id);

    if (!privacyLevels.includes(entity.privacyLevel)) {
      errors.push(`Entity ${entity.id} has invalid privacyLevel.`);
    }
    if (typeof entity.aiAccess !== "boolean") {
      errors.push(`Entity ${entity.id} is missing aiAccess.`);
    }
  }

  const edgeIds = new Set();
  for (const edge of store.edges) {
    if (!edge.id) {
      errors.push("Edge is missing id.");
      continue;
    }
    if (edgeIds.has(edge.id)) {
      errors.push(`Duplicate edge id: ${edge.id}.`);
    }
    edgeIds.add(edge.id);

    if (!entityIds.has(edge.fromId)) {
      errors.push(`Edge ${edge.id} references missing fromId ${edge.fromId}.`);
    }
    if (!entityIds.has(edge.toId)) {
      errors.push(`Edge ${edge.id} references missing toId ${edge.toId}.`);
    }
  }

  const documentIds = new Set(store.documents.map((document) => document.id));
  for (const attachment of store.attachments) {
    if (!documentIds.has(attachment.documentId)) {
      errors.push(`Attachment ${attachment.id} references missing document ${attachment.documentId}.`);
    }
  }

  for (const source of store.sources) {
    const validEntityTarget = source.targetType === "entity" && entityIds.has(source.targetId);
    const validDocumentTarget =
      source.targetType === "document" && documentIds.has(source.targetId);
    const validEdgeTarget = source.targetType === "edge" && edgeIds.has(source.targetId);
    if (!validEntityTarget && !validDocumentTarget && !validEdgeTarget) {
      errors.push(`Source ${source.id} references missing target ${source.targetId}.`);
    }
  }

  if (Array.isArray(store.layoutSnapshots)) {
    validateLayoutSnapshots(store.layoutSnapshots, entityIds, errors);
  }

  return { valid: errors.length === 0, errors };
}

function validateLayoutSnapshots(layoutSnapshots, entityIds, errors) {
  const snapshotIds = new Set();

  for (const snapshot of layoutSnapshots) {
    if (!snapshot.id) {
      errors.push("Layout snapshot is missing id.");
      continue;
    }
    if (snapshotIds.has(snapshot.id)) {
      errors.push(`Duplicate layout snapshot id: ${snapshot.id}.`);
    }
    snapshotIds.add(snapshot.id);

    if (!Array.isArray(snapshot.positions)) {
      errors.push(`Layout snapshot ${snapshot.id} positions must be an array.`);
      continue;
    }

    for (const position of snapshot.positions) {
      if (!entityIds.has(position.entityId)) {
        errors.push(
          `Layout snapshot ${snapshot.id} references missing entity ${position.entityId}.`,
        );
      }
      if (!Number.isFinite(Number(position.x)) || !Number.isFinite(Number(position.y))) {
        errors.push(`Layout snapshot ${snapshot.id} has invalid coordinates.`);
      }
    }
  }
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "");
}
