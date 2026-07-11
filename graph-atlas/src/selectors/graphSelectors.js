import { selectRenderableEdges } from "../domain/relationships.js";

export function selectGraphViewModel(store) {
  return {
    edges: selectRenderableEdges(store).map((edge) => ({
      id: edge.id,
      fromId: edge.from.id,
      toId: edge.to.id,
      label: edge.label,
      from: {
        x: edge.from.x,
        y: edge.from.y,
      },
      to: {
        x: edge.to.x,
        y: edge.to.y,
      },
    })),
  };
}
