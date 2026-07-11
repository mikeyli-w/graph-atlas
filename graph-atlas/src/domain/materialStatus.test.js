import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectMaterialStatuses } from "./materialStatus.js";

describe("selectMaterialStatuses", () => {
  it("prioritizes AI invisible for high privacy passport material", () => {
    expect(selectMaterialStatuses(seedKnowledgeStore, "passport")[0]).toEqual(
      expect.objectContaining({
        id: "ai-invisible",
        label: "AI 不可见",
      }),
    );
  });

  it("shows missing attachments for material without attachment indexes", () => {
    expect(selectMaterialStatuses(seedKnowledgeStore, "wechat")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "missing-attachments",
          label: "缺附件",
        }),
      ]),
    );
  });

  it("shows needs-review for planned travel material", () => {
    expect(selectMaterialStatuses(seedKnowledgeStore, "travel")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "needs-review",
          label: "需检查",
        }),
      ]),
    );
  });

  it("shows pending for collected but unconfirmed material", () => {
    const pendingStore = {
      ...seedKnowledgeStore,
      entities: [
        ...seedKnowledgeStore.entities,
        {
          id: "draft-note",
          title: "待整理资料",
          type: "笔记",
          privacyLevel: "medium",
          aiAccess: false,
          tags: ["笔记"],
          lifecycleStatus: "pending",
        },
      ],
    };

    expect(selectMaterialStatuses(pendingStore, "draft-note")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pending",
          label: "待整理",
        }),
      ]),
    );
  });
});
