import {
  KNOWLEDGE_STORE_VERSION,
  SCHEMA_VERSION,
  createEdgeId,
  getDefaultAiAccess,
  normalizePrivacyLevel,
} from "./schema.js";

const seedTimestamp = "2026-06-18T00:00:00.000Z";

export const vaultTree = [
  {
    label: "个人资料",
    children: ["个人资料", "身份证", "护照", "微信账号"],
  },
  {
    label: "工作",
    children: ["工作经历", "项目记录", "合同索引"],
  },
  {
    label: "人脉",
    children: ["联系人", "紧急联系人"],
  },
  {
    label: "资料",
    children: ["文件资料", "证书附件"],
  },
  {
    label: "生活",
    children: ["旅行清单", "重要笔记"],
  },
];

const seedNodeDrafts = [
  {
    id: "passport",
    title: "护照",
    type: "证件",
    icon: "PAS",
    color: "#9d6bff",
    x: 50,
    y: 47,
    privacy: "高（仅自己可见）",
    tags: ["证件", "护照", "出境"],
    updated: "今天 10:23",
    created: "2023-01-15",
    favorite: true,
    attachments: [
      { name: "护照首页.jpg", size: "1.2 MB", date: "2023-01-15" },
      { name: "签证记录.pdf", size: "812 KB", date: "2024-07-22" },
    ],
    preview:
      "# 护照信息（演示）\n- 持有人：示例用户\n- 护照号：DEMO-PASSPORT-001\n- 签发地：示例签发地\n- 签发日期：2023-01-10\n- 有效期至：2033-01-09\n- 备注：此处仅为演示占位数据，不对应真实个人",
  },
  {
    id: "profile",
    title: "个人资料",
    type: "档案",
    icon: "USR",
    color: "#a6a7b5",
    x: 50,
    y: 17,
    privacy: "中（本地保存）",
    tags: ["个人", "核心"],
    updated: "今天 09:40",
    created: "2022-09-01",
    favorite: false,
    attachments: [{ name: "个人信息总览.md", size: "44 KB", date: "2025-05-12" }],
    preview:
      "# 个人资料（演示）\n- 姓名：示例用户\n- 城市：示例城市\n- 手机：DEMO-PHONE-001\n- 邮箱：demo@example.invalid\n- 用作所有个人资料的索引入口",
  },
  {
    id: "idcard",
    title: "身份证",
    type: "证件",
    icon: "ID",
    color: "#78d88c",
    x: 26,
    y: 34,
    privacy: "高（仅自己可见）",
    tags: ["证件", "身份"],
    updated: "今天 09:15",
    created: "2021-06-06",
    favorite: false,
    attachments: [
      { name: "身份证正面.jpg", size: "948 KB", date: "2024-09-18" },
      { name: "身份证反面.jpg", size: "902 KB", date: "2024-09-18" },
    ],
    preview:
      "# 身份证资料（演示）\n- 姓名：示例用户\n- 证件号码：DEMO-ID-001\n- 签发机关：示例签发机关\n- 到期提醒：2030-06-01",
  },
  {
    id: "wechat",
    title: "微信账号",
    type: "账号",
    icon: "WX",
    color: "#7bdc85",
    x: 76,
    y: 34,
    privacy: "中（本地保存）",
    tags: ["账号", "社交"],
    updated: "2025-05-10",
    created: "2020-03-18",
    favorite: false,
    attachments: [],
    preview:
      "# 微信账号（演示）\n- 用途：社交与登录\n- 绑定手机：DEMO-PHONE-001\n- 恢复方式：手机短信 + 邮箱\n- 注意：不记录明文密码",
  },
  {
    id: "contacts",
    title: "联系人",
    type: "人脉",
    icon: "REL",
    color: "#77a8ff",
    x: 81,
    y: 56,
    privacy: "中（本地保存）",
    tags: ["联系人", "紧急"],
    updated: "2025-05-12",
    created: "2023-02-01",
    favorite: false,
    attachments: [{ name: "紧急联系人清单.csv", size: "24 KB", date: "2025-05-12" }],
    preview:
      "# 联系人（演示）\n- 示例联系人甲：紧急联系人\n- 示例联系人乙：工作证明联系人\n- 备注：出境前同步更新紧急联系人",
  },
  {
    id: "files",
    title: "文件资料",
    type: "文件",
    icon: "DIR",
    color: "#6d9cff",
    x: 20,
    y: 56,
    privacy: "中（本地保存）",
    tags: ["资料", "附件"],
    updated: "昨天 18:42",
    created: "2024-01-08",
    favorite: false,
    attachments: [{ name: "资料目录索引.xlsx", size: "156 KB", date: "2025-05-16" }],
    preview:
      "# 文件资料\n- 证件扫描件\n- 工作证明\n- 旅行材料\n- 重要文件只保存索引，不保存敏感原件",
  },
  {
    id: "work",
    title: "工作经历",
    type: "经历",
    icon: "JOB",
    color: "#e4b94b",
    x: 50,
    y: 68,
    privacy: "低（可导出）",
    tags: ["工作", "经历"],
    updated: "昨天 18:42",
    created: "2020-10-01",
    favorite: false,
    attachments: [{ name: "工作证明-示例用户.pdf", size: "1.4 MB", date: "2025-03-18" }],
    preview:
      "# 工作经历\n- 2020-2023：产品经理\n- 2023-至今：独立项目\n- 可用于签证、人职、简历与背景资料",
  },
  {
    id: "project-records",
    title: "项目记录",
    type: "项目",
    icon: "PRJ",
    color: "#d8b05f",
    x: 72,
    y: 68,
    privacy: "中（本地保存）",
    tags: ["工作", "项目", "索引"],
    updated: "今天 08:50",
    created: "2024-03-11",
    favorite: false,
    attachments: [{ name: "项目记录索引.xlsx", size: "96 KB", date: "2025-05-22" }],
    preview:
      "# 项目记录\n- 记录重要项目、交付物和证明材料位置\n- 与工作经历、合同索引和文件资料保持关联\n- 用于快速整理签证、背景调查或作品说明所需材料",
  },
  {
    id: "contract-index",
    title: "合同索引",
    type: "合同",
    icon: "CON",
    color: "#c7b070",
    x: 83,
    y: 74,
    privacy: "中（本地保存）",
    tags: ["工作", "合同", "索引"],
    updated: "今天 08:35",
    created: "2023-12-06",
    favorite: false,
    attachments: [{ name: "合同目录索引.pdf", size: "220 KB", date: "2025-05-20" }],
    preview:
      "# 合同索引\n- 汇总合作合同、雇佣证明和归档位置\n- 不保存敏感合同全文，只保留目录、日期和存放引用\n- 需要出具证明时，从这里定位对应文件",
  },
  {
    id: "travel",
    title: "旅行清单",
    type: "生活",
    icon: "AIR",
    color: "#72a5ff",
    x: 34,
    y: 78,
    privacy: "低（可导出）",
    tags: ["旅行", "计划"],
    updated: "昨天 16:30",
    created: "2024-11-20",
    favorite: false,
    attachments: [{ name: "日本旅行材料.zip", size: "8.1 MB", date: "2025-04-20" }],
    preview:
      "# 日本旅行计划\n- 护照有效期检查\n- 签证材料\n- 酒店与航班\n- 紧急联系人",
  },
  {
    id: "emergency-contacts",
    title: "紧急联系人",
    type: "人脉",
    icon: "SOS",
    color: "#ff7d72",
    x: 72,
    y: 57,
    privacy: "中（本地保存）",
    tags: ["联系人", "紧急", "出行"],
    updated: "今天 08:20",
    created: "2024-02-18",
    favorite: true,
    attachments: [{ name: "紧急联系人卡片.pdf", size: "48 KB", date: "2025-05-18" }],
    preview:
      "# 紧急联系人（演示）\n- 示例联系人甲：国内紧急联系人\n- 示例联系人乙：工作证明联系人\n- 出行前确认电话、邮箱和备用联系方式\n- 可打印随身携带，也可与旅行清单关联",
  },
  {
    id: "certificate-attachments",
    title: "证书附件",
    type: "证书",
    icon: "CRT",
    color: "#8ac7ff",
    x: 19,
    y: 70,
    privacy: "中（本地保存）",
    tags: ["资料", "证书", "附件"],
    updated: "今天 08:05",
    created: "2024-04-09",
    favorite: false,
    attachments: [{ name: "证书附件清单.pdf", size: "188 KB", date: "2025-05-19" }],
    preview:
      "# 证书附件\n- 汇总学历、资格、培训和证明类附件\n- 记录证书名称、编号、有效期和文件位置\n- 需要提交材料时，可从文件资料和证书附件共同确认",
  },
  {
    id: "notes",
    title: "重要笔记",
    type: "笔记",
    icon: "NT",
    color: "#d99b55",
    x: 65,
    y: 78,
    privacy: "中（本地保存）",
    tags: ["笔记", "提醒"],
    updated: "昨天 14:08",
    created: "2024-06-13",
    favorite: false,
    attachments: [],
    preview:
      "# 重要笔记\n- 护照有效期剩余超过 6 个月才可出境多数国家\n- 如信息变更，请及时更新并重新扫描存档",
  },
];

const seedEdgeDrafts = [
  ["passport", "profile", "属于"],
  ["passport", "idcard", "关联证件"],
  ["passport", "wechat", "用于登录"],
  ["passport", "contacts", "紧急联系人"],
  ["passport", "files", "包含"],
  ["passport", "emergency-contacts", "紧急联系人"],
  ["passport", "certificate-attachments", "证明材料"],
  ["passport", "work", "相关证明"],
  ["passport", "travel", "计划使用"],
  ["passport", "notes", "相关笔记"],
  ["wechat", "contacts", "通讯录"],
  ["work", "files", "归档"],
  ["work", "project-records", "项目记录"],
  ["work", "contract-index", "合同索引"],
  ["project-records", "files", "交付材料"],
  ["contract-index", "files", "归档"],
  ["travel", "files", "材料"],
  ["travel", "emergency-contacts", "紧急联系人"],
  ["files", "certificate-attachments", "证书附件"],
  ["notes", "travel", "提醒"],
];

export const seedKnowledgeStore = {
  version: KNOWLEDGE_STORE_VERSION,
  metadata: {
    schemaVersion: SCHEMA_VERSION,
    createdAt: seedTimestamp,
    updatedAt: seedTimestamp,
    lastMigrationAt: seedTimestamp,
    storageAdapter: "localStorage",
  },
  entities: seedNodeDrafts.map(toEntity),
  edges: seedEdgeDrafts.map(toEdge),
  documents: seedNodeDrafts.map(toDocument),
  attachments: seedNodeDrafts.flatMap(toAttachments),
  sources: seedNodeDrafts.map(toSource),
  inbox: [],
  layoutSnapshots: [],
  auditLog: [],
  updatedAt: seedTimestamp,
};

export const initialNodes = selectLegacyNodes(seedKnowledgeStore);
export const baseEdges = selectLegacyBaseEdges(seedKnowledgeStore);

function toEntity(node) {
  const privacyLevel = normalizePrivacyLevel(node.privacy);

  return {
    id: node.id,
    title: node.title,
    type: node.type,
    icon: node.icon,
    color: node.color,
    x: node.x,
    y: node.y,
    privacyLevel,
    aiAccess: getDefaultAiAccess(privacyLevel),
    tags: node.tags,
    created: node.created,
    updated: node.updated,
    favorite: node.favorite,
    lifecycleStatus: "saved",
  };
}

function toEdge([fromId, toId, relationType]) {
  return {
    id: createEdgeId(fromId, relationType, toId),
    fromId,
    toId,
    relationType,
    label: relationType,
    source: "seed",
  };
}

function toDocument(node) {
  return {
    id: `doc-${node.id}`,
    entityId: node.id,
    title: `${node.title} 内容`,
    kind: "note",
    body: node.preview,
    updated: node.updated,
  };
}

function toAttachments(node) {
  return node.attachments.map((attachment, index) => ({
    id: `att-${node.id}-${index + 1}`,
    entityId: node.id,
    documentId: `doc-${node.id}`,
    name: attachment.name,
    size: attachment.size,
    date: attachment.date,
    reference: attachment.reference || "",
  }));
}

function toSource(node) {
  return {
    id: `source-${node.id}-manual`,
    targetType: "entity",
    targetId: node.id,
    kind: "manual",
    label: "手动创建",
  };
}

export function selectLegacyNodes(store) {
  const entityById = new Map(store.entities.map((entity) => [entity.id, entity]));
  const documentsByEntityId = new Map(
    store.documents.map((document) => [document.entityId, document]),
  );
  const attachmentsByEntityId = new Map();

  for (const attachment of store.attachments) {
    const current = attachmentsByEntityId.get(attachment.entityId) || [];
    current.push({
      name: attachment.name,
      size: attachment.size,
      date: attachment.date,
    });
    attachmentsByEntityId.set(attachment.entityId, current);
  }

  return store.entities.map((entity) => ({
    id: entity.id,
    title: entity.title,
    type: entity.type,
    icon: entity.icon,
    color: entity.color,
    x: entity.x,
    y: entity.y,
    privacy: toLegacyPrivacyLabel(entity.privacyLevel),
    tags: entity.tags,
    updated: entity.updated,
    created: entity.created,
    favorite: entity.favorite,
    attachments: attachmentsByEntityId.get(entity.id) || [],
    links: store.edges
      .filter((edge) => edge.fromId === entity.id)
      .map((edge) => [entityById.get(edge.toId)?.title || "目标已缺失", edge.label]),
    preview: documentsByEntityId.get(entity.id)?.body || "",
  }));
}

export function selectLegacyBaseEdges(store) {
  return store.edges
    .filter((edge) => edge.fromId === "passport")
    .map((edge) => [edge.fromId, edge.toId, edge.label]);
}

function toLegacyPrivacyLabel(privacyLevel) {
  if (privacyLevel === "high") return "高（仅自己可见）";
  if (privacyLevel === "low") return "低（可导出）";
  return "中（本地保存）";
}
