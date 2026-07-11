import { selectMaterialStatuses } from "../domain/materialStatus.js";

const travelCheckItems = [
  {
    id: "passport",
    label: "护照",
    targetId: "passport",
    kind: "entity",
  },
  {
    id: "visa-records",
    label: "签证记录",
    targetId: "passport",
    kind: "attachment",
  },
  {
    id: "travel",
    label: "旅行清单",
    targetId: "travel",
    kind: "entity",
  },
  {
    id: "files",
    label: "文件资料",
    targetId: "files",
    kind: "entity",
  },
  {
    id: "emergency-contact",
    label: "紧急联系人",
    targetId: "emergency-contacts",
    kind: "entity",
  },
];

export function selectHomeSummary(store) {
  const materialStatuses = store.entities.flatMap((entity) =>
    selectMaterialStatuses(store, entity.id).map((status) => ({
      ...status,
      entityId: entity.id,
    })),
  );
  const statusSummary = countStatuses(materialStatuses);

  return {
    headline: "别再找资料了。它们已经在这里。",
    taskEntries: [
      {
        id: "find-material",
        label: "找资料",
        description: "搜索护照、附件和相关资料",
        action: "search",
      },
      {
        id: "add-material",
        label: "新增资料",
        description: "先放入待整理，再补充关系",
        action: "add",
      },
      {
        id: "travel-check",
        label: "出行检查",
        description: "定位护照、签证、旅行清单和紧急联系人",
        action: "travel-check",
      },
    ],
    statusSummary,
    travelCheckItems,
  };
}

function countStatuses(materialStatuses) {
  const counts = new Map();

  for (const status of materialStatuses) {
    counts.set(status.label, (counts.get(status.label) || 0) + 1);
  }

  return [
    "已保存",
    "待整理",
    "缺附件",
    "AI 不可见",
    "需检查",
  ].map((label) => ({
    label,
    count: counts.get(label) || 0,
  }));
}
