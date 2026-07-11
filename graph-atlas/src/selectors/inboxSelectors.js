export function selectInboxViewModel(store) {
  const pendingEntries = store.inbox
    .filter((entry) => entry.status === "pending")
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      type: entry.type,
      privacy: entry.privacy,
      summary: entry.summary || "暂无摘要",
      attachments: entry.attachments || [],
      attachmentCount: entry.attachments?.length || 0,
      statusLabel: "待整理",
      createdAt: entry.createdAt,
      confirmationPreview: {
        entityTitle: entry.title,
        documentTitle: `${entry.title} 内容`,
        sourceLabel: "手动创建",
        attachmentNames: (entry.attachments || []).map((attachment) => attachment.name),
      },
    }));

  return {
    pendingCount: pendingEntries.length,
    rejectedCount: store.inbox.filter((entry) => entry.status === "rejected").length,
    pendingEntries,
  };
}
