import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { GRAPH_ATLAS_STORE_KEY } from "./knowledgeStoreStorage.js";
import {
  createBackupPackage,
  createEncryptedBackupPackage,
  parseBackupPackage,
  parseBackupPackageImport,
  restoreBackupPackage,
  summarizeBackupPackage,
} from "./backupPackage.js";

describe("backup package", () => {
  it("exports a valid store with IndexedDB attachment copies", async () => {
    const indexedDB = createFakeIndexedDB([
      {
        storageKey: "local-library://graph-atlas/attachments/passport.txt",
        manifest: {
          storageKey: "local-library://graph-atlas/attachments/passport.txt",
          contentEncoding: "indexeddb",
          contentHash: "djb2-test",
        },
        bytes: [104, 101, 108, 108, 111],
      },
    ]);
    const backupPackage = await createBackupPackage(seedKnowledgeStore, { indexedDB });

    expect(backupPackage).toEqual(
      expect.objectContaining({
        format: "graph-atlas-backup",
        formatVersion: 1,
        exportedAt: expect.any(String),
        store: seedKnowledgeStore,
        attachmentCopies: [
          {
            storageKey: "local-library://graph-atlas/attachments/passport.txt",
            manifest: expect.objectContaining({
              contentEncoding: "indexeddb",
              contentHash: "djb2-test",
            }),
            bytesBase64: "aGVsbG8=",
          },
        ],
      }),
    );
    expect(summarizeBackupPackage(backupPackage)).toEqual({
      exportedAt: backupPackage.exportedAt,
      entityCount: seedKnowledgeStore.entities.length,
      relationshipCount: seedKnowledgeStore.edges.length,
      attachmentCount: seedKnowledgeStore.attachments.length,
      attachmentCopyCount: 1,
    });
  });

  it("parses and validates backup package format and store schema", async () => {
    const backupPackage = await createBackupPackage(seedKnowledgeStore, {
      indexedDB: createFakeIndexedDB(),
    });

    expect(parseBackupPackage(JSON.stringify(backupPackage))).toEqual(backupPackage);
    expect(() => parseBackupPackage("{not json")).toThrow("备份文件不是有效 JSON");
    expect(() => parseBackupPackage(JSON.stringify({ format: "other" }))).toThrow(
      "备份文件不是 Graph Atlas 备份",
    );
    expect(() =>
      parseBackupPackage(
        JSON.stringify({
          ...backupPackage,
          store: { ...seedKnowledgeStore, entities: "broken" },
        }),
      ),
    ).toThrow("备份资料库校验失败");
  });

  it("exports and parses an encrypted backup without exposing plaintext store content", async () => {
    const backupPackage = await createEncryptedBackupPackage(seedKnowledgeStore, "correct horse", {
      indexedDB: createFakeIndexedDB([
        {
          storageKey: "local-library://graph-atlas/attachments/private.txt",
          manifest: {
            storageKey: "local-library://graph-atlas/attachments/private.txt",
            contentEncoding: "indexeddb",
            textPreview: "SensitiveSmokeText",
          },
          bytes: Array.from(new TextEncoder().encode("SensitiveSmokeText")),
        },
      ]),
    });
    const serialized = JSON.stringify(backupPackage);

    expect(backupPackage).toEqual(
      expect.objectContaining({
        format: "graph-atlas-encrypted-backup",
        formatVersion: 1,
        encryption: expect.objectContaining({
          algorithm: "AES-GCM",
          kdf: "PBKDF2-SHA-256",
          iterations: 210000,
          saltBase64: expect.any(String),
          ivBase64: expect.any(String),
        }),
        ciphertextBase64: expect.any(String),
      }),
    );
    expect(serialized).not.toContain("护照");
    expect(serialized).not.toContain("SensitiveSmokeText");

    const decrypted = await parseBackupPackageImport(serialized, { password: "correct horse" });

    expect(decrypted).toEqual(
      expect.objectContaining({
        format: "graph-atlas-backup",
        store: seedKnowledgeStore,
        attachmentCopies: [
          expect.objectContaining({
            storageKey: "local-library://graph-atlas/attachments/private.txt",
            bytesBase64: "U2Vuc2l0aXZlU21va2VUZXh0",
          }),
        ],
      }),
    );
  });

  it("rejects encrypted backup import with empty or wrong passwords", async () => {
    const storage = createMemoryStorage();
    const originalStore = { ...seedKnowledgeStore, updatedAt: "original" };
    const encryptedPackage = await createEncryptedBackupPackage(
      { ...seedKnowledgeStore, updatedAt: "encrypted" },
      "secret-password",
      { indexedDB: createFakeIndexedDB() },
    );

    storage.setItem(GRAPH_ATLAS_STORE_KEY, JSON.stringify(originalStore));

    await expect(
      parseBackupPackageImport(JSON.stringify(encryptedPackage), { password: "" }),
    ).rejects.toThrow("备份密码不能为空");
    await expect(
      parseBackupPackageImport(JSON.stringify(encryptedPackage), { password: "wrong-password" }),
    ).rejects.toThrow("备份密码不正确或文件已损坏");

    expect(JSON.parse(storage.getItem(GRAPH_ATLAS_STORE_KEY))).toEqual(originalStore);
  });

  it("keeps plaintext backup import compatible through the async import parser", async () => {
    const backupPackage = await createBackupPackage(seedKnowledgeStore, {
      indexedDB: createFakeIndexedDB(),
    });

    await expect(parseBackupPackageImport(JSON.stringify(backupPackage))).resolves.toEqual(
      backupPackage,
    );
  });

  it("restores attachment copies before writing the knowledge store", async () => {
    const storage = createMemoryStorage();
    const indexedDB = createFakeIndexedDB();
    const backupPackage = await createBackupPackage(
      {
        ...seedKnowledgeStore,
        updatedAt: "2026-06-22T00:00:00.000Z",
      },
      { indexedDB: createFakeIndexedDB() },
    );
    const packageWithCopy = {
      ...backupPackage,
      attachmentCopies: [
        {
          storageKey: "local-library://graph-atlas/attachments/restore.txt",
          manifest: {
            storageKey: "local-library://graph-atlas/attachments/restore.txt",
            contentEncoding: "indexeddb",
          },
          bytesBase64: "cmVzdG9yZWQ=",
        },
      ],
    };

    const restored = await restoreBackupPackage(packageWithCopy, storage, { indexedDB });

    expect(restored.updatedAt).toBe("2026-06-22T00:00:00.000Z");
    expect(JSON.parse(storage.getItem(GRAPH_ATLAS_STORE_KEY))).toEqual(packageWithCopy.store);
    expect(indexedDB.records.get("local-library://graph-atlas/attachments/restore.txt")).toEqual(
      expect.objectContaining({
        storageKey: "local-library://graph-atlas/attachments/restore.txt",
        bytes: Array.from(new TextEncoder().encode("restored")),
      }),
    );
  });

  it("does not overwrite the store when attachment restore fails", async () => {
    const storage = createMemoryStorage();
    const originalStore = { ...seedKnowledgeStore, updatedAt: "original" };
    const backupPackage = await createBackupPackage(
      { ...seedKnowledgeStore, updatedAt: "backup" },
      { indexedDB: createFakeIndexedDB() },
    );

    storage.setItem(GRAPH_ATLAS_STORE_KEY, JSON.stringify(originalStore));

    await expect(
      restoreBackupPackage(
        {
          ...backupPackage,
          attachmentCopies: [
            {
              storageKey: "local-library://graph-atlas/attachments/fail.txt",
              manifest: {},
              bytesBase64: "ZmFpbA==",
            },
          ],
        },
        storage,
        { indexedDB: createFailingIndexedDB() },
      ),
    ).rejects.toThrow("IndexedDB request failed");

    expect(JSON.parse(storage.getItem(GRAPH_ATLAS_STORE_KEY))).toEqual(originalStore);
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
  };
}

function createFakeIndexedDB(initialRecords = []) {
  const records = new Map(initialRecords.map((record) => [record.storageKey, record]));
  const objectStore = {
    getAll() {
      const request = createRequest();

      queueMicrotask(() => {
        request.result = Array.from(records.values());
        request.onsuccess?.();
      });

      return request;
    },
    clear() {
      const request = createRequest();

      queueMicrotask(() => {
        records.clear();
        request.result = undefined;
        request.onsuccess?.();
      });

      return request;
    },
    put(record) {
      const request = createRequest();

      queueMicrotask(() => {
        records.set(record.storageKey, record);
        request.result = record.storageKey;
        request.onsuccess?.();
      });

      return request;
    },
  };
  const database = {
    objectStoreNames: {
      contains: () => true,
    },
    createObjectStore: () => objectStore,
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
        request.onsuccess?.();
      });

      return request;
    },
  };
}

function createFailingIndexedDB() {
  const objectStore = {
    clear() {
      const request = createRequest();

      queueMicrotask(() => {
        request.error = new Error("IndexedDB request failed.");
        request.onerror?.();
      });

      return request;
    },
  };
  const database = {
    objectStoreNames: {
      contains: () => true,
    },
    createObjectStore: () => objectStore,
    transaction: () => ({
      objectStore: () => objectStore,
    }),
  };

  return {
    open() {
      const request = createRequest();

      queueMicrotask(() => {
        request.result = database;
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
