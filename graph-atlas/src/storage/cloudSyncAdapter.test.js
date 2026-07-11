import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import {
  clearCloudSyncConfig,
  cloudSyncConfigStorageKey,
  createHttpCloudSyncAdapter,
  loadCloudSyncConfig,
  saveCloudSyncConfig,
} from "./cloudSyncAdapter.js";

describe("cloudSyncAdapter", () => {
  it("loads, saves and clears local cloud sync config", () => {
    const storage = createMemoryStorage();

    expect(loadCloudSyncConfig(storage)).toEqual({
      endpoint: "",
      token: "",
      lastStatus: "idle",
      lastSnapshotId: "",
      lastSyncedAt: "",
    });

    const saved = saveCloudSyncConfig(
      {
        endpoint: " https://sync.example.test/api ",
        token: " token ",
        lastStatus: "success",
        lastSnapshotId: "snapshot-1",
        lastSyncedAt: "2026-07-01T00:00:00.000Z",
      },
      storage,
    );

    expect(saved).toEqual({
      endpoint: "https://sync.example.test/api",
      token: "token",
      lastStatus: "success",
      lastSnapshotId: "snapshot-1",
      lastSyncedAt: "2026-07-01T00:00:00.000Z",
    });
    expect(JSON.parse(storage.getItem(cloudSyncConfigStorageKey))).toEqual(saved);
    expect(loadCloudSyncConfig(storage)).toEqual(saved);

    expect(clearCloudSyncConfig(storage)).toEqual({
      endpoint: "",
      token: "",
      lastStatus: "idle",
      lastSnapshotId: "",
      lastSyncedAt: "",
    });
    expect(storage.getItem(cloudSyncConfigStorageKey)).toBeNull();
  });

  it("falls back to unconfigured state when local config JSON is damaged", () => {
    const storage = createMemoryStorage();

    storage.setItem(cloudSyncConfigStorageKey, "{not json");

    expect(loadCloudSyncConfig(storage)).toEqual(
      expect.objectContaining({
        endpoint: "",
        token: "",
        lastStatus: "idle",
      }),
    );
    expect(storage.getItem(cloudSyncConfigStorageKey)).toBe("{not json");
  });

  it("tests connection, pushes snapshots and pulls remote snapshot summaries", async () => {
    const requests = [];
    const adapter = createHttpCloudSyncAdapter({
      endpoint: "https://sync.example.test/api",
      token: "sync-token",
      fetchImpl: async (url, options) => {
        requests.push({ url, options });

        if (url.endsWith("/capabilities")) {
          return createJsonResponse({ label: "Mock Sync" });
        }
        if (url.endsWith("/snapshots") && options.method === "POST") {
          const payload = JSON.parse(options.body);

          expect(payload).toEqual(
            expect.objectContaining({
              format: "graph-atlas-cloud-snapshot",
              formatVersion: 1,
              store: seedKnowledgeStore,
              summary: {
                entityCount: seedKnowledgeStore.entities.length,
                relationshipCount: seedKnowledgeStore.edges.length,
                attachmentCount: seedKnowledgeStore.attachments.length,
                updatedAt: seedKnowledgeStore.updatedAt,
              },
            }),
          );

          return createJsonResponse({
            snapshotId: "snapshot-remote-1",
            updatedAt: "2026-07-01T01:00:00.000Z",
          });
        }
        if (url.endsWith("/snapshots/latest")) {
          return createJsonResponse({
            snapshotId: "snapshot-remote-1",
            updatedAt: "2026-07-01T01:00:00.000Z",
            summary: {
              entityCount: 13,
              relationshipCount: 20,
              attachmentCount: 10,
              updatedAt: "2026-07-01T00:30:00.000Z",
            },
          });
        }

        return createJsonResponse({}, { ok: false, status: 404 });
      },
    });

    expect(adapter.getCapabilities()).toEqual(
      expect.objectContaining({
        id: "cloud-sync",
        configured: true,
        canPushSnapshot: true,
        statusLabel: "已配置",
      }),
    );
    await expect(adapter.testConnection()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        serviceLabel: "Mock Sync",
      }),
    );
    await expect(adapter.pushSnapshot(seedKnowledgeStore)).resolves.toEqual(
      expect.objectContaining({
        snapshotId: "snapshot-remote-1",
        updatedAt: "2026-07-01T01:00:00.000Z",
      }),
    );
    await expect(adapter.pullSnapshot()).resolves.toEqual({
      snapshotId: "snapshot-remote-1",
      updatedAt: "2026-07-01T01:00:00.000Z",
      summary: {
        entityCount: 13,
        relationshipCount: 20,
        attachmentCount: 10,
        updatedAt: "2026-07-01T00:30:00.000Z",
      },
      store: null,
    });
    expect(requests.every((request) => request.options.headers.Authorization === "Bearer sync-token"))
      .toBe(true);
  });

  it("supports relative endpoints against the current browser origin", async () => {
    const originalLocation = globalThis.location;
    const requests = [];

    Object.defineProperty(globalThis, "location", {
      value: { href: "http://127.0.0.1:5175/settings" },
      configurable: true,
    });

    const adapter = createHttpCloudSyncAdapter({
      endpoint: "/mock-cloud-sync",
      fetchImpl: async (url) => {
        requests.push(url);
        return createJsonResponse({ label: "Relative Sync" });
      },
    });

    await expect(adapter.testConnection()).resolves.toEqual(
      expect.objectContaining({ serviceLabel: "Relative Sync" }),
    );
    expect(requests).toEqual(["http://127.0.0.1:5175/mock-cloud-sync/capabilities"]);

    Object.defineProperty(globalThis, "location", {
      value: originalLocation,
      configurable: true,
    });
  });

  it("preserves full remote stores when latest snapshots include them", async () => {
    const adapter = createHttpCloudSyncAdapter({
      endpoint: "https://sync.example.test/api",
      fetchImpl: async (url) => {
        if (url.endsWith("/snapshots/latest")) {
          return createJsonResponse({
            snapshotId: "snapshot-with-store",
            updatedAt: "2026-07-01T02:00:00.000Z",
            store: seedKnowledgeStore,
          });
        }

        return createJsonResponse({}, { ok: false, status: 404 });
      },
    });

    await expect(adapter.pullSnapshot()).resolves.toEqual({
      snapshotId: "snapshot-with-store",
      updatedAt: "2026-07-01T02:00:00.000Z",
      summary: {
        entityCount: seedKnowledgeStore.entities.length,
        relationshipCount: seedKnowledgeStore.edges.length,
        attachmentCount: seedKnowledgeStore.attachments.length,
        updatedAt: seedKnowledgeStore.updatedAt,
      },
      store: seedKnowledgeStore,
    });
  });

  it("reports missing configuration, network failures and non-2xx responses clearly", async () => {
    await expect(createHttpCloudSyncAdapter().testConnection()).rejects.toThrow(
      "云同步 endpoint 未配置",
    );
    await expect(
      createHttpCloudSyncAdapter({
        endpoint: "https://sync.example.test/api",
        fetchImpl: async () => {
          throw new Error("offline");
        },
      }).testConnection(),
    ).rejects.toThrow("云同步请求失败：offline");
    await expect(
      createHttpCloudSyncAdapter({
        endpoint: "https://sync.example.test/api",
        fetchImpl: async () => createJsonResponse({}, { ok: false, status: 503 }),
      }).pushSnapshot(seedKnowledgeStore),
    ).rejects.toThrow("云同步请求失败：503");
  });

  it("rejects remote snapshots without a preview summary", async () => {
    const adapter = createHttpCloudSyncAdapter({
      endpoint: "https://sync.example.test/api",
      fetchImpl: async () => createJsonResponse({ snapshotId: "empty" }),
    });

    await expect(adapter.pullSnapshot()).rejects.toThrow("远端快照摘要缺失");
  });
});

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function createJsonResponse(payload, options = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: async () => payload,
  };
}
