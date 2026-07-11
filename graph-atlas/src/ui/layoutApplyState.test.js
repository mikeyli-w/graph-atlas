import { describe, expect, it } from "vitest";

import {
  cancelLayoutApply,
  clearLayoutApplyState,
  consumeLayoutUndo,
  createLayoutApplyState,
  markLayoutApplied,
  requestLayoutApply,
} from "./layoutApplyState.js";

describe("layout apply UI state", () => {
  it("tracks a pending layout application and allows cancellation", () => {
    const requested = requestLayoutApply(createLayoutApplyState(), "layout-1");

    expect(requested).toEqual({
      pendingSnapshotId: "layout-1",
      undo: null,
    });
    expect(cancelLayoutApply(requested)).toEqual(createLayoutApplyState());
  });

  it("stores a copy of previous positions after applying a layout", () => {
    const positions = [{ entityId: "passport", x: 42, y: 33 }];
    const applied = markLayoutApplied({ title: "旅行资料布局" }, positions);

    positions[0].x = 99;

    expect(applied).toEqual({
      pendingSnapshotId: "",
      undo: {
        title: "旅行资料布局",
        positions: [{ entityId: "passport", x: 42, y: 33 }],
      },
    });
  });

  it("consumes undo positions and clears the confirmation chain", () => {
    const applied = markLayoutApplied(
      { title: "旅行资料布局" },
      [{ entityId: "passport", x: 42, y: 33 }],
    );
    const consumed = consumeLayoutUndo(applied);

    expect(consumed).toEqual({
      positions: [{ entityId: "passport", x: 42, y: 33 }],
      nextState: createLayoutApplyState(),
    });
    expect(clearLayoutApplyState()).toEqual(createLayoutApplyState());
  });
});
