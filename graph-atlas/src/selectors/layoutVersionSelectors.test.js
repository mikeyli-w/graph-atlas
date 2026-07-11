import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectLayoutVersionViewModel } from "./layoutVersionSelectors.js";

describe("selectLayoutVersionViewModel", () => {
  it("returns an empty layout version state by default", () => {
    const viewModel = selectLayoutVersionViewModel(seedKnowledgeStore);

    expect(viewModel).toEqual({
      snapshots: [],
      count: 0,
      hasSnapshots: false,
      nextTitle: "布局版本 1",
      summary: "暂无保存布局",
    });
  });

  it("summarizes saved layout snapshots", () => {
    const store = {
      ...seedKnowledgeStore,
      layoutSnapshots: [
        {
          id: "layout-1",
          title: "旅行资料布局",
          note: "出行资料分组",
          createdAt: "2026-06-19T00:00:00.000Z",
          positions: [
            { entityId: "passport", x: 50, y: 47 },
            { entityId: "travel", x: 50, y: 68 },
          ],
        },
      ],
    };

    const viewModel = selectLayoutVersionViewModel(store);

    expect(viewModel).toEqual({
      snapshots: [
        {
          id: "layout-1",
          title: "旅行资料布局",
          note: "出行资料分组",
          createdAt: "2026-06-19T00:00:00.000Z",
          nodeCount: 2,
          differenceCount: 1,
          differenceLabel: "1 个节点不同",
          applyConfirmationLabel: "确认应用后将移动 1 个节点",
          differences: [
            {
              entityId: "travel",
              title: "旅行清单",
              current: "34, 78",
              saved: "50, 68",
            },
          ],
          summary: "2 个节点",
        },
      ],
      count: 1,
      hasSnapshots: true,
      nextTitle: "布局版本 2",
      summary: "已保存 1 个版本",
    });
  });

  it("reports layout versions that match the current node positions", () => {
    const passport = seedKnowledgeStore.entities.find((entity) => entity.id === "passport");
    const travel = seedKnowledgeStore.entities.find((entity) => entity.id === "travel");
    const store = {
      ...seedKnowledgeStore,
      layoutSnapshots: [
        {
          id: "layout-1",
          title: "当前布局",
          createdAt: "2026-06-19T00:00:00.000Z",
          positions: [
            { entityId: "passport", x: passport.x, y: passport.y },
            { entityId: "travel", x: travel.x, y: travel.y },
          ],
        },
      ],
    };

    expect(selectLayoutVersionViewModel(store).snapshots[0]).toEqual(
      expect.objectContaining({
        differenceCount: 0,
        differenceLabel: "与当前布局一致",
        applyConfirmationLabel: "确认应用后保持当前布局",
        differences: [],
      }),
    );
  });
});
