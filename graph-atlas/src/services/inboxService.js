import { knowledgeService } from "./knowledgeService.js";

export const inboxService = {
  addInboxEntry(store, input) {
    const title = input.title?.trim();
    const type = input.type?.trim();
    const privacy = input.privacy?.trim();

    if (!title) {
      throw new Error("标题必填");
    }
    if (!type) {
      throw new Error("类型必填");
    }
    if (!privacy) {
      throw new Error("隐私级别必填");
    }

    const updatedAt = new Date().toISOString();
    const entry = {
      id: `inbox-${Date.now()}`,
      title,
      type,
      privacy,
      summary: input.summary?.trim() || "",
      attachments: normalizeAttachmentInput(input.attachments),
      status: "pending",
      createdAt: updatedAt,
      updatedAt,
    };

    return {
      entryId: entry.id,
      store: {
        ...store,
        metadata: {
          ...store.metadata,
          updatedAt,
        },
        inbox: [...store.inbox, entry],
        updatedAt,
      },
    };
  },

  confirmInboxEntry(store, entryId, input = {}) {
    const entry = store.inbox.find((item) => item.id === entryId);
    if (!entry) {
      throw new Error("待整理资料不存在");
    }

    const draft = {
      ...entry,
      ...input,
      attachments: "attachments" in input ? input.attachments : entry.attachments,
    };

    const result = knowledgeService.addEntity(
      {
        ...store,
        inbox: store.inbox.filter((item) => item.id !== entryId),
      },
      {
        title: draft.title,
        type: draft.type,
        privacy: draft.privacy,
        summary: draft.summary,
        attachments: draft.attachments,
        lifecycleStatus: "saved",
      },
    );

    return result;
  },

  rejectInboxEntry(store, entryId) {
    const entry = store.inbox.find((item) => item.id === entryId);
    if (!entry) {
      throw new Error("待整理资料不存在");
    }

    const updatedAt = new Date().toISOString();

    return {
      store: {
        ...store,
        metadata: {
          ...store.metadata,
          updatedAt,
        },
        inbox: store.inbox.map((item) =>
          item.id === entryId
            ? {
                ...item,
                status: "rejected",
                updatedAt,
              }
            : item,
        ),
        updatedAt,
      },
    };
  },
};

function normalizeAttachmentInput(attachments) {
  if (Array.isArray(attachments)) {
    return attachments
      .map((attachment) => ({
        name: attachment.name?.trim(),
        size: attachment.size?.trim() || "索引",
        date: attachment.date?.trim() || "今天",
        reference: attachment.reference?.trim() || "",
        localCopy: normalizeLocalCopy(attachment.localCopy),
      }))
      .filter((attachment) => attachment.name);
  }

  if (typeof attachments !== "string") return [];

  return attachments
    .split(/[\n,，]+/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      size: "索引",
      date: "今天",
      reference: "",
      localCopy: null,
    }));
}

function normalizeLocalCopy(localCopy) {
  if (!localCopy || typeof localCopy !== "object") return null;

  return {
    storageKey: String(localCopy.storageKey || ""),
    mimeType: String(localCopy.mimeType || "application/octet-stream"),
    byteSize: Number(localCopy.byteSize) || 0,
    contentHash: String(localCopy.contentHash || ""),
    contentEncoding: String(localCopy.contentEncoding || ""),
    contentBase64: String(localCopy.contentBase64 || ""),
    textPreview: String(localCopy.textPreview || ""),
    copyStatus: String(localCopy.copyStatus || ""),
    copyLimitBytes: Number(localCopy.copyLimitBytes) || 0,
  };
}
