import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectInboxViewModel } from "./inboxSelectors.js";

describe("selectInboxViewModel", () => {
  it("shows pending inbox entries only", () => {
    const store = {
      ...seedKnowledgeStore,
      inbox: [
        {
          id: "inbox-pending",
          title: "待整理酒店订单",
          type: "文件",
          privacy: "中（本地保存）",
          summary: "",
          attachments: [{ name: "酒店订单.pdf", size: "索引", date: "今天" }],
          status: "pending",
          createdAt: "2026-06-19T00:00:00.000Z",
        },
        {
          id: "inbox-confirmed",
          title: "已确认资料",
          type: "笔记",
          privacy: "低（可导出）",
          summary: "已处理",
          status: "confirmed",
          createdAt: "2026-06-19T00:00:00.000Z",
        },
        {
          id: "inbox-rejected",
          title: "已拒绝资料",
          type: "笔记",
          privacy: "中（本地保存）",
          summary: "不入库",
          status: "rejected",
          createdAt: "2026-06-19T00:00:00.000Z",
        },
      ],
    };

    expect(selectInboxViewModel(store)).toEqual({
      pendingCount: 1,
      rejectedCount: 1,
      pendingEntries: [
        {
          id: "inbox-pending",
          title: "待整理酒店订单",
          type: "文件",
          privacy: "中（本地保存）",
          summary: "暂无摘要",
          attachments: [{ name: "酒店订单.pdf", size: "索引", date: "今天" }],
          attachmentCount: 1,
          statusLabel: "待整理",
          createdAt: "2026-06-19T00:00:00.000Z",
          confirmationPreview: {
            entityTitle: "待整理酒店订单",
            documentTitle: "待整理酒店订单 内容",
            sourceLabel: "手动创建",
            attachmentNames: ["酒店订单.pdf"],
          },
        },
      ],
    });
  });
});
