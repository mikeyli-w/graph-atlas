export function selectLayoutVersionViewModel(store) {
  const snapshots = Array.isArray(store.layoutSnapshots) ? store.layoutSnapshots : [];
  const currentPositions = new Map(
    store.entities.map((entity) => [
      entity.id,
      {
        title: entity.title,
        x: entity.x,
        y: entity.y,
      },
    ]),
  );

  return {
    snapshots: snapshots.map((snapshot) => {
      const differences = selectLayoutDifferences(snapshot, currentPositions);
      const differenceCount = differences.length;

      return {
        id: snapshot.id,
        title: snapshot.title,
        note: snapshot.note || "",
        createdAt: snapshot.createdAt,
        nodeCount: snapshot.positions.length,
        differenceCount,
        differenceLabel: differenceCount > 0 ? `${differenceCount} 个节点不同` : "与当前布局一致",
        differences,
        applyConfirmationLabel:
          differenceCount > 0
            ? `确认应用后将移动 ${differenceCount} 个节点`
            : "确认应用后保持当前布局",
        summary: `${snapshot.positions.length} 个节点`,
      };
    }),
    count: snapshots.length,
    hasSnapshots: snapshots.length > 0,
    nextTitle: `布局版本 ${snapshots.length + 1}`,
    summary: snapshots.length > 0 ? `已保存 ${snapshots.length} 个版本` : "暂无保存布局",
  };
}

function selectLayoutDifferences(snapshot, currentPositions) {
  return snapshot.positions
    .filter((position) => {
      const currentPosition = currentPositions.get(position.entityId);

      if (!currentPosition) return true;

      return (
        normalizePositionCoordinate(currentPosition.x) !== normalizePositionCoordinate(position.x) ||
        normalizePositionCoordinate(currentPosition.y) !== normalizePositionCoordinate(position.y)
      );
    })
    .map((position) => {
      const currentPosition = currentPositions.get(position.entityId);

      return {
        entityId: position.entityId,
        title: currentPosition?.title || "缺失节点",
        current: currentPosition
          ? formatPosition(currentPosition)
          : "当前无节点",
        saved: formatPosition(position),
      };
    });
}

function normalizePositionCoordinate(value) {
  return Math.round(Number(value) * 100) / 100;
}

function formatPosition(position) {
  return `${normalizePositionCoordinate(position.x)}, ${normalizePositionCoordinate(position.y)}`;
}
