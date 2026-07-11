export function createLayoutApplyState() {
  return {
    pendingSnapshotId: "",
    undo: null,
  };
}

export function requestLayoutApply(state, snapshotId) {
  return {
    ...state,
    pendingSnapshotId: snapshotId,
  };
}

export function cancelLayoutApply(state) {
  return {
    ...state,
    pendingSnapshotId: "",
  };
}

export function markLayoutApplied(snapshot, positions) {
  return {
    pendingSnapshotId: "",
    undo: {
      title: snapshot.title,
      positions: positions.map((position) => ({ ...position })),
    },
  };
}

export function consumeLayoutUndo(state) {
  return {
    positions: state.undo?.positions.map((position) => ({ ...position })) || [],
    nextState: createLayoutApplyState(),
  };
}

export function clearLayoutApplyState() {
  return createLayoutApplyState();
}
