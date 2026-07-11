import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { backfillLargeFileCopies } from "./attachmentBackfillService.js";

describe("backfillLargeFileCopies", () => {
  it("updates skipped-too-large attachments with a stored local copy", async () => {
    const store = createStoreWithSkippedAttachment();
    const result = await backfillLargeFileCopies(
      store,
      [
        {
          name: "签证记录.pdf",
          type: "application/pdf",
          size: 6000000,
        },
      ],
      {
        async store(file) {
          return {
            storageKey: `file-system://graph-atlas/attachments/${file.name}`,
            mimeType: file.type,
            byteSize: file.size,
            contentHash: "djb2-backfill",
            contentEncoding: "file-system",
            contentBase64: "",
            textPreview: "",
            copyStatus: "stored-file-system",
            copyLimitBytes: 0,
          };
        },
      },
    );

    expect(result.updatedCount).toBe(1);
    expect(result.updatedAttachmentNames).toEqual(["签证记录.pdf"]);
    expect(result.store.attachments.find((attachment) => attachment.id === "att-passport-2"))
      .toEqual(
        expect.objectContaining({
          localCopy: expect.objectContaining({
            contentEncoding: "file-system",
            copyStatus: "stored-file-system",
          }),
        }),
      );
    expect(store.attachments.find((attachment) => attachment.id === "att-passport-2").localCopy)
      .toEqual(expect.objectContaining({ copyStatus: "skipped-too-large" }));
  });

  it("does not overwrite the store when no copy can be backfilled", async () => {
    const store = createStoreWithSkippedAttachment();

    await expect(
      backfillLargeFileCopies(
        store,
        [{ name: "签证记录.pdf", type: "application/pdf", size: 6000000 }],
        {
          async store() {
            return {
              storageKey: "local-library://graph-atlas/attachments/visa.pdf",
              mimeType: "application/pdf",
              byteSize: 6000000,
              contentHash: "",
              contentEncoding: "",
              contentBase64: "",
              textPreview: "",
              copyStatus: "skipped-too-large",
              copyLimitBytes: 5242880,
            };
          },
        },
      ),
    ).rejects.toThrow("没有补拷贝成功的附件");

    expect(store.attachments.find((attachment) => attachment.id === "att-passport-2").localCopy)
      .toEqual(expect.objectContaining({ copyStatus: "skipped-too-large" }));
  });
});

function createStoreWithSkippedAttachment() {
  return {
    ...seedKnowledgeStore,
    attachments: seedKnowledgeStore.attachments.map((attachment) =>
      attachment.id === "att-passport-2"
        ? {
            ...attachment,
            localCopy: {
              storageKey: "local-library://graph-atlas/attachments/visa.pdf",
              mimeType: "application/pdf",
              byteSize: 6000000,
              contentHash: "",
              contentEncoding: "",
              contentBase64: "",
              textPreview: "",
              copyStatus: "skipped-too-large",
              copyLimitBytes: 5242880,
            },
          }
        : attachment,
    ),
  };
}
