import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { createKnowledgeStoreRepository } from "../repositories/knowledgeStoreRepository.js";
import { selectGraphViewModel } from "../selectors/graphSelectors.js";
import { selectInboxViewModel } from "../selectors/inboxSelectors.js";
import { selectSearchViewModel } from "../selectors/searchSelectors.js";
import { inboxService } from "../services/inboxService.js";
import { knowledgeService } from "../services/knowledgeService.js";

describe("core workflow smoke", () => {
  it("turns a no-result search into an inbox add flow that can be found after confirmation", () => {
    const emptySearch = selectSearchViewModel(seedKnowledgeStore, createSearchFilters("酒店订单"));

    expect(emptySearch).toEqual(
      expect.objectContaining({
        hasNoResults: true,
        totalResults: 0,
      }),
    );

    const added = inboxService.addInboxEntry(seedKnowledgeStore, {
      title: "酒店订单",
      type: "文件",
      privacy: "低（可导出）",
      summary: "酒店订单摘要",
      attachments: "hotel-confirmation.pdf",
    });
    const inboxViewModel = selectInboxViewModel(added.store);

    expect(inboxViewModel.pendingEntries).toEqual([
      expect.objectContaining({
        id: added.entryId,
        title: "酒店订单",
        attachmentCount: 1,
        confirmationPreview: expect.objectContaining({
          entityTitle: "酒店订单",
          documentTitle: "酒店订单 内容",
          sourceLabel: "手动创建",
          attachmentNames: ["hotel-confirmation.pdf"],
        }),
      }),
    ]);
    expect(
      selectSearchViewModel(added.store, createSearchFilters("酒店订单")),
    ).toEqual(
      expect.objectContaining({
        hasNoResults: true,
        totalResults: 0,
      }),
    );

    const confirmed = inboxService.confirmInboxEntry(added.store, added.entryId);
    const materialSearch = selectSearchViewModel(
      confirmed.store,
      createSearchFilters("酒店订单"),
    );
    const attachmentSearch = selectSearchViewModel(
      confirmed.store,
      createSearchFilters("hotel-confirmation"),
    );

    expect(materialSearch.hasNoResults).toBe(false);
    expect(materialSearch.entityResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: confirmed.entityId,
          title: "酒店订单",
        }),
      ]),
    );
    expect(attachmentSearch.attachmentResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "hotel-confirmation.pdf",
          entityId: confirmed.entityId,
          entityTitle: "酒店订单",
        }),
      ]),
    );
    expect(attachmentSearch.visibleEntityIds).toContain(confirmed.entityId);
  });

  it("keeps a dragged node position in graph edges after repository reload", () => {
    const storage = createMemoryStorage();
    const repository = createKnowledgeStoreRepository(storage);
    const moved = knowledgeService.updateEntityPosition(repository.loadStore(), "passport", {
      x: 71.234,
      y: 33.876,
    });

    repository.saveStore(moved);

    const reloaded = createKnowledgeStoreRepository(storage).loadStore();
    const passport = reloaded.entities.find((entity) => entity.id === "passport");
    const graphViewModel = selectGraphViewModel(reloaded);
    const passportEdgePositions = graphViewModel.edges
      .filter((edge) => edge.fromId === "passport" || edge.toId === "passport")
      .map((edge) => (edge.fromId === "passport" ? edge.from : edge.to));

    expect(passport).toEqual(expect.objectContaining({ x: 71.23, y: 33.88 }));
    expect(passportEdgePositions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          x: 71.23,
          y: 33.88,
        }),
      ]),
    );
  });
});

function createSearchFilters(query) {
  return {
    query,
    tagFilter: "全部",
    privacyFilter: "全部隐私",
  };
}

function createMemoryStorage() {
  const entries = new Map();

  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
    removeItem(key) {
      entries.delete(key);
    },
    clear() {
      entries.clear();
    },
  };
}
