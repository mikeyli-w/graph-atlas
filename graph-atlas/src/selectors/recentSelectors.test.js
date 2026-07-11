import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectRecentViewModel } from "./recentSelectors.js";

describe("selectRecentViewModel", () => {
  it("shows a compact recent list by default", () => {
    const viewModel = selectRecentViewModel(seedKnowledgeStore);

    expect(viewModel.expanded).toBe(false);
    expect(viewModel.rows).toHaveLength(6);
    expect(viewModel.totalCount).toBe(seedKnowledgeStore.entities.length);
    expect(viewModel.visibleCount).toBe(6);
    expect(viewModel.toggleLabel).toBe("列表视图");
    expect(viewModel.summary).toBe("显示最近 6 条");
    expect(viewModel.rows[0]).toEqual(expect.objectContaining({ id: "passport" }));
  });

  it("expands to the full recent list", () => {
    const viewModel = selectRecentViewModel(seedKnowledgeStore, { expanded: true });

    expect(viewModel.expanded).toBe(true);
    expect(viewModel.rows).toHaveLength(seedKnowledgeStore.entities.length);
    expect(viewModel.visibleCount).toBe(seedKnowledgeStore.entities.length);
    expect(viewModel.toggleLabel).toBe("收起列表");
    expect(viewModel.summary).toBe(`已展开 ${seedKnowledgeStore.entities.length} 条最近更新`);
  });
});
