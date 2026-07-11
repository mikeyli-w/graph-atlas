import { vaultTree } from "../data/seedKnowledgeStore.js";

export function selectVaultTreeViewModel(store) {
  const entityByTitle = new Map(
    store.entities.map((entity) => [entity.title, entity]),
  );

  return vaultTree.map((group) => ({
    label: group.label,
    children: group.children.map((title) => {
      const entity = entityByTitle.get(title);
      const available = Boolean(entity);

      return {
        title,
        entityId: entity?.id ?? null,
        available,
        statusLabel: available ? "已入库" : "待创建",
        statusDescription: available
          ? `${title} 已在知识库中`
          : `${title} 还没有对应资料，可先放入收集箱`,
      };
    }),
  }));
}

export function selectVaultTreeSummary(store) {
  const groups = selectVaultTreeViewModel(store);
  const children = groups.flatMap((group) => group.children);
  const totalCount = children.length;
  const availableCount = children.filter((child) => child.available).length;
  const missingCount = totalCount - availableCount;

  return {
    totalCount,
    availableCount,
    missingCount,
    label: missingCount === 0
      ? `${availableCount}/${totalCount} 已入库`
      : `${availableCount}/${totalCount} 已入库 · ${missingCount} 个待创建`,
    status: missingCount === 0 ? "complete" : "incomplete",
  };
}
