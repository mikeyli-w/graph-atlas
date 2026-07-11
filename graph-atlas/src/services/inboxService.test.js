import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { inboxService } from "./inboxService.js";

describe("inboxService", () => {
  it("rejects an empty title", () => {
    expect(() =>
      inboxService.addInboxEntry(seedKnowledgeStore, {
        title: " ",
        type: "文件",
        privacy: "中（本地保存）",
      }),
    ).toThrow("标题必填");
  });

  it("keeps unconfirmed entries outside the formal graph", () => {
    const result = inboxService.addInboxEntry(seedKnowledgeStore, {
      title: "新酒店订单",
      type: "文件",
      privacy: "中（本地保存）",
      summary: "待确认订单信息",
      attachments: "酒店订单.pdf",
    });

    expect(result.store.inbox).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.entryId,
          title: "新酒店订单",
          status: "pending",
          attachments: [
            {
              name: "酒店订单.pdf",
              size: "索引",
              date: "今天",
              reference: "",
              localCopy: null,
            },
          ],
        }),
      ]),
    );
    expect(result.store.entities).toHaveLength(seedKnowledgeStore.entities.length);
    expect(result.store.documents).toHaveLength(seedKnowledgeStore.documents.length);
  });

  it("confirms an inbox entry into an entity and document", () => {
    const added = inboxService.addInboxEntry(seedKnowledgeStore, {
      title: "旅行保险单",
      type: "文件",
      privacy: "低（可导出）",
      summary: "保险单摘要",
    });

    const confirmed = inboxService.confirmInboxEntry(added.store, added.entryId);
    const entity = confirmed.store.entities.find((item) => item.id === confirmed.entityId);
    const document = confirmed.store.documents.find(
      (item) => item.entityId === confirmed.entityId,
    );

    expect(confirmed.store.inbox.find((item) => item.id === added.entryId)).toBeUndefined();
    expect(entity).toEqual(
      expect.objectContaining({
        title: "旅行保险单",
        type: "文件",
        lifecycleStatus: "saved",
        aiAccess: true,
      }),
    );
    expect(document).toEqual(
      expect.objectContaining({
        entityId: confirmed.entityId,
        body: "保险单摘要",
      }),
    );
  });

  it("allows editing fields and attachment metadata during confirmation", () => {
    const added = inboxService.addInboxEntry(seedKnowledgeStore, {
      title: "临时标题",
      type: "笔记",
      privacy: "中（本地保存）",
      summary: "临时摘要",
    });

    const confirmed = inboxService.confirmInboxEntry(added.store, added.entryId, {
      title: "酒店订单",
      type: "文件",
      privacy: "低（可导出）",
      summary: "正式订单摘要",
      attachments: [
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
          name: "付款凭证.jpg",
          size: "图片索引",
          date: "今天",
        },
        {
          name: "",
          size: "会被过滤",
          date: "今天",
        },
      ],
    });
    const entity = confirmed.store.entities.find((item) => item.id === confirmed.entityId);
    const attachments = confirmed.store.attachments.filter(
      (item) => item.entityId === confirmed.entityId,
    );

    expect(entity).toEqual(
      expect.objectContaining({
        title: "酒店订单",
        type: "文件",
        lifecycleStatus: "saved",
      }),
    );
    expect(attachments).toEqual([
      expect.objectContaining({
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
      }),
      expect.objectContaining({
        name: "付款凭证.jpg",
        size: "图片索引",
        date: "今天",
      }),
    ]);
  });

  it("rejects an inbox entry without adding it to the graph", () => {
    const added = inboxService.addInboxEntry(seedKnowledgeStore, {
      title: "不需要的资料",
      type: "笔记",
      privacy: "中（本地保存）",
    });

    const rejected = inboxService.rejectInboxEntry(added.store, added.entryId);

    expect(rejected.store.inbox.find((item) => item.id === added.entryId)).toEqual(
      expect.objectContaining({
        status: "rejected",
      }),
    );
    expect(rejected.store.entities).toHaveLength(seedKnowledgeStore.entities.length);
    expect(rejected.store.documents).toHaveLength(seedKnowledgeStore.documents.length);
  });
});
