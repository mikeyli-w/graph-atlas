import { validateKnowledgeStore } from "../data/schema.js";
import { writeKnowledgeStorePayload } from "./knowledgeStoreStorage.js";

export const BACKUP_FORMAT = "graph-atlas-backup";
export const ENCRYPTED_BACKUP_FORMAT = "graph-atlas-encrypted-backup";
export const BACKUP_FORMAT_VERSION = 1;
export const ATTACHMENT_DATABASE_NAME = "graph-atlas-attachments";
export const ATTACHMENT_STORE_NAME = "attachmentCopies";
export const BACKUP_ENCRYPTION_ALGORITHM = "AES-GCM";
export const BACKUP_ENCRYPTION_KDF = "PBKDF2-SHA-256";
export const BACKUP_ENCRYPTION_ITERATIONS = 210000;

export async function createBackupPackage(store, indexedDbOptions = {}) {
  assertValidStore(store);

  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    store,
    attachmentCopies: await listIndexedDbAttachmentCopies(indexedDbOptions),
  };
}

export async function createEncryptedBackupPackage(store, password, indexedDbOptions = {}) {
  assertBackupPassword(password);
  const backupPackage = await createBackupPackage(store, indexedDbOptions);
  const crypto = getBackupCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(backupPackage));
  const ciphertext = await crypto.subtle.encrypt({ name: BACKUP_ENCRYPTION_ALGORITHM, iv }, key, plaintext);

  return {
    format: ENCRYPTED_BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: backupPackage.exportedAt,
    encryption: {
      algorithm: BACKUP_ENCRYPTION_ALGORITHM,
      kdf: BACKUP_ENCRYPTION_KDF,
      iterations: BACKUP_ENCRYPTION_ITERATIONS,
      saltBase64: encodeBase64(salt),
      ivBase64: encodeBase64(iv),
    },
    ciphertextBase64: encodeBase64(new Uint8Array(ciphertext)),
  };
}

export function parseBackupPackage(jsonText) {
  let backupPackage;

  try {
    backupPackage = JSON.parse(jsonText);
  } catch {
    throw new Error("备份文件不是有效 JSON。");
  }

  validateBackupPackage(backupPackage);

  return backupPackage;
}

export async function parseBackupPackageImport(jsonText, options = {}) {
  const parsedPackage = parseJsonBackupPackage(jsonText);

  if (parsedPackage?.format !== ENCRYPTED_BACKUP_FORMAT) {
    validateBackupPackage(parsedPackage);
    return parsedPackage;
  }

  return decryptBackupPackage(parsedPackage, options.password || "");
}

export async function restoreBackupPackage(backupPackage, storage, indexedDbOptions = {}) {
  validateBackupPackage(backupPackage);
  await replaceIndexedDbAttachmentCopies(backupPackage.attachmentCopies, indexedDbOptions);
  writeKnowledgeStorePayload(JSON.stringify(backupPackage.store), storage);

  return backupPackage.store;
}

export async function listIndexedDbAttachmentCopies(options = {}) {
  const indexedDbFactory = options.indexedDB ?? globalThis.indexedDB;

  if (!indexedDbFactory) return [];

  const databaseName = options.databaseName || ATTACHMENT_DATABASE_NAME;
  const storeName = options.storeName || ATTACHMENT_STORE_NAME;
  const database = await openIndexedDbDatabase(indexedDbFactory, databaseName, storeName);
  const records = await readAllRecords(database, storeName);

  return records.map((record) => ({
    storageKey: record.storageKey,
    manifest: record.manifest,
    bytesBase64: encodeBase64(record.bytes || []),
  }));
}

export async function replaceIndexedDbAttachmentCopies(records = [], options = {}) {
  const indexedDbFactory = options.indexedDB ?? globalThis.indexedDB;

  if (!indexedDbFactory) {
    if (records.length === 0) return;
    throw new Error("IndexedDB 不可用，无法恢复附件副本。");
  }

  const databaseName = options.databaseName || ATTACHMENT_DATABASE_NAME;
  const storeName = options.storeName || ATTACHMENT_STORE_NAME;
  const database = await openIndexedDbDatabase(indexedDbFactory, databaseName, storeName);
  const transaction = database.transaction(storeName, "readwrite");
  const objectStore = transaction.objectStore(storeName);

  await requestToPromise(objectStore.clear());

  for (const record of records) {
    await requestToPromise(
      objectStore.put({
        storageKey: record.storageKey,
        manifest: record.manifest,
        bytes: Array.from(decodeBase64(record.bytesBase64 || "")),
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  if (transaction.done) {
    await transaction.done;
  }
}

export function summarizeBackupPackage(backupPackage) {
  validateBackupPackage(backupPackage);

  return {
    exportedAt: backupPackage.exportedAt,
    entityCount: backupPackage.store.entities.length,
    relationshipCount: backupPackage.store.edges.length,
    attachmentCount: backupPackage.store.attachments.length,
    attachmentCopyCount: backupPackage.attachmentCopies.length,
  };
}

function validateBackupPackage(backupPackage) {
  if (!backupPackage || typeof backupPackage !== "object") {
    throw new Error("备份文件格式不正确。");
  }
  if (backupPackage.format !== BACKUP_FORMAT) {
    throw new Error("备份文件不是 Graph Atlas 备份。");
  }
  if (backupPackage.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error("备份版本不受支持。");
  }
  if (!Array.isArray(backupPackage.attachmentCopies)) {
    throw new Error("备份附件副本清单缺失。");
  }

  assertValidStore(backupPackage.store);
}

async function decryptBackupPackage(encryptedPackage, password) {
  validateEncryptedBackupPackage(encryptedPackage);
  assertBackupPassword(password);

  try {
    const salt = decodeBase64(encryptedPackage.encryption.saltBase64);
    const iv = decodeBase64(encryptedPackage.encryption.ivBase64);
    const ciphertext = decodeBase64(encryptedPackage.ciphertextBase64);
    const key = await deriveBackupKey(password, salt);
    const plaintext = await getBackupCrypto().subtle.decrypt(
      { name: BACKUP_ENCRYPTION_ALGORITHM, iv },
      key,
      ciphertext,
    );
    const backupPackage = JSON.parse(new TextDecoder().decode(plaintext));

    validateBackupPackage(backupPackage);

    return backupPackage;
  } catch (error) {
    if (error.message === "备份密码不能为空。") {
      throw error;
    }

    throw new Error("备份密码不正确或文件已损坏。");
  }
}

function validateEncryptedBackupPackage(encryptedPackage) {
  if (!encryptedPackage || typeof encryptedPackage !== "object") {
    throw new Error("备份文件格式不正确。");
  }
  if (encryptedPackage.format !== ENCRYPTED_BACKUP_FORMAT) {
    throw new Error("备份文件不是 Graph Atlas 备份。");
  }
  if (encryptedPackage.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error("备份版本不受支持。");
  }
  if (!encryptedPackage.encryption || typeof encryptedPackage.encryption !== "object") {
    throw new Error("加密备份参数缺失。");
  }
  if (
    encryptedPackage.encryption.algorithm !== BACKUP_ENCRYPTION_ALGORITHM ||
    encryptedPackage.encryption.kdf !== BACKUP_ENCRYPTION_KDF ||
    encryptedPackage.encryption.iterations !== BACKUP_ENCRYPTION_ITERATIONS
  ) {
    throw new Error("加密备份参数不受支持。");
  }
  if (
    !encryptedPackage.encryption.saltBase64 ||
    !encryptedPackage.encryption.ivBase64 ||
    !encryptedPackage.ciphertextBase64
  ) {
    throw new Error("加密备份内容缺失。");
  }
}

function assertValidStore(store) {
  const validation = validateKnowledgeStore(store);

  if (!validation.valid) {
    throw new Error(`备份资料库校验失败：${validation.errors.join(" ")}`);
  }
}

function assertBackupPassword(password) {
  if (!String(password || "").trim()) {
    throw new Error("备份密码不能为空。");
  }
}

async function deriveBackupKey(password, salt) {
  const crypto = getBackupCrypto();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: BACKUP_ENCRYPTION_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: BACKUP_ENCRYPTION_ALGORITHM, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function getBackupCrypto() {
  const crypto = globalThis.crypto;

  if (!crypto?.subtle || typeof crypto.getRandomValues !== "function") {
    throw new Error("当前浏览器不支持加密备份。");
  }

  return crypto;
}

function parseJsonBackupPackage(jsonText) {
  try {
    return JSON.parse(jsonText);
  } catch {
    throw new Error("备份文件不是有效 JSON。");
  }
}

function openIndexedDbDatabase(indexedDbFactory, databaseName, storeName) {
  const request = indexedDbFactory.open(databaseName, 1);

  request.onupgradeneeded = () => {
    const database = request.result;

    if (!database.objectStoreNames?.contains?.(storeName)) {
      database.createObjectStore(storeName, { keyPath: "storageKey" });
    }
  };

  return requestToPromise(request);
}

async function readAllRecords(database, storeName) {
  const objectStore = database.transaction(storeName, "readonly").objectStore(storeName);

  if (typeof objectStore.getAll === "function") {
    return requestToPromise(objectStore.getAll());
  }

  return new Promise((resolve, reject) => {
    const records = [];
    const request = objectStore.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        resolve(records);
        return;
      }

      records.push(cursor.value);
      cursor.continue();
    };
    request.onerror = () => reject(request.error || new Error("IndexedDB cursor failed."));
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

function encodeBase64(bytes) {
  const normalizedBytes = Array.from(bytes);
  let binary = "";

  for (const byte of normalizedBytes) {
    binary += String.fromCharCode(byte);
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  return Buffer.from(normalizedBytes).toString("base64");
}

function decodeBase64(value) {
  if (!value) return new Uint8Array();

  if (typeof atob === "function") {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  }

  return new Uint8Array(Buffer.from(value, "base64"));
}
