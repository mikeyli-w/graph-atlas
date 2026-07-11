import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectGraphViewModel } from "./graphSelectors.js";

describe("selectGraphViewModel", () => {
  it("renders graph edges from the v1 edge collection", () => {
    const viewModel = selectGraphViewModel(seedKnowledgeStore);

    expect(viewModel.edges).toHaveLength(seedKnowledgeStore.edges.length);
    expect(viewModel.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromId: "passport",
          toId: "profile",
          label: "属于",
          from: expect.objectContaining({ x: 50, y: 47 }),
          to: expect.objectContaining({ x: 50, y: 17 }),
        }),
      ]),
    );
  });
});
