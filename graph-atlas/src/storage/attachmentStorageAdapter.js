export const DEFAULT_ATTACHMENT_COPY_BYTE_LIMIT = 256 * 1024;
export const DEFAULT_INDEXED_DB_ATTACHMENT_COPY_BYTE_LIMIT = 5 * 1024 * 1024;
export const DEFAULT_ATTACHMENT_DATABASE_NAME = "graph-atlas-attachments";
export const DEFAULT_ATTACHMENT_STORE_NAME = "attachmentCopies";
export const DEFAULT_ATTACHMENT_DIRECTORY_DATABASE_NAME = "graph-atlas-attachment-directory";
export const DEFAULT_ATTACHMENT_DIRECTORY_STORE_NAME = "directoryHandles";
export const ATTACHMENT_DIRECTORY_HANDLE_ID = "attachment-directory";

export function createLocalAttachmentReference(file) {
  const name = String(file?.name || "unnamed-file").trim() || "unnamed-file";
  const size = Number(file?.size);
  const modified = Number(file?.lastModified);
  const params = new URLSearchParams();

  if (Number.isFinite(size) && size > 0) {
    params.set("size", String(size));
  }
  if (Number.isFinite(modified) && modified > 0) {
    params.set("modified", String(modified));
  }

  const query = params.toString();

  return `local-library://graph-atlas/attachments/${encodeURIComponent(name)}${
    query ? `?${query}` : ""
  }`;
}

export function createInlineAttachmentStorageAdapter(options = {}) {
  const byteLimit = options.byteLimit || DEFAULT_ATTACHMENT_COPY_BYTE_LIMIT;

  return {
    async store(file, metadata = {}) {
      const byteSize = Number(file?.size);
      const normalizedByteSize = Number.isFinite(byteSize) && byteSize > 0 ? byteSize : 0;
      const baseManifest = {
        storageKey: metadata.storageKey || createLocalAttachmentReference(file),
        mimeType: file?.type || "application/octet-stream",
        byteSize: normalizedByteSize,
        contentHash: "",
        contentEncoding: "",
        contentBase64: "",
        textPreview: "",
        copyStatus: "stored",
        copyLimitBytes: byteLimit,
      };

      if (normalizedByteSize > byteLimit) {
        return {
          ...baseManifest,
          copyStatus: "skipped-too-large",
        };
      }

      const text = typeof file?.text === "function" ? await file.text() : "";
      const bytes = await readFileBytes(file, text);

      return {
        ...baseManifest,
        byteSize: normalizedByteSize || bytes.length,
        contentHash: createContentHash(bytes),
        contentEncoding: "base64",
        contentBase64: encodeBase64(bytes),
        textPreview: text.slice(0, 500),
      };
    },
    async read() {
      return null;
    },
    async remove() {
      return undefined;
    },
    getCapabilities() {
      return {
        id: "inline-base64",
        label: "inline base64 回退",
        canStore: true,
        canRead: false,
        canRemove: false,
        maxBytes: byteLimit,
        persistence: "knowledge-store-json",
        configured: true,
      };
    },
  };
}

export function createIndexedDbAttachmentStorageAdapter(options = {}) {
  const indexedDbFactory = options.indexedDB || globalThis.indexedDB;
  const databaseName = options.databaseName || DEFAULT_ATTACHMENT_DATABASE_NAME;
  const storeName = options.storeName || DEFAULT_ATTACHMENT_STORE_NAME;
  const byteLimit = options.byteLimit || DEFAULT_INDEXED_DB_ATTACHMENT_COPY_BYTE_LIMIT;

  return {
    async store(file, metadata = {}) {
      if (!indexedDbFactory) {
        throw new Error("IndexedDB is not available.");
      }

      const byteSize = Number(file?.size);
      const normalizedByteSize = Number.isFinite(byteSize) && byteSize > 0 ? byteSize : 0;
      const storageKey = metadata.storageKey || createLocalAttachmentReference(file);
      const baseManifest = {
        storageKey,
        mimeType: file?.type || "application/octet-stream",
        byteSize: normalizedByteSize,
        contentHash: "",
        contentEncoding: "",
        contentBase64: "",
        textPreview: "",
        copyStatus: "stored-indexeddb",
        copyLimitBytes: byteLimit,
      };

      if (normalizedByteSize > byteLimit) {
        return {
          ...baseManifest,
          copyStatus: "skipped-too-large",
        };
      }

      const text = typeof file?.text === "function" ? await file.text() : "";
      const bytes = await readFileBytes(file, text);
      const manifest = {
        ...baseManifest,
        byteSize: normalizedByteSize || bytes.length,
        contentHash: createContentHash(bytes),
        contentEncoding: "indexeddb",
        textPreview: text.slice(0, 500),
      };

      await writeIndexedDbAttachmentCopy(indexedDbFactory, databaseName, storeName, {
        storageKey,
        bytes,
        manifest,
      });

      return manifest;
    },
    async read(storageKey) {
      if (!indexedDbFactory) {
        throw new Error("IndexedDB is not available.");
      }

      return readIndexedDbAttachmentCopy(indexedDbFactory, databaseName, storeName, storageKey);
    },
    async remove(storageKey) {
      if (!indexedDbFactory) {
        throw new Error("IndexedDB is not available.");
      }

      await removeIndexedDbAttachmentCopy(indexedDbFactory, databaseName, storeName, storageKey);
    },
    getCapabilities() {
      return {
        id: "indexeddb",
        label: "IndexedDB 附件副本",
        canStore: Boolean(indexedDbFactory),
        canRead: Boolean(indexedDbFactory),
        canRemove: Boolean(indexedDbFactory),
        maxBytes: byteLimit,
        persistence: "browser-indexeddb",
        configured: Boolean(indexedDbFactory),
      };
    },
  };
}

export function createFileSystemAttachmentStorageAdapter(options = {}) {
  const directoryHandle = options.directoryHandle || null;
  const permissionState = options.permissionState || "unknown";

  return {
    async store(file, metadata = {}) {
      if (!directoryHandle) {
        throw new Error("本地附件目录未配置。");
      }

      const permission = await requestAttachmentDirectoryPermission(directoryHandle);

      if (permission !== "granted") {
        throw new Error("本地附件目录未授权。");
      }

      const text = typeof file?.text === "function" ? await file.text() : "";
      const bytes = await readFileBytes(file, text);
      const contentHash = createContentHash(bytes);
      const fileName = createFileSystemAttachmentFileName(file, contentHash);
      const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();

      await writable.write(bytes);
      await writable.close();

      return {
        storageKey: createFileSystemAttachmentStorageKey(fileName),
        mimeType: file?.type || "application/octet-stream",
        byteSize: Number(file?.size) || bytes.length,
        contentHash,
        contentEncoding: "file-system",
        contentBase64: "",
        textPreview: text.slice(0, 500),
        copyStatus: "stored-file-system",
        copyLimitBytes: 0,
      };
    },
    async read(storageKey) {
      if (!directoryHandle) {
        throw new Error("本地附件目录未配置。");
      }

      const fileName = parseFileSystemAttachmentFileName(storageKey);
      const fileHandle = await directoryHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const text = typeof file?.text === "function" ? await file.text() : "";
      const bytes = await readFileBytes(file, text);

      return {
        bytes: Array.from(bytes),
        manifest: {
          storageKey,
          mimeType: file?.type || "application/octet-stream",
          byteSize: Number(file?.size) || bytes.length,
          contentHash: createContentHash(bytes),
          contentEncoding: "file-system",
          contentBase64: "",
          textPreview: text.slice(0, 500),
          copyStatus: "stored-file-system",
          copyLimitBytes: 0,
        },
      };
    },
    async remove(storageKey) {
      if (!directoryHandle) {
        throw new Error("本地附件目录未配置。");
      }

      await directoryHandle.removeEntry(parseFileSystemAttachmentFileName(storageKey));
    },
    getCapabilities() {
      return {
        id: "file-system",
        label: "文件系统 adapter",
        canStore: Boolean(directoryHandle) && permissionState !== "denied",
        canRead: Boolean(directoryHandle) && permissionState !== "denied",
        canRemove: Boolean(directoryHandle) && permissionState !== "denied",
        maxBytes: null,
        persistence: "external-file-system",
        configured: Boolean(directoryHandle) && permissionState !== "denied",
      };
    },
  };
}

export function createHttpAttachmentStorageAdapter(options = {}) {
  const endpoint = String(options.endpoint || "").trim();
  const token = String(options.token || "").trim();
  const fetchImpl = options.fetch || globalThis.fetch;

  return {
    async store(file, metadata = {}) {
      if (!endpoint) {
        throw new Error("后端上传 endpoint 未配置。");
      }
      if (typeof fetchImpl !== "function") {
        throw new Error("当前环境不支持后端上传请求。");
      }

      const text = typeof file?.text === "function" ? await file.text() : "";
      const bytes = await readFileBytes(file, text);
      const contentHash = createContentHash(bytes);
      const storageKey = metadata.storageKey || createLocalAttachmentReference(file);
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          storageKey,
          fileName: file?.name || "",
          mimeType: file?.type || "application/octet-stream",
          byteSize: Number(file?.size) || bytes.length,
          contentHash,
          textPreview: text.slice(0, 500),
          bytesBase64: encodeBase64(bytes),
        }),
      });

      if (!response.ok) {
        throw new Error(`后端上传失败：${response.status}`);
      }

      const payload = typeof response.json === "function" ? await response.json() : {};

      return {
        storageKey: payload.storageKey || `remote://graph-atlas/attachments/${contentHash}`,
        mimeType: file?.type || "application/octet-stream",
        byteSize: Number(file?.size) || bytes.length,
        contentHash: payload.contentHash || contentHash,
        contentEncoding: "remote",
        contentBase64: "",
        textPreview: payload.textPreview || text.slice(0, 500),
        copyStatus: "stored-remote",
        copyLimitBytes: 0,
      };
    },
    async read(storageKey) {
      if (!endpoint || typeof fetchImpl !== "function") return null;

      const url = new URL(endpoint, globalThis.location?.href || "http://127.0.0.1/");

      url.searchParams.set("storageKey", storageKey);

      const response = await fetchImpl(url.toString(), {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) return null;

      return response.json();
    },
    async remove(storageKey) {
      if (!endpoint || typeof fetchImpl !== "function") return undefined;

      await fetchImpl(endpoint, {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ storageKey }),
      });
    },
    getCapabilities() {
      return {
        id: "backend-sync",
        label: "后端同步 adapter",
        canStore: Boolean(endpoint && fetchImpl),
        canRead: Boolean(endpoint && fetchImpl),
        canRemove: Boolean(endpoint && fetchImpl),
        maxBytes: null,
        persistence: "remote-backend",
        configured: Boolean(endpoint),
      };
    },
  };
}

export function createBrowserAttachmentStorageAdapter(options = {}) {
  const indexedDbFactory = options.indexedDB ?? globalThis.indexedDB;
  const inlineAdapter = createInlineAttachmentStorageAdapter(options.inlineOptions || {});
  const directoryHandle = options.directoryHandle || null;
  const fileSystemAdapter = directoryHandle
    ? createFileSystemAttachmentStorageAdapter({
        directoryHandle,
        permissionState: options.fileSystemPermissionState,
      })
    : null;
  const remoteAdapter = options.remote?.endpoint
    ? createHttpAttachmentStorageAdapter(options.remote)
    : null;
  const indexedDbByteLimit =
    options.byteLimit || DEFAULT_INDEXED_DB_ATTACHMENT_COPY_BYTE_LIMIT;

  const storeExternalLargeFile = async (file, metadata) => {
    const byteSize = Number(file?.size);

    if (!Number.isFinite(byteSize) || byteSize <= indexedDbByteLimit) return null;

    if (fileSystemAdapter) {
      try {
        return await fileSystemAdapter.store(file, metadata);
      } catch {
        // Keep trying lower-priority external adapters before falling back to indexeddb/inline.
      }
    }

    if (remoteAdapter) {
      try {
        return await remoteAdapter.store(file, metadata);
      } catch {
        return null;
      }
    }

    return null;
  };

  if (indexedDbFactory) {
    const indexedDbAdapter = createIndexedDbAttachmentStorageAdapter({
      ...options,
      indexedDB: indexedDbFactory,
    });

    return {
      async store(file, metadata = {}) {
        const externalManifest = await storeExternalLargeFile(file, metadata);

        if (externalManifest) return externalManifest;

        try {
          return await indexedDbAdapter.store(file, metadata);
        } catch {
          return inlineAdapter.store(file, metadata);
        }
      },
      read(storageKey) {
        if (String(storageKey).startsWith("file-system://")) {
          return fileSystemAdapter?.read(storageKey) || Promise.resolve(null);
        }
        if (String(storageKey).startsWith("remote://")) {
          return remoteAdapter?.read(storageKey) || Promise.resolve(null);
        }

        return indexedDbAdapter.read(storageKey);
      },
      remove(storageKey) {
        if (String(storageKey).startsWith("file-system://")) {
          return fileSystemAdapter?.remove(storageKey) || Promise.resolve(undefined);
        }
        if (String(storageKey).startsWith("remote://")) {
          return remoteAdapter?.remove(storageKey) || Promise.resolve(undefined);
        }

        return indexedDbAdapter.remove(storageKey);
      },
      getCapabilities() {
        return {
          ...indexedDbAdapter.getCapabilities(),
          id: "browser-indexeddb",
          fallbackId: inlineAdapter.getCapabilities().id,
        };
      },
    };
  }

  return {
    async store(file, metadata = {}) {
      const externalManifest = await storeExternalLargeFile(file, metadata);

      if (externalManifest) return externalManifest;

      return inlineAdapter.store(file, metadata);
    },
    read(storageKey) {
      if (String(storageKey).startsWith("file-system://")) {
        return fileSystemAdapter?.read(storageKey) || Promise.resolve(null);
      }
      if (String(storageKey).startsWith("remote://")) {
        return remoteAdapter?.read(storageKey) || Promise.resolve(null);
      }

      return inlineAdapter.read(storageKey);
    },
    remove(storageKey) {
      if (String(storageKey).startsWith("file-system://")) {
        return fileSystemAdapter?.remove(storageKey) || Promise.resolve(undefined);
      }
      if (String(storageKey).startsWith("remote://")) {
        return remoteAdapter?.remove(storageKey) || Promise.resolve(undefined);
      }

      return inlineAdapter.remove(storageKey);
    },
    getCapabilities() {
      return inlineAdapter.getCapabilities();
    },
  };
}

export function selectAttachmentStorageCapabilities(options = {}) {
  const indexedDbFactory = options.indexedDB ?? globalThis.indexedDB;
  const indexedDbConfigured = Boolean(indexedDbFactory);
  const fileSystem = options.fileSystem || {};
  const fileSystemSupported = Boolean(
    fileSystem.supported ?? (typeof globalThis.showDirectoryPicker === "function"),
  );
  const fileSystemConfigured = Boolean(fileSystem.directoryHandle || fileSystem.configured);
  const fileSystemPermissionState = fileSystem.permissionState || "not-configured";
  const fileSystemReady = fileSystemSupported &&
    fileSystemConfigured &&
    fileSystemPermissionState === "granted";
  const backend = options.backend || {};
  const backendConfigured = Boolean(backend.endpoint);
  const backendStatus = backend.lastStatus || "idle";

  return [
    {
      id: "indexeddb",
      label: "IndexedDB 附件副本",
      canStore: indexedDbConfigured,
      canRead: indexedDbConfigured,
      canRemove: indexedDbConfigured,
      maxBytes: DEFAULT_INDEXED_DB_ATTACHMENT_COPY_BYTE_LIMIT,
      persistence: "browser-indexeddb",
      configured: indexedDbConfigured,
      statusLabel: indexedDbConfigured ? "可用" : "未启用",
      description: "当前浏览器附件副本主路径。",
    },
    {
      id: "local-backup",
      label: "本地备份包",
      canStore: true,
      canRead: true,
      canRemove: false,
      maxBytes: null,
      persistence: "download-json",
      configured: true,
      statusLabel: "可用",
      description: "导出 knowledge store 与 IndexedDB 附件副本，可选择明文或密码加密 JSON。",
    },
    {
      id: "inline-base64",
      label: "inline base64 回退",
      canStore: true,
      canRead: false,
      canRemove: false,
      maxBytes: DEFAULT_ATTACHMENT_COPY_BYTE_LIMIT,
      persistence: "knowledge-store-json",
      configured: true,
      statusLabel: "回退",
      description: "仅用于 IndexedDB 不可用或失败时的小文件保底。",
    },
    {
      id: "file-system",
      label: "文件系统 adapter",
      canStore: fileSystemReady,
      canRead: fileSystemReady,
      canRemove: fileSystemReady,
      maxBytes: null,
      persistence: "external-file-system",
      configured: fileSystemReady,
      statusLabel: formatFileSystemCapabilityStatus(
        fileSystemSupported,
        fileSystemConfigured,
        fileSystemPermissionState,
      ),
      description: formatFileSystemCapabilityDescription(
        fileSystemSupported,
        fileSystemConfigured,
        fileSystemPermissionState,
      ),
    },
    {
      id: "backend-sync",
      label: "后端同步 adapter",
      canStore: backendConfigured,
      canRead: backendConfigured,
      canRemove: backendConfigured,
      maxBytes: null,
      persistence: "remote-backend",
      configured: backendConfigured,
      statusLabel: formatBackendCapabilityStatus(backendConfigured, backendStatus),
      description: backendConfigured
        ? "可选远端附件上传客户端已配置；当前不提供真实后端服务。"
        : "当前不会自动上传或云同步。",
    },
  ];
}

export async function loadAttachmentDirectoryHandle(options = {}) {
  const indexedDbFactory = options.indexedDB ?? globalThis.indexedDB;

  if (!indexedDbFactory) return null;

  const databaseName = options.databaseName || DEFAULT_ATTACHMENT_DIRECTORY_DATABASE_NAME;
  const storeName = options.storeName || DEFAULT_ATTACHMENT_DIRECTORY_STORE_NAME;
  const database = await openIndexedDbDatabase(indexedDbFactory, databaseName, storeName, "id");
  const record = await requestToPromise(
    database.transaction(storeName, "readonly").objectStore(storeName)
      .get(ATTACHMENT_DIRECTORY_HANDLE_ID),
  );

  return record?.directoryHandle || null;
}

export async function saveAttachmentDirectoryHandle(directoryHandle, options = {}) {
  const indexedDbFactory = options.indexedDB ?? globalThis.indexedDB;

  if (!indexedDbFactory) return false;

  const databaseName = options.databaseName || DEFAULT_ATTACHMENT_DIRECTORY_DATABASE_NAME;
  const storeName = options.storeName || DEFAULT_ATTACHMENT_DIRECTORY_STORE_NAME;
  const database = await openIndexedDbDatabase(indexedDbFactory, databaseName, storeName, "id");

  await requestToPromise(
    database.transaction(storeName, "readwrite").objectStore(storeName).put({
      id: ATTACHMENT_DIRECTORY_HANDLE_ID,
      directoryHandle,
      updatedAt: new Date().toISOString(),
    }),
  );

  return true;
}

export async function clearAttachmentDirectoryHandle(options = {}) {
  const indexedDbFactory = options.indexedDB ?? globalThis.indexedDB;

  if (!indexedDbFactory) return;

  const databaseName = options.databaseName || DEFAULT_ATTACHMENT_DIRECTORY_DATABASE_NAME;
  const storeName = options.storeName || DEFAULT_ATTACHMENT_DIRECTORY_STORE_NAME;
  const database = await openIndexedDbDatabase(indexedDbFactory, databaseName, storeName, "id");

  await requestToPromise(
    database.transaction(storeName, "readwrite").objectStore(storeName)
      .delete(ATTACHMENT_DIRECTORY_HANDLE_ID),
  );
}

export async function queryAttachmentDirectoryPermission(directoryHandle, mode = "readwrite") {
  if (!directoryHandle) return "not-configured";
  if (typeof directoryHandle.queryPermission !== "function") return "granted";

  return directoryHandle.queryPermission({ mode });
}

export async function requestAttachmentDirectoryPermission(directoryHandle, mode = "readwrite") {
  if (!directoryHandle) return "not-configured";

  const currentPermission = await queryAttachmentDirectoryPermission(directoryHandle, mode);

  if (currentPermission === "granted") return currentPermission;
  if (typeof directoryHandle.requestPermission !== "function") return currentPermission;

  return directoryHandle.requestPermission({ mode });
}

async function writeIndexedDbAttachmentCopy(indexedDbFactory, databaseName, storeName, record) {
  const database = await openIndexedDbDatabase(indexedDbFactory, databaseName, storeName);

  await requestToPromise(
    database.transaction(storeName, "readwrite").objectStore(storeName).put({
      storageKey: record.storageKey,
      bytes: Array.from(record.bytes),
      manifest: record.manifest,
      updatedAt: new Date().toISOString(),
    }),
  );
}

async function readIndexedDbAttachmentCopy(indexedDbFactory, databaseName, storeName, storageKey) {
  const database = await openIndexedDbDatabase(indexedDbFactory, databaseName, storeName);
  const record = await requestToPromise(
    database.transaction(storeName, "readonly").objectStore(storeName).get(storageKey),
  );

  if (!record) return null;

  return {
    bytes: record.bytes || [],
    manifest: record.manifest,
  };
}

async function removeIndexedDbAttachmentCopy(indexedDbFactory, databaseName, storeName, storageKey) {
  const database = await openIndexedDbDatabase(indexedDbFactory, databaseName, storeName);

  await requestToPromise(
    database.transaction(storeName, "readwrite").objectStore(storeName).delete(storageKey),
  );
}

function openIndexedDbDatabase(indexedDbFactory, databaseName, storeName, keyPath = "storageKey") {
  const request = indexedDbFactory.open(databaseName, 1);

  request.onupgradeneeded = () => {
    const database = request.result;

    if (!database.objectStoreNames?.contains?.(storeName)) {
      database.createObjectStore(storeName, { keyPath });
    }
  };

  return requestToPromise(request);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

async function readFileBytes(file, text) {
  if (typeof file?.arrayBuffer === "function") {
    return new Uint8Array(await file.arrayBuffer());
  }

  return new TextEncoder().encode(text);
}

function createContentHash(bytes) {
  let hash = 5381;

  for (const byte of bytes) {
    hash = ((hash * 33) ^ byte) >>> 0;
  }

  return `djb2-${hash.toString(16).padStart(8, "0")}`;
}

function createFileSystemAttachmentFileName(file, contentHash) {
  const rawName = String(file?.name || "attachment").trim() || "attachment";
  const safeName = rawName.replace(/[/:\\?%*"<>|]/g, "-").slice(0, 120) || "attachment";

  return `${contentHash}-${safeName}`;
}

function createFileSystemAttachmentStorageKey(fileName) {
  return `file-system://graph-atlas/attachments/${encodeURIComponent(fileName)}`;
}

function parseFileSystemAttachmentFileName(storageKey) {
  const value = String(storageKey || "");

  if (!value.startsWith("file-system://graph-atlas/attachments/")) {
    throw new Error("文件系统附件 storageKey 无效。");
  }

  return decodeURIComponent(value.replace("file-system://graph-atlas/attachments/", ""));
}

function formatFileSystemCapabilityStatus(supported, configured, permissionState) {
  if (!supported) return "浏览器不支持";
  if (!configured) return "未启用";
  if (permissionState === "granted") return "已授权";

  return "需重新授权";
}

function formatFileSystemCapabilityDescription(supported, configured, permissionState) {
  if (!supported) return "当前浏览器不支持 File System Access API。";
  if (!configured) return "选择本机附件目录后，大文件可保存完整副本；不会自动云同步。";
  if (permissionState === "granted") {
    return "大文件可保存到用户选择的本机附件目录；不会自动云同步。";
  }

  return "已保存目录授权记录，但当前需要重新授权后才能写入。";
}

function formatBackendCapabilityStatus(configured, status) {
  if (!configured) return "未配置";
  if (status === "success") return "最近成功";
  if (status === "error") return "上传失败";

  return "已配置";
}

function encodeBase64(bytes) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const triple = (first << 16) | ((second || 0) << 8) | (third || 0);

    output += alphabet[(triple >> 18) & 63];
    output += alphabet[(triple >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : "=";
    output += index + 2 < bytes.length ? alphabet[triple & 63] : "=";
  }

  return output;
}
