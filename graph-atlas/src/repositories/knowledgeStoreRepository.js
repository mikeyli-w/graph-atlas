import { createEdgeId, validateKnowledgeStore } from "../data/schema.js";
import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { migrateLegacyNodesToKnowledgeStore } from "../storage/migrations.js";
import {
  readLegacyNodesPayload,
  readKnowledgeStorePayload,
  writeKnowledgeStorePayload,
} from "../storage/knowledgeStoreStorage.js";

export function createKnowledgeStoreRepository(storage) {
  return {
    loadStore() {
      const payload = readKnowledgeStorePayload(storage);
      if (payload) {
        const store = parseKnowledgeStorePayload(payload);
        const reconciled = reconcileKnowledgeStoreCompatibility(store);

        if (reconciled !== store) {
          try {
            this.saveStore(reconciled);
          } catch {
            // Loading should stay resilient even if the browser refuses a compatibility write.
          }
        }

        return reconciled;
      }

      const legacyPayload = readLegacyNodesPayload(storage);
      if (legacyPayload) {
        const migrated = parseLegacyNodesPayload(legacyPayload);
        if (migrated) {
          try {
            this.saveStore(migrated);
          } catch {
            // Loading should stay resilient even if the browser refuses a migration write.
          }
          return migrated;
        }
      }

      return cloneStore(seedKnowledgeStore);
    },

    saveStore(store) {
      const validation = validateKnowledgeStore(store);
      if (!validation.valid) {
        throw new Error(`Invalid knowledge store: ${validation.errors.join(" ")}`);
      }

      writeKnowledgeStorePayload(JSON.stringify(store), storage);
    },

    resetToSeed() {
      const store = cloneStore(seedKnowledgeStore);
      this.saveStore(store);
      return store;
    },
  };
}

export const knowledgeStoreRepository = createKnowledgeStoreRepository();

function parseKnowledgeStorePayload(payload) {
  try {
    const store = JSON.parse(payload);
    const validation = validateKnowledgeStore(store);
    if (!validation.valid) return cloneStore(seedKnowledgeStore);

    return store;
  } catch {
    return cloneStore(seedKnowledgeStore);
  }
}

function reconcileKnowledgeStoreCompatibility(store) {
  return [
    reconcileLegacyUserRelationships,
    reconcileMissingSeedVaultEntries,
  ].reduce((current, reconcile) => reconcile(current), store);
}

function reconcileLegacyUserRelationships(store) {
  const legacyEdges = store.edges.filter(isLegacyUserRelationship);

  if (legacyEdges.length === 0) {
    return store;
  }

  const updatedAt = new Date().toISOString();
  const legacyIdToNextId = new Map();
  const existingEdgeIds = new Set(store.edges.map((edge) => edge.id));
  const normalizedEdges = store.edges.map((edge) => {
    if (!isLegacyUserRelationship(edge)) return edge;

    const relationType = edge.relationType === "待关联" || edge.label === "待关联"
      ? "关联"
      : edge.relationType || edge.label || "关联";
    const nextId = createSafeRelationshipId({
      edge,
      relationType,
      existingEdgeIds,
    });
    legacyIdToNextId.set(edge.id, nextId);

    return {
      ...edge,
      id: nextId,
      relationType,
      label: relationType,
      source: "manual",
      evidence: edge.evidence || "旧版用户创建关系",
    };
  });
  const normalizedSourceTargets = new Set();
  const normalizedSources = store.sources.map((source) => {
    const nextTargetId = source.targetType === "edge"
      ? legacyIdToNextId.get(source.targetId)
      : "";

    if (!nextTargetId) return source;

    normalizedSourceTargets.add(nextTargetId);

    return {
      ...source,
      id: `source-${nextTargetId}-manual`,
      targetId: nextTargetId,
      kind: "manual",
      label: source.evidence ? `关系依据：${source.evidence}` : "手动创建关系",
      evidence: source.evidence || "旧版用户创建关系",
      createdAt: source.createdAt || updatedAt,
    };
  });
  const normalizedLegacyEdgeIds = new Set(legacyIdToNextId.values());
  const missingSources = normalizedEdges
    .filter((edge) => normalizedLegacyEdgeIds.has(edge.id) && !normalizedSourceTargets.has(edge.id))
    .map((edge) => ({
      id: `source-${edge.id}-manual`,
      targetType: "edge",
      targetId: edge.id,
      kind: "manual",
      label: `关系依据：${edge.evidence}`,
      evidence: edge.evidence,
      createdAt: updatedAt,
    }));

  return {
    ...store,
    metadata: {
      ...store.metadata,
      updatedAt,
      lastMigrationAt: updatedAt,
    },
    edges: normalizedEdges,
    sources: [...normalizedSources, ...missingSources],
    updatedAt,
  };
}

function isLegacyUserRelationship(edge) {
  return edge.source === "user" || edge.relationType === "待关联" || edge.label === "待关联";
}

function createSafeRelationshipId({ edge, relationType, existingEdgeIds }) {
  const nextId = createEdgeId(edge.fromId, relationType, edge.toId);

  if (nextId === edge.id || !existingEdgeIds.has(nextId)) {
    return nextId;
  }

  return edge.id;
}

function reconcileMissingSeedVaultEntries(store) {
  const titles = new Set(store.entities.map((entity) => entity.title));
  const ids = new Set(store.entities.map((entity) => entity.id));
  const missingSeedEntities = seedKnowledgeStore.entities.filter(
    (entity) => !titles.has(entity.title) && !ids.has(entity.id),
  );

  if (missingSeedEntities.length === 0) {
    return store;
  }

  const missingIds = new Set(missingSeedEntities.map((entity) => entity.id));
  const nextEntityIds = new Set([...ids, ...missingIds]);
  const edgeIds = new Set(store.edges.map((edge) => edge.id));
  const documentIds = new Set(store.documents.map((document) => document.id));
  const attachmentIds = new Set(store.attachments.map((attachment) => attachment.id));
  const sourceIds = new Set(store.sources.map((source) => source.id));

  return {
    ...store,
    metadata: {
      ...store.metadata,
      updatedAt: seedKnowledgeStore.metadata.updatedAt,
      lastMigrationAt: seedKnowledgeStore.metadata.updatedAt,
    },
    updatedAt: seedKnowledgeStore.updatedAt,
    entities: [
      ...store.entities,
      ...cloneStore(missingSeedEntities),
    ],
    edges: [
      ...store.edges,
      ...cloneStore(
        seedKnowledgeStore.edges.filter((edge) =>
          !edgeIds.has(edge.id) && nextEntityIds.has(edge.fromId) && nextEntityIds.has(edge.toId),
        ),
      ),
    ],
    documents: [
      ...store.documents,
      ...cloneStore(
        seedKnowledgeStore.documents.filter((document) =>
          missingIds.has(document.entityId) && !documentIds.has(document.id),
        ),
      ),
    ],
    attachments: [
      ...store.attachments,
      ...cloneStore(
        seedKnowledgeStore.attachments.filter((attachment) =>
          missingIds.has(attachment.entityId) && !attachmentIds.has(attachment.id),
        ),
      ),
    ],
    sources: [
      ...store.sources,
      ...cloneStore(
        seedKnowledgeStore.sources.filter((source) =>
          missingIds.has(source.targetId) && !sourceIds.has(source.id),
        ),
      ),
    ],
  };
}

function parseLegacyNodesPayload(payload) {
  try {
    return migrateLegacyNodesToKnowledgeStore(JSON.parse(payload));
  } catch {
    return null;
  }
}

function cloneStore(store) {
  return JSON.parse(JSON.stringify(store));
}
