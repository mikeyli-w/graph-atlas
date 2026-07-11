import {
  KNOWLEDGE_STORE_VERSION,
  SCHEMA_VERSION,
  getDefaultAiAccess,
  normalizePrivacyLevel,
  validateKnowledgeStore,
} from "../data/schema.js";
import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";

const migrationTimestamp = "2026-06-18T00:00:00.000Z";

export function migrateLegacyNodesToKnowledgeStore(nodes) {
  if (!Array.isArray(nodes)) {
    throw new Error("Legacy nodes payload must be an array.");
  }

  const entities = nodes.map(toEntity);
  const entityIds = new Set(entities.map((entity) => entity.id));
  const edges = seedKnowledgeStore.edges.filter(
    (edge) => entityIds.has(edge.fromId) && entityIds.has(edge.toId),
  );
  const store = {
    version: KNOWLEDGE_STORE_VERSION,
    metadata: {
      schemaVersion: SCHEMA_VERSION,
      createdAt: migrationTimestamp,
      updatedAt: migrationTimestamp,
      lastMigrationAt: migrationTimestamp,
      storageAdapter: "localStorage",
    },
    entities,
    edges,
    documents: nodes.map(toDocument),
    attachments: nodes.flatMap(toAttachments),
    sources: nodes.map(toSource),
    inbox: [],
    layoutSnapshots: [],
    auditLog: [],
    updatedAt: migrationTimestamp,
  };
  const validation = validateKnowledgeStore(store);

  if (!validation.valid) {
    throw new Error(`Invalid migrated store: ${validation.errors.join(" ")}`);
  }

  return store;
}

function toEntity(node, index) {
  const id = node.id || `entity-${index + 1}`;
  const privacyLevel = normalizePrivacyLevel(node.privacy);

  return {
    id,
    title: node.title || "未命名资料",
    type: node.type || "资料",
    icon: node.icon || "DOC",
    color: node.color || "#a6a7b5",
    x: typeof node.x === "number" ? node.x : 50,
    y: typeof node.y === "number" ? node.y : 50,
    privacyLevel,
    aiAccess: getDefaultAiAccess(privacyLevel),
    tags: Array.isArray(node.tags) ? node.tags : [],
    created: node.created || "未知",
    updated: node.updated || "未知",
    favorite: Boolean(node.favorite),
    lifecycleStatus: "saved",
  };
}

function toDocument(node, index) {
  const entityId = node.id || `entity-${index + 1}`;

  return {
    id: `doc-${entityId}`,
    entityId,
    title: `${node.title || "未命名资料"} 内容`,
    kind: "note",
    body: node.preview || "",
    updated: node.updated || "未知",
  };
}

function toAttachments(node, index) {
  const entityId = node.id || `entity-${index + 1}`;
  const attachments = Array.isArray(node.attachments) ? node.attachments : [];

  return attachments.map((attachment, attachmentIndex) => ({
    id: `att-${entityId}-${attachmentIndex + 1}`,
    entityId,
    documentId: `doc-${entityId}`,
    name: attachment.name || "未命名附件",
    size: attachment.size || "",
    date: attachment.date || "",
    reference: attachment.reference || "",
  }));
}

function toSource(node, index) {
  const entityId = node.id || `entity-${index + 1}`;

  return {
    id: `source-${entityId}-manual`,
    targetType: "entity",
    targetId: entityId,
    kind: "manual",
    label: "手动创建",
  };
}
