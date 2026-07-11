import { describe, expect, it } from "vitest";

import {
  clearAttachmentDirectoryHandle,
  createBrowserAttachmentStorageAdapter,
  createFileSystemAttachmentStorageAdapter,
  createHttpAttachmentStorageAdapter,
  createIndexedDbAttachmentStorageAdapter,
  createInlineAttachmentStorageAdapter,
  createLocalAttachmentReference,
  loadAttachmentDirectoryHandle,
  queryAttachmentDirectoryPermission,
  requestAttachmentDirectoryPermission,
  saveAttachmentDirectoryHandle,
  selectAttachmentStorageCapabilities,
} from "./attachmentStorageAdapter.js";

describe("attachment storage adapter", () => {
  it("creates controlled local attachment references", () => {
    expect(
      createLocalAttachmentReference({
        name: "护照扫描件.pdf",
        size: 1536,
        lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
      }),
    ).toBe(
      "local-library://graph-atlas/attachments/%E6%8A%A4%E7%85%A7%E6%89%AB%E6%8F%8F%E4%BB%B6.pdf?size=1536&modified=1781784000000",
    );
  });

  it("stores small files inline as base64", async () => {
    const adapter = createInlineAttachmentStorageAdapter();
    const result = await adapter.store({
      name: "binary.dat",
      type: "application/octet-stream",
      size: 4,
      lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
      arrayBuffer: async () => new Uint8Array([0, 1, 2, 255]).buffer,
      text: async () => "Binary preview",
    });

    expect(result).toEqual({
      storageKey: "local-library://graph-atlas/attachments/binary.dat?size=4&modified=1781784000000",
      mimeType: "application/octet-stream",
      byteSize: 4,
      contentHash: expect.stringMatching(/^djb2-[0-9a-f]{8}$/),
      contentEncoding: "base64",
      contentBase64: "AAEC/w==",
      textPreview: "Binary preview",
      copyStatus: "stored",
      copyLimitBytes: 262144,
    });
  });

  it("skips files that exceed the adapter byte limit", async () => {
    const adapter = createInlineAttachmentStorageAdapter({ byteLimit: 3 });
    const result = await adapter.store({
      name: "large.bin",
      type: "application/octet-stream",
      size: 4,
      lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
      arrayBuffer: async () => {
        throw new Error("large files should not be read");
      },
      text: async () => {
        throw new Error("large files should not be read");
      },
    });

    expect(result).toEqual({
      storageKey: "local-library://graph-atlas/attachments/large.bin?size=4&modified=1781784000000",
      mimeType: "application/octet-stream",
      byteSize: 4,
      contentHash: "",
      contentEncoding: "",
      contentBase64: "",
      textPreview: "",
      copyStatus: "skipped-too-large",
      copyLimitBytes: 3,
    });
  });

  it("stores files in an IndexedDB-backed object store", async () => {
    const indexedDB = createFakeIndexedDB();
    const adapter = createIndexedDbAttachmentStorageAdapter({
      indexedDB,
      databaseName: "test-attachments",
      storeName: "copies",
    });
    const result = await adapter.store({
      name: "binary.dat",
      type: "application/octet-stream",
      size: 4,
      lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
      arrayBuffer: async () => new Uint8Array([0, 1, 2, 255]).buffer,
      text: async () => "Binary preview",
    });

    expect(result).toEqual({
      storageKey: "local-library://graph-atlas/attachments/binary.dat?size=4&modified=1781784000000",
      mimeType: "application/octet-stream",
      byteSize: 4,
      contentHash: expect.stringMatching(/^djb2-[0-9a-f]{8}$/),
      contentEncoding: "indexeddb",
      contentBase64: "",
      textPreview: "Binary preview",
      copyStatus: "stored-indexeddb",
      copyLimitBytes: 5242880,
    });
    expect(indexedDB.records.get(result.storageKey)).toEqual(
      expect.objectContaining({
        storageKey: result.storageKey,
        bytes: [0, 1, 2, 255],
        manifest: result,
      }),
    );
  });

  it("reads and removes files from an IndexedDB-backed object store", async () => {
    const indexedDB = createFakeIndexedDB();
    const adapter = createIndexedDbAttachmentStorageAdapter({
      indexedDB,
      databaseName: "test-attachments",
      storeName: "copies",
    });
    const manifest = await adapter.store({
      name: "readable.txt",
      type: "text/plain",
      size: 7,
      lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
      arrayBuffer: async () => new TextEncoder().encode("read me").buffer,
      text: async () => "read me",
    });

    await expect(adapter.read(manifest.storageKey)).resolves.toEqual({
      bytes: Array.from(new TextEncoder().encode("read me")),
      manifest,
    });

    await adapter.remove(manifest.storageKey);

    await expect(adapter.read(manifest.storageKey)).resolves.toBeNull();
  });

  it("skips IndexedDB writes when the file exceeds the byte limit", async () => {
    const indexedDB = createFakeIndexedDB();
    const adapter = createIndexedDbAttachmentStorageAdapter({
      indexedDB,
      byteLimit: 3,
    });
    const result = await adapter.store({
      name: "large.bin",
      type: "application/octet-stream",
      size: 4,
      lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
      arrayBuffer: async () => {
        throw new Error("large files should not be read");
      },
      text: async () => {
        throw new Error("large files should not be read");
      },
    });

    expect(result).toEqual({
      storageKey: "local-library://graph-atlas/attachments/large.bin?size=4&modified=1781784000000",
      mimeType: "application/octet-stream",
      byteSize: 4,
      contentHash: "",
      contentEncoding: "",
      contentBase64: "",
      textPreview: "",
      copyStatus: "skipped-too-large",
      copyLimitBytes: 3,
    });
    expect(indexedDB.records.size).toBe(0);
  });

  it("stores, reads and removes files through a file-system directory handle", async () => {
    const directoryHandle = createFakeDirectoryHandle();
    const adapter = createFileSystemAttachmentStorageAdapter({
      directoryHandle,
      permissionState: "granted",
    });
    const result = await adapter.store({
      name: "large-report.txt",
      type: "text/plain",
      size: 13,
      lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
      arrayBuffer: async () => new TextEncoder().encode("large content").buffer,
      text: async () => "large content",
    });

    expect(result).toEqual({
      storageKey: expect.stringMatching(/^file-system:\/\/graph-atlas\/attachments\/djb2-/),
      mimeType: "text/plain",
      byteSize: 13,
      contentHash: expect.stringMatching(/^djb2-[0-9a-f]{8}$/),
      contentEncoding: "file-system",
      contentBase64: "",
      textPreview: "large content",
      copyStatus: "stored-file-system",
      copyLimitBytes: 0,
    });
    expect(directoryHandle.files.size).toBe(1);

    await expect(adapter.read(result.storageKey)).resolves.toEqual({
      bytes: Array.from(new TextEncoder().encode("large content")),
      manifest: expect.objectContaining({
        storageKey: result.storageKey,
        contentEncoding: "file-system",
        copyStatus: "stored-file-system",
      }),
    });

    await adapter.remove(result.storageKey);

    expect(directoryHandle.files.size).toBe(0);
  });

  it("stores oversized browser files in the configured file-system directory", async () => {
    const indexedDB = createFakeIndexedDB();
    const directoryHandle = createFakeDirectoryHandle();
    const adapter = createBrowserAttachmentStorageAdapter({
      indexedDB,
      directoryHandle,
      fileSystemPermissionState: "granted",
    });
    const result = await adapter.store({
      name: "oversized.zip",
      type: "application/zip",
      size: 5242881,
      lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      text: async () => "",
    });

    expect(result).toEqual(
      expect.objectContaining({
        contentEncoding: "file-system",
        copyStatus: "stored-file-system",
      }),
    );
    expect(indexedDB.records.size).toBe(0);
    expect(directoryHandle.files.size).toBe(1);
  });

  it("uploads files through the optional remote attachment adapter", async () => {
    const requests = [];
    const adapter = createHttpAttachmentStorageAdapter({
      endpoint: "https://uploads.example.test/attachments",
      token: "secret",
      fetch: async (url, options) => {
        requests.push({ url, options });

        return {
          ok: true,
          json: async () => ({
            storageKey: "remote://graph-atlas/attachments/uploaded.txt",
            textPreview: "Remote preview",
          }),
        };
      },
    });
    const result = await adapter.store({
      name: "remote.txt",
      type: "text/plain",
      size: 13,
      lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
      arrayBuffer: async () => new TextEncoder().encode("remote content").buffer,
      text: async () => "remote content",
    });

    expect(result).toEqual({
      storageKey: "remote://graph-atlas/attachments/uploaded.txt",
      mimeType: "text/plain",
      byteSize: 13,
      contentHash: expect.stringMatching(/^djb2-[0-9a-f]{8}$/),
      contentEncoding: "remote",
      contentBase64: "",
      textPreview: "Remote preview",
      copyStatus: "stored-remote",
      copyLimitBytes: 0,
    });
    expect(requests[0].options.headers.authorization).toBe("Bearer secret");
    expect(JSON.parse(requests[0].options.body)).toEqual(
      expect.objectContaining({
        fileName: "remote.txt",
        bytesBase64: "cmVtb3RlIGNvbnRlbnQ=",
      }),
    );
  });

  it("reports remote upload failures clearly", async () => {
    const adapter = createHttpAttachmentStorageAdapter({
      endpoint: "https://uploads.example.test/attachments",
      fetch: async () => ({ ok: false, status: 503 }),
    });

    await expect(adapter.store({
      name: "fail.txt",
      type: "text/plain",
      size: 4,
      arrayBuffer: async () => new TextEncoder().encode("fail").buffer,
      text: async () => "fail",
    })).rejects.toThrow("后端上传失败：503");
  });

  it("stores oversized browser files in remote storage when no local directory is configured", async () => {
    const indexedDB = createFakeIndexedDB();
    const adapter = createBrowserAttachmentStorageAdapter({
      indexedDB,
      remote: {
        endpoint: "https://uploads.example.test/attachments",
        fetch: async () => ({
          ok: true,
          json: async () => ({ storageKey: "remote://graph-atlas/attachments/large.zip" }),
        }),
      },
    });
    const result = await adapter.store({
      name: "large.zip",
      type: "application/zip",
      size: 5242881,
      lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      text: async () => "",
    });

    expect(result).toEqual(
      expect.objectContaining({
        storageKey: "remote://graph-atlas/attachments/large.zip",
        contentEncoding: "remote",
        copyStatus: "stored-remote",
      }),
    );
    expect(indexedDB.records.size).toBe(0);
  });

  it("selects IndexedDB for browser attachment storage when available", async () => {
    const indexedDB = createFakeIndexedDB();
    const adapter = createBrowserAttachmentStorageAdapter({ indexedDB });
    const result = await adapter.store({
      name: "browser.bin",
      type: "application/octet-stream",
      size: 2,
      lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
      arrayBuffer: async () => new Uint8Array([1, 2]).buffer,
      text: async () => "Browser preview",
    });

    expect(result).toEqual(
      expect.objectContaining({
        contentEncoding: "indexeddb",
        copyStatus: "stored-indexeddb",
      }),
    );
    expect(indexedDB.records.get(result.storageKey)).toEqual(
      expect.objectContaining({
        bytes: [1, 2],
      }),
    );
    expect(adapter.getCapabilities()).toEqual(
      expect.objectContaining({
        id: "browser-indexeddb",
        label: "IndexedDB 附件副本",
        canStore: true,
        canRead: true,
        canRemove: true,
        fallbackId: "inline-base64",
      }),
    );
  });

  it("falls back to inline storage when IndexedDB is unavailable", async () => {
    const adapter = createBrowserAttachmentStorageAdapter({ indexedDB: null });
    const result = await adapter.store({
      name: "fallback.txt",
      type: "text/plain",
      size: 5,
      lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
      arrayBuffer: async () => new TextEncoder().encode("hello").buffer,
      text: async () => "hello",
    });

    expect(result).toEqual(
      expect.objectContaining({
        contentEncoding: "base64",
        contentBase64: "aGVsbG8=",
        copyStatus: "stored",
      }),
    );
    expect(adapter.getCapabilities()).toEqual(
      expect.objectContaining({
        id: "inline-base64",
        canStore: true,
        canRead: false,
        canRemove: false,
        persistence: "knowledge-store-json",
      }),
    );
  });

  it("falls back to inline storage when IndexedDB writes fail", async () => {
    const indexedDB = createFailingIndexedDB();
    const adapter = createBrowserAttachmentStorageAdapter({
      indexedDB,
      inlineOptions: { byteLimit: 10 },
    });
    const result = await adapter.store({
      name: "quota-fallback.txt",
      type: "text/plain",
      size: 5,
      lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
      arrayBuffer: async () => new TextEncoder().encode("hello").buffer,
      text: async () => "hello",
    });

    expect(result).toEqual({
      storageKey:
        "local-library://graph-atlas/attachments/quota-fallback.txt?size=5&modified=1781784000000",
      mimeType: "text/plain",
      byteSize: 5,
      contentHash: expect.stringMatching(/^djb2-[0-9a-f]{8}$/),
      contentEncoding: "base64",
      contentBase64: "aGVsbG8=",
      textPreview: "hello",
      copyStatus: "stored",
      copyLimitBytes: 10,
    });
    expect(indexedDB.records.size).toBe(0);
  });

  it("reports configured and future attachment storage capabilities", () => {
    expect(selectAttachmentStorageCapabilities({ indexedDB: createFakeIndexedDB() })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "indexeddb",
          configured: true,
          statusLabel: "可用",
          canRead: true,
          canRemove: true,
        }),
        expect.objectContaining({
          id: "inline-base64",
          configured: true,
          statusLabel: "回退",
        }),
        expect.objectContaining({
          id: "file-system",
          configured: false,
          statusLabel: "浏览器不支持",
        }),
        expect.objectContaining({
          id: "backend-sync",
          configured: false,
          statusLabel: "未配置",
        }),
      ]),
    );

    expect(
      selectAttachmentStorageCapabilities({
        indexedDB: createFakeIndexedDB(),
        fileSystem: {
          supported: true,
          configured: true,
          permissionState: "granted",
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "file-system",
          configured: true,
          statusLabel: "已授权",
          canStore: true,
          canRead: true,
          canRemove: true,
        }),
        expect.objectContaining({
          id: "backend-sync",
          configured: false,
          statusLabel: "未配置",
        }),
      ]),
    );

    expect(selectAttachmentStorageCapabilities({ indexedDB: null })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "indexeddb",
          configured: false,
          statusLabel: "未启用",
        }),
      ]),
    );

    expect(
      selectAttachmentStorageCapabilities({
        indexedDB: createFakeIndexedDB(),
        backend: {
          endpoint: "https://uploads.example.test/attachments",
          lastStatus: "success",
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "backend-sync",
          configured: true,
          statusLabel: "最近成功",
          canStore: true,
        }),
      ]),
    );
  });

  it("persists and clears a file-system directory handle outside the knowledge store", async () => {
    const indexedDB = createFakeIndexedDB();
    const directoryHandle = createFakeDirectoryHandle();

    await saveAttachmentDirectoryHandle(directoryHandle, {
      indexedDB,
      databaseName: "directory-test",
      storeName: "handles",
    });

    await expect(
      loadAttachmentDirectoryHandle({
        indexedDB,
        databaseName: "directory-test",
        storeName: "handles",
      }),
    ).resolves.toBe(directoryHandle);

    await expect(queryAttachmentDirectoryPermission(directoryHandle)).resolves.toBe("granted");
    await expect(requestAttachmentDirectoryPermission(directoryHandle)).resolves.toBe("granted");

    await clearAttachmentDirectoryHandle({
      indexedDB,
      databaseName: "directory-test",
      storeName: "handles",
    });

    await expect(
      loadAttachmentDirectoryHandle({
        indexedDB,
        databaseName: "directory-test",
        storeName: "handles",
      }),
    ).resolves.toBeNull();
  });
});

function createFakeIndexedDB() {
  const records = new Map();
  let activeKeyPath = "storageKey";
  const objectStore = {
    put(record) {
      const request = createRequest();

      queueMicrotask(() => {
        records.set(record[activeKeyPath], record);
        request.result = record[activeKeyPath];
        request.onsuccess?.();
      });

      return request;
    },
    get(storageKey) {
      const request = createRequest();

      queueMicrotask(() => {
        request.result = records.get(storageKey) || null;
        request.onsuccess?.();
      });

      return request;
    },
    delete(storageKey) {
      const request = createRequest();

      queueMicrotask(() => {
        records.delete(storageKey);
        request.result = undefined;
        request.onsuccess?.();
      });

      return request;
    },
  };
  const database = {
    objectStoreNames: {
      contains: () => false,
    },
    createObjectStore: (_storeName, options) => {
      activeKeyPath = options?.keyPath || "storageKey";
    },
    transaction: () => ({
      objectStore: () => objectStore,
    }),
  };

  return {
    records,
    open() {
      const request = createRequest();

      queueMicrotask(() => {
        request.result = database;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });

      return request;
    },
  };
}

function createFakeDirectoryHandle(permissionState = "granted") {
  const files = new Map();

  return {
    files,
    async queryPermission() {
      return permissionState;
    },
    async requestPermission() {
      return permissionState;
    },
    async getFileHandle(name, options = {}) {
      if (!files.has(name) && !options.create) {
        throw new Error("File not found");
      }

      return {
        async createWritable() {
          return {
            async write(bytes) {
              files.set(name, Array.from(bytes));
            },
            async close() {
              return undefined;
            },
          };
        },
        async getFile() {
          const bytes = files.get(name) || [];
          const text = new TextDecoder().decode(new Uint8Array(bytes));

          return {
            type: "text/plain",
            size: bytes.length,
            arrayBuffer: async () => new Uint8Array(bytes).buffer,
            text: async () => text,
          };
        },
      };
    },
    async removeEntry(name) {
      files.delete(name);
    },
  };
}

function createFailingIndexedDB() {
  const records = new Map();
  const database = {
    objectStoreNames: {
      contains: () => false,
    },
    createObjectStore: () => undefined,
    transaction: () => ({
      objectStore: () => ({
        put() {
          const request = createRequest();

          queueMicrotask(() => {
            request.error = new Error("Quota exceeded");
            request.onerror?.();
          });

          return request;
        },
      }),
    }),
  };

  return {
    records,
    open() {
      const request = createRequest();

      queueMicrotask(() => {
        request.result = database;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });

      return request;
    },
  };
}

function createRequest() {
  return {
    result: undefined,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  };
}
