import { describe, expect, it } from "vitest";

import {
  addInboxAttachmentFileRows,
  addInboxAttachmentFileRowsWithContent,
  addInboxAttachmentRow,
  collectAttachmentRows,
  createInboxAttachmentRows,
  removeInboxAttachmentRow,
  serializeAttachmentLocalCopy,
  updateInboxAttachmentRow,
} from "./inboxAttachmentRows.js";

describe("inbox attachment rows", () => {
  it("creates rows from existing attachments or one empty row", () => {
    expect(
      createInboxAttachmentRows([
        {
          name: "酒店订单.pdf",
          size: "312 KB",
          date: "2026-06-18",
          reference: "/Users/me/Documents/hotel.pdf",
        },
      ]),
    ).toEqual([
      {
        id: "attachment-1",
        name: "酒店订单.pdf",
        size: "312 KB",
        date: "2026-06-18",
        reference: "/Users/me/Documents/hotel.pdf",
        localCopy: null,
      },
    ]);

    expect(createInboxAttachmentRows([])).toEqual([
      {
        id: "attachment-1",
        name: "",
        size: "",
        date: "",
        reference: "",
        localCopy: null,
      },
    ]);
  });

  it("adds, updates and removes editable rows while keeping one row available", () => {
    const rows = createInboxAttachmentRows([]);
    const added = addInboxAttachmentRow(rows);
    const updated = updateInboxAttachmentRow(added, "attachment-2", "name", "付款凭证.jpg");

    expect(updated).toEqual([
      expect.objectContaining({ id: "attachment-1", name: "" }),
      expect.objectContaining({ id: "attachment-2", name: "付款凭证.jpg" }),
    ]);
    expect(removeInboxAttachmentRow(updated, "attachment-1")).toEqual([
      expect.objectContaining({ id: "attachment-2", name: "付款凭证.jpg" }),
    ]);
    expect(removeInboxAttachmentRow(rows, "attachment-1")).toEqual([
      {
        id: "attachment-2",
        name: "",
        size: "",
        date: "",
        reference: "",
        localCopy: null,
      },
    ]);
  });

  it("adds selected local files as attachment rows", () => {
    const rows = createInboxAttachmentRows([]);
    const result = addInboxAttachmentFileRows(rows, [
      {
        name: "护照扫描件.pdf",
        size: 1536,
        lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
      },
    ]);

    expect(result).toEqual([
      expect.objectContaining({ id: "attachment-1", name: "" }),
      {
        id: "attachment-2",
        name: "护照扫描件.pdf",
        size: "1.5 KB",
        date: "2026-06-18",
        reference:
          "local-library://graph-atlas/attachments/%E6%8A%A4%E7%85%A7%E6%89%AB%E6%8F%8F%E4%BB%B6.pdf?size=1536&modified=1781784000000",
        localCopy: null,
      },
    ]);
    expect(addInboxAttachmentFileRows([], [])).toEqual([
      {
        id: "attachment-1",
        name: "",
        size: "",
        date: "",
        reference: "",
        localCopy: null,
      },
    ]);
  });

  it("reads selected local file bytes into a local copy manifest", async () => {
    const result = await addInboxAttachmentFileRowsWithContent(createInboxAttachmentRows([]), [
      {
        name: "binary.dat",
        type: "application/octet-stream",
        size: 4,
        lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
        arrayBuffer: async () => new Uint8Array([0, 1, 2, 255]).buffer,
        text: async () => "Binary preview",
      },
    ]);

    expect(result[1]).toEqual(
      expect.objectContaining({
        name: "binary.dat",
        reference:
          "local-library://graph-atlas/attachments/binary.dat?size=4&modified=1781784000000",
        localCopy: {
          storageKey:
            "local-library://graph-atlas/attachments/binary.dat?size=4&modified=1781784000000",
          mimeType: "application/octet-stream",
          byteSize: 4,
          contentHash: expect.stringMatching(/^djb2-[0-9a-f]{8}$/),
          contentEncoding: "base64",
          contentBase64: "AAEC/w==",
          textPreview: "Binary preview",
          copyStatus: "stored",
          copyLimitBytes: 262144,
        },
      }),
    );
  });

  it("skips local binary copies that exceed the size limit", async () => {
    const result = await addInboxAttachmentFileRowsWithContent(createInboxAttachmentRows([]), [
      {
        name: "large.zip",
        type: "application/zip",
        size: 262145,
        lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
        arrayBuffer: async () => {
          throw new Error("large files should not be read");
        },
        text: async () => {
          throw new Error("large files should not be read");
        },
      },
    ]);

    expect(result[1]).toEqual(
      expect.objectContaining({
        name: "large.zip",
        size: "256 KB",
        reference:
          "local-library://graph-atlas/attachments/large.zip?size=262145&modified=1781784000000",
        localCopy: {
          storageKey:
            "local-library://graph-atlas/attachments/large.zip?size=262145&modified=1781784000000",
          mimeType: "application/zip",
          byteSize: 262145,
          contentHash: "",
          contentEncoding: "",
          contentBase64: "",
          textPreview: "",
          copyStatus: "skipped-too-large",
          copyLimitBytes: 262144,
        },
      }),
    );
  });

  it("accepts a custom attachment storage adapter", async () => {
    const result = await addInboxAttachmentFileRowsWithContent(
      createInboxAttachmentRows([]),
      [
        {
          name: "external.pdf",
          type: "application/pdf",
          size: 1200,
          lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
        },
      ],
      {
        async store(_file, metadata) {
          return {
            storageKey: metadata.storageKey,
            mimeType: "application/pdf",
            byteSize: 1200,
            contentHash: "external-hash",
            contentEncoding: "",
            contentBase64: "",
            textPreview: "",
            copyStatus: "stored-external",
            copyLimitBytes: 0,
          };
        },
      },
    );

    expect(result[1]).toEqual(
      expect.objectContaining({
        name: "external.pdf",
        localCopy: expect.objectContaining({
          storageKey:
            "local-library://graph-atlas/attachments/external.pdf?size=1200&modified=1781784000000",
          copyStatus: "stored-external",
        }),
      }),
    );
  });

  it("round-trips IndexedDB local copy manifests through form fields", async () => {
    const rows = await addInboxAttachmentFileRowsWithContent(
      createInboxAttachmentRows([]),
      [
        {
          name: "passport.pdf",
          type: "application/pdf",
          size: 4096,
          lastModified: Date.parse("2026-06-18T12:00:00.000Z"),
        },
      ],
      {
        async store(_file, metadata) {
          return {
            storageKey: metadata.storageKey,
            mimeType: "application/pdf",
            byteSize: 4096,
            contentHash: "djb2-indexeddb",
            contentEncoding: "indexeddb",
            contentBase64: "",
            textPreview: "Passport preview",
            copyStatus: "stored-indexeddb",
            copyLimitBytes: 5242880,
          };
        },
      },
    );
    const indexedDbRow = rows[1];
    const formData = {
      getAll(name) {
        return {
          attachmentName: [indexedDbRow.name],
          attachmentSize: [indexedDbRow.size],
          attachmentDate: [indexedDbRow.date],
          attachmentReference: [indexedDbRow.reference],
          attachmentLocalCopy: [serializeAttachmentLocalCopy(indexedDbRow.localCopy)],
        }[name];
      },
    };

    expect(collectAttachmentRows(formData)).toEqual([
      {
        name: "passport.pdf",
        size: "4 KB",
        date: "2026-06-18",
        reference:
          "local-library://graph-atlas/attachments/passport.pdf?size=4096&modified=1781784000000",
        localCopy: {
          storageKey:
            "local-library://graph-atlas/attachments/passport.pdf?size=4096&modified=1781784000000",
          mimeType: "application/pdf",
          byteSize: 4096,
          contentHash: "djb2-indexeddb",
          contentEncoding: "indexeddb",
          contentBase64: "",
          textPreview: "Passport preview",
          copyStatus: "stored-indexeddb",
          copyLimitBytes: 5242880,
        },
      },
    ]);
  });

  it("collects attachment metadata from form data", () => {
    const formData = {
      getAll(name) {
        return {
          attachmentName: ["酒店订单.pdf", ""],
          attachmentSize: ["312 KB", "会被过滤"],
          attachmentDate: ["2026-06-18", "今天"],
          attachmentReference: ["/Users/me/Documents/hotel.pdf", ""],
          attachmentLocalCopy: [
            JSON.stringify({
              storageKey: "local-library://graph-atlas/attachments/hotel.pdf",
              mimeType: "application/pdf",
              byteSize: 319488,
              contentHash: "djb2-12345678",
              contentEncoding: "base64",
              contentBase64: "SG90ZWw=",
              textPreview: "酒店订单内容",
              copyStatus: "stored",
              copyLimitBytes: 262144,
            }),
            "",
          ],
        }[name];
      },
    };

    expect(collectAttachmentRows(formData)).toEqual([
      {
        name: "酒店订单.pdf",
        size: "312 KB",
        date: "2026-06-18",
        reference: "/Users/me/Documents/hotel.pdf",
        localCopy: {
          storageKey: "local-library://graph-atlas/attachments/hotel.pdf",
          mimeType: "application/pdf",
          byteSize: 319488,
          contentHash: "djb2-12345678",
          contentEncoding: "base64",
          contentBase64: "SG90ZWw=",
          textPreview: "酒店订单内容",
          copyStatus: "stored",
          copyLimitBytes: 262144,
        },
      },
      {
        name: "",
        size: "会被过滤",
        date: "今天",
        reference: "",
        localCopy: null,
      },
    ]);
  });
});
