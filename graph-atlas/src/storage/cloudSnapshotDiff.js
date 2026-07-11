import { validateKnowledgeStore } from "../data/schema.js";

export function summarizeCloudSnapshotDiff(localStore, remoteSnapshot = {}) {
  const localEntityCount = localStore?.entities?.length || 0;
  const remoteEntityCount = remoteSnapshot.summary?.entityCount ?? remoteSnapshot.store?.entities?.length ?? 0;

  if (!remoteSnapshot.store) {
    return {
      mode: "summary-only",
      localEntityCount,
      remoteEntityCount,
      addedRemoteTitles: [],
      missingRemoteTitles: [],
      possibleConflictTitles: [],
      warningLabel: "只能预览数量差异，无法判断具体冲突。",
    };
  }

  const validation = validateKnowledgeStore(remoteSnapshot.store);

  if (!validation.valid) {
    return {
      mode: "incompatible",
      localEntityCount,
      remoteEntityCount,
      addedRemoteTitles: [],
      missingRemoteTitles: [],
      possibleConflictTitles: [],
      warningLabel: `远端快照需检查：${validation.errors.join(" ")}`,
    };
  }

  const localEntities = new Map(localStore.entities.map((entity) => [entity.id, entity]));
  const remoteEntities = new Map(remoteSnapshot.store.entities.map((entity) => [entity.id, entity]));
  const addedRemoteTitles = [];
  const missingRemoteTitles = [];
  const possibleConflictTitles = [];

  for (const remoteEntity of remoteSnapshot.store.entities) {
    const localEntity = localEntities.get(remoteEntity.id);

    if (!localEntity) {
      addedRemoteTitles.push(remoteEntity.title);
      continue;
    }

    if (getEntityUpdatedAt(localEntity) !== getEntityUpdatedAt(remoteEntity)) {
      possibleConflictTitles.push(remoteEntity.title);
    }
  }

  for (const localEntity of localStore.entities) {
    if (!remoteEntities.has(localEntity.id)) {
      missingRemoteTitles.push(localEntity.title);
    }
  }

  return {
    mode: "store-diff",
    localEntityCount,
    remoteEntityCount,
    addedRemoteTitles,
    missingRemoteTitles,
    possibleConflictTitles,
    warningLabel: buildStoreDiffWarning(addedRemoteTitles, missingRemoteTitles, possibleConflictTitles),
  };
}

function getEntityUpdatedAt(entity) {
  return entity.updatedAt || entity.metadata?.updatedAt || "";
}

function buildStoreDiffWarning(addedRemoteTitles, missingRemoteTitles, possibleConflictTitles) {
  if (
    addedRemoteTitles.length === 0 &&
    missingRemoteTitles.length === 0 &&
    possibleConflictTitles.length === 0
  ) {
    return "远端快照与本地资料标题基本一致。";
  }

  return "发现远端差异；当前只预览，不会自动合并或覆盖。";
}
