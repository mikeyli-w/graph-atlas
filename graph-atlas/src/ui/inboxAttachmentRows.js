import {
  createInlineAttachmentStorageAdapter,
  createLocalAttachmentReference,
} from "../storage/attachmentStorageAdapter.js";

const attachmentFields = new Set(["name", "size", "date", "reference"]);

export function createInboxAttachmentRows(attachments = []) {
  const rows = (Array.isArray(attachments) ? attachments : []).map((attachment, index) => ({
    id: `attachment-${index + 1}`,
    name: attachment.name || "",
    size: attachment.size || "",
    date: attachment.date || "",
    reference: attachment.reference || "",
    localCopy: attachment.localCopy || null,
  }));

  return rows.length > 0 ? rows : [createEmptyAttachmentRow(rows)];
}

export function addInboxAttachmentRow(rows = []) {
  return [...rows, createEmptyAttachmentRow(rows)];
}

export function addInboxAttachmentFileRows(rows = [], files = []) {
  const fileRows = Array.from(files).map((file, index) => ({
    id: createNextAttachmentRowId(rows, index + 1),
    name: file.name || "",
    size: formatFileSize(file.size),
    date: formatFileDate(file.lastModified),
    reference: createLocalAttachmentReference(file),
    localCopy: null,
  }));

  if (fileRows.length === 0) {
    return rows.length > 0 ? rows : [createEmptyAttachmentRow(rows)];
  }

  return [...rows, ...fileRows].filter((row, index, allRows) =>
    row.name || allRows.length === 1 || index < rows.length,
  );
}

export async function addInboxAttachmentFileRowsWithContent(
  rows = [],
  files = [],
  storageAdapter = createInlineAttachmentStorageAdapter(),
) {
  const fileRows = await Promise.all(
    Array.from(files).map(async (file, index) => {
      const reference = createLocalAttachmentReference(file);

      return {
        id: createNextAttachmentRowId(rows, index + 1),
        name: file.name || "",
        size: formatFileSize(file.size),
        date: formatFileDate(file.lastModified),
        reference,
        localCopy: await storageAdapter.store(file, { storageKey: reference }),
      };
    }),
  );

  if (fileRows.length === 0) {
    return rows.length > 0 ? rows : [createEmptyAttachmentRow(rows)];
  }

  return [...rows, ...fileRows].filter((row, index, allRows) =>
    row.name || allRows.length === 1 || index < rows.length,
  );
}

export function updateInboxAttachmentRow(rows = [], rowId, field, value) {
  if (!attachmentFields.has(field)) return rows;

  return rows.map((row) =>
    row.id === rowId
      ? {
          ...row,
          [field]: value,
        }
      : row,
  );
}

export function removeInboxAttachmentRow(rows = [], rowId) {
  const nextRows = rows.filter((row) => row.id !== rowId);

  return nextRows.length > 0 ? nextRows : [createEmptyAttachmentRow(rows)];
}

export function collectAttachmentRows(formData) {
  const names = formData.getAll("attachmentName");
  const sizes = formData.getAll("attachmentSize");
  const dates = formData.getAll("attachmentDate");
  const references = formData.getAll("attachmentReference");
  const localCopies = formData.getAll("attachmentLocalCopy") || [];

  return names.map((name, index) => ({
    name,
    size: sizes[index],
    date: dates[index],
    reference: references[index],
    localCopy: parseLocalCopy(localCopies[index]),
  }));
}

export function serializeAttachmentLocalCopy(localCopy) {
  if (!localCopy) return "";

  return JSON.stringify({
    storageKey: localCopy.storageKey || "",
    mimeType: localCopy.mimeType || "application/octet-stream",
    byteSize: Number(localCopy.byteSize) || 0,
    contentHash: localCopy.contentHash || "",
    contentEncoding: localCopy.contentEncoding || "",
    contentBase64: localCopy.contentBase64 || "",
    textPreview: localCopy.textPreview || "",
    copyStatus: localCopy.copyStatus || "",
    copyLimitBytes: Number(localCopy.copyLimitBytes) || 0,
  });
}

function createEmptyAttachmentRow(rows = []) {
  return {
    id: createNextAttachmentRowId(rows),
    name: "",
    size: "",
    date: "",
    reference: "",
    localCopy: null,
  };
}

function createNextAttachmentRowId(rows = [], offset = 1) {
  const nextIndex = rows.reduce((max, row) => {
    const idNumber = Number(String(row.id || "").replace(/^attachment-/, ""));
    return Number.isFinite(idNumber) ? Math.max(max, idNumber) : max;
  }, 0) + offset;

  return `attachment-${nextIndex}`;
}

function formatFileSize(size) {
  const bytes = Number(size);

  if (!Number.isFinite(bytes) || bytes <= 0) return "本地文件";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;

  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

function formatFileDate(lastModified) {
  const timestamp = Number(lastModified);

  if (!Number.isFinite(timestamp) || timestamp <= 0) return "今天";

  return new Date(timestamp).toISOString().slice(0, 10);
}

function parseLocalCopy(value) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);

    if (!parsed || typeof parsed !== "object") return null;

    return {
      storageKey: parsed.storageKey || "",
      mimeType: parsed.mimeType || "application/octet-stream",
      byteSize: Number(parsed.byteSize) || 0,
      contentHash: parsed.contentHash || "",
      contentEncoding: parsed.contentEncoding || "",
      contentBase64: parsed.contentBase64 || "",
      textPreview: parsed.textPreview || "",
      copyStatus: parsed.copyStatus || "",
      copyLimitBytes: Number(parsed.copyLimitBytes) || 0,
    };
  } catch {
    return null;
  }
}
