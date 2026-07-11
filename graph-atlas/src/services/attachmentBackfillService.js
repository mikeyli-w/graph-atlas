export async function backfillLargeFileCopies(store, files = [], storageAdapter) {
  if (!storageAdapter || typeof storageAdapter.store !== "function") {
    throw new Error("没有可用的附件存储 adapter。");
  }

  const pendingAttachments = store.attachments.filter(
    (attachment) => attachment.localCopy?.copyStatus === "skipped-too-large",
  );

  if (pendingAttachments.length === 0) {
    return {
      store,
      updatedCount: 0,
      skippedCount: Array.from(files).length,
      updatedAttachmentIds: [],
      updatedAttachmentNames: [],
    };
  }

  const pendingByName = new Map(pendingAttachments.map((attachment) => [attachment.name, attachment]));
  const updates = new Map();

  for (const file of Array.from(files)) {
    const attachment = pendingByName.get(file?.name) ||
      (pendingAttachments.length === 1 ? pendingAttachments[0] : null);

    if (!attachment || updates.has(attachment.id)) continue;

    const localCopy = await storageAdapter.store(file, {
      storageKey: attachment.reference || attachment.localCopy?.storageKey,
    });

    if (localCopy?.copyStatus === "skipped-too-large") continue;

    updates.set(attachment.id, localCopy);
  }

  if (updates.size === 0) {
    throw new Error("没有补拷贝成功的附件；请先配置本地附件目录或后端上传 adapter，并选择对应原文件。");
  }

  const updatedAt = new Date().toISOString();

  return {
    store: {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt,
      },
      attachments: store.attachments.map((attachment) =>
        updates.has(attachment.id)
          ? {
              ...attachment,
              localCopy: updates.get(attachment.id),
            }
          : attachment,
      ),
      updatedAt,
    },
    updatedCount: updates.size,
    skippedCount: Math.max(0, Array.from(files).length - updates.size),
    updatedAttachmentIds: Array.from(updates.keys()),
    updatedAttachmentNames: Array.from(updates.keys()).map(
      (attachmentId) => pendingAttachments.find((attachment) => attachment.id === attachmentId)?.name || attachmentId,
    ),
  };
}
