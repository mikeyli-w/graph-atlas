export const GRAPH_ATLAS_STORE_KEY = "graph-atlas-store";
export const GRAPH_ATLAS_LEGACY_NODES_KEY = "graph-atlas-nodes";

export function readKnowledgeStorePayload(storage = getBrowserStorage()) {
  return storage.getItem(GRAPH_ATLAS_STORE_KEY);
}

export function readLegacyNodesPayload(storage = getBrowserStorage()) {
  return storage.getItem(GRAPH_ATLAS_LEGACY_NODES_KEY);
}

export function writeKnowledgeStorePayload(payload, storage = getBrowserStorage()) {
  storage.setItem(GRAPH_ATLAS_STORE_KEY, payload);
}

function getBrowserStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("localStorage is not available.");
  }

  return window.localStorage;
}
