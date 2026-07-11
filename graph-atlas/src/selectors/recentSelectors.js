import { selectLegacyNodes } from "../data/seedKnowledgeStore.js";

const compactRecentLimit = 6;

export function selectRecentViewModel(store, options = {}) {
  const expanded = Boolean(options.expanded);
  const rows = selectLegacyNodes(store);
  const visibleRows = expanded ? rows : rows.slice(0, compactRecentLimit);

  return {
    expanded,
    rows: visibleRows,
    totalCount: rows.length,
    visibleCount: visibleRows.length,
    toggleLabel: expanded ? "收起列表" : "列表视图",
    summary: expanded
      ? `已展开 ${rows.length} 条最近更新`
      : `显示最近 ${Math.min(compactRecentLimit, rows.length)} 条`,
  };
}
