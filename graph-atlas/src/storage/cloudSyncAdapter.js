export const cloudSyncConfigStorageKey = "graph-atlas-cloud-sync-config-v1";

const defaultCloudSyncConfig = {
  endpoint: "",
  token: "",
  lastStatus: "idle",
  lastSnapshotId: "",
  lastSyncedAt: "",
};

export function loadCloudSyncConfig(storage = getCloudSyncStorage()) {
  if (!storage) return { ...defaultCloudSyncConfig };

  try {
    const parsed = JSON.parse(storage.getItem(cloudSyncConfigStorageKey) || "{}");

    return normalizeCloudSyncConfig(parsed);
  } catch {
    return { ...defaultCloudSyncConfig };
  }
}

export function saveCloudSyncConfig(config, storage = getCloudSyncStorage()) {
  const normalized = normalizeCloudSyncConfig(config);

  if (storage) {
    storage.setItem(cloudSyncConfigStorageKey, JSON.stringify(normalized));
  }

  return normalized;
}

export function clearCloudSyncConfig(storage = getCloudSyncStorage()) {
  if (storage) {
    storage.removeItem(cloudSyncConfigStorageKey);
  }

  return { ...defaultCloudSyncConfig };
}

export function createHttpCloudSyncAdapter(options = {}) {
  const endpoint = String(options.endpoint || "").trim();
  const token = String(options.token || "").trim();
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  return {
    getCapabilities() {
      const configured = Boolean(endpoint);

      return {
        id: "cloud-sync",
        label: "云同步客户端",
        configured,
        canTestConnection: configured && typeof fetchImpl === "function",
        canPushSnapshot: configured && typeof fetchImpl === "function",
        canPullSnapshot: configured && typeof fetchImpl === "function",
        persistence: "remote-http-snapshot",
        statusLabel: configured ? "已配置" : "未配置",
        description: configured
          ? "可手动推送或检查远端快照；不会自动同步或合并。"
          : "未配置云同步 endpoint；当前仅使用本地资料库。",
      };
    },

    async testConnection() {
      assertConfigured(endpoint, fetchImpl);
      const response = await requestJson(fetchImpl, buildCloudSyncUrl(endpoint, "/capabilities"), {
        method: "GET",
        token,
      });

      return {
        ok: true,
        statusLabel: response.statusLabel || "连接成功",
        serviceLabel: response.label || response.serviceLabel || "Graph Atlas sync endpoint",
        checkedAt: new Date().toISOString(),
      };
    },

    async pushSnapshot(store) {
      assertConfigured(endpoint, fetchImpl);
      const exportedAt = new Date().toISOString();
      const summary = summarizeStore(store);
      const response = await requestJson(fetchImpl, buildCloudSyncUrl(endpoint, "/snapshots"), {
        method: "POST",
        token,
        body: {
          format: "graph-atlas-cloud-snapshot",
          formatVersion: 1,
          exportedAt,
          summary,
          store,
        },
      });

      return {
        snapshotId: response.snapshotId || response.versionId || `snapshot-${Date.now()}`,
        updatedAt: response.updatedAt || response.receivedAt || exportedAt,
        summary: response.summary || summary,
      };
    },

    async pullSnapshot() {
      assertConfigured(endpoint, fetchImpl);
      const response = await requestJson(fetchImpl, buildCloudSyncUrl(endpoint, "/snapshots/latest"), {
        method: "GET",
        token,
      });
      const summary = response.summary || response.storeSummary || (response.store ? summarizeStore(response.store) : null);

      if (!summary) {
        throw new Error("远端快照摘要缺失。");
      }

      return {
        snapshotId: response.snapshotId || response.versionId || "latest",
        updatedAt: response.updatedAt || response.exportedAt || "",
        summary,
        store: response.store || null,
      };
    },
  };
}

function normalizeCloudSyncConfig(config = {}) {
  const endpoint = String(config.endpoint || "").trim();

  return {
    endpoint,
    token: String(config.token || "").trim(),
    lastStatus: config.lastStatus || (endpoint ? "configured" : "idle"),
    lastSnapshotId: config.lastSnapshotId || "",
    lastSyncedAt: config.lastSyncedAt || "",
  };
}

function assertConfigured(endpoint, fetchImpl) {
  if (!endpoint) {
    throw new Error("云同步 endpoint 未配置。");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("当前环境不支持云同步请求。");
  }
}

async function requestJson(fetchImpl, url, { method, token, body } = {}) {
  let response;

  try {
    response = await fetchImpl(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw new Error(`云同步请求失败：${error.message}`);
  }

  if (!response?.ok) {
    throw new Error(`云同步请求失败：${response?.status || "unknown"}`);
  }

  if (response.status === 204) return {};

  return response.json ? response.json() : {};
}

function buildCloudSyncUrl(endpoint, path) {
  const normalizedPath = path.replace(/^\//, "");
  const baseUrl = new URL(endpoint, globalThis.location?.href || "http://127.0.0.1/");
  const base = baseUrl.href.endsWith("/") ? baseUrl.href : `${baseUrl.href}/`;

  return new URL(normalizedPath, base).toString();
}

function summarizeStore(store) {
  return {
    entityCount: store.entities?.length || 0,
    relationshipCount: store.edges?.length || 0,
    attachmentCount: store.attachments?.length || 0,
    updatedAt: store.updatedAt || store.metadata?.updatedAt || "",
  };
}

function getCloudSyncStorage() {
  return typeof localStorage === "undefined" ? null : localStorage;
}
