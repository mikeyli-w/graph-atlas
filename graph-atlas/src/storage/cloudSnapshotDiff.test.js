import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { summarizeCloudSnapshotDiff } from "./cloudSnapshotDiff.js";

describe("summarizeCloudSnapshotDiff", () => {
  it("summarizes count-only remote snapshots without guessing conflicts", () => {
    expect(
      summarizeCloudSnapshotDiff(seedKnowledgeStore, {
        snapshotId: "summary-only",
        summary: {
          entityCount: 15,
          relationshipCount: 24,
          attachmentCount: 13,
        },
      }),
    ).toEqual({
      mode: "summary-only",
      localEntityCount: seedKnowledgeStore.entities.length,
      remoteEntityCount: 15,
      addedRemoteTitles: [],
      missingRemoteTitles: [],
      possibleConflictTitles: [],
      warningLabel: "只能预览数量差异，无法判断具体冲突。",
    });
  });

  it("detects remote additions, local-only entries and updated matching entities", () => {
    const localStore = {
      ...seedKnowledgeStore,
      entities: [
        ...seedKnowledgeStore.entities,
        {
          ...seedKnowledgeStore.entities[0],
          id: "local-health-note",
          title: "本地体检记录",
          updatedAt: "2026-07-01T02:00:00.000Z",
        },
      ],
    };
    const remoteStore = {
      ...seedKnowledgeStore,
      entities: [
        ...seedKnowledgeStore.entities
          .map((entity) =>
            entity.id === "passport"
              ? {
                  ...entity,
                  title: "护照",
                  updatedAt: "2026-07-01T03:00:00.000Z",
                }
              : entity,
          ),
        {
          ...seedKnowledgeStore.entities[0],
          id: "remote-insurance",
          title: "远端保险资料",
          updatedAt: "2026-07-01T04:00:00.000Z",
        },
      ],
    };

    expect(summarizeCloudSnapshotDiff(localStore, { store: remoteStore })).toEqual({
      mode: "store-diff",
      localEntityCount: seedKnowledgeStore.entities.length + 1,
      remoteEntityCount: seedKnowledgeStore.entities.length + 1,
      addedRemoteTitles: ["远端保险资料"],
      missingRemoteTitles: ["本地体检记录"],
      possibleConflictTitles: ["护照"],
      warningLabel: "发现远端差异；当前只预览，不会自动合并或覆盖。",
    });
  });

  it("returns an incompatible summary for invalid remote stores", () => {
    const diff = summarizeCloudSnapshotDiff(seedKnowledgeStore, {
      store: {
        ...seedKnowledgeStore,
        version: "future-store",
      },
    });

    expect(diff).toEqual(
      expect.objectContaining({
        mode: "incompatible",
        localEntityCount: seedKnowledgeStore.entities.length,
        remoteEntityCount: seedKnowledgeStore.entities.length,
        addedRemoteTitles: [],
        missingRemoteTitles: [],
        possibleConflictTitles: [],
      }),
    );
    expect(diff.warningLabel).toContain("远端快照需检查");
    expect(diff.warningLabel).toContain("Expected version v1_knowledge_store");
  });
});
