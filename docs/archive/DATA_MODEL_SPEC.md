# Graph Atlas 数据模型规格

## 1. 设计目标

当前原型使用 `nodes + links + baseEdges`，存在标题匹配、关系重复和画布关系漂移问题。第一阶段应升级为统一数据模型：

- `entities`：图谱实体节点。
- `edges`：实体之间的 ID-based 关系。
- `documents`：原始资料记录。
- `attachments`：附件索引。
- `sources`：来源证据。

## 2. 核心类型

### Entity

实体是图谱中的主要节点。

```js
{
  id: "passport",
  title: "护照",
  type: "document_id",
  icon: "PAS",
  color: "#9d6bff",
  x: 50,
  y: 47,
  privacyLevel: "high",
  aiAccess: false,
  tags: ["证件", "护照", "出境"],
  summary: "护照资料与出境相关材料索引",
  createdAt: "2023-01-15",
  updatedAt: "2026-06-18T00:00:00.000Z",
  favorite: true,
  sourceIds: ["source-passport-main"]
}
```

### Edge

关系边是图谱、详情面板和后续 GraphRAG 的唯一关系来源。

```js
{
  id: "edge-passport-profile",
  fromId: "passport",
  toId: "profile",
  relationType: "belongs_to",
  label: "属于",
  privacyLevel: "high",
  sourceId: "source-passport-main",
  confidence: 1,
  createdAt: "2026-06-18T00:00:00.000Z"
}
```

### Document

文档记录原始资料或资料索引。

```js
{
  id: "doc-passport",
  title: "护照信息",
  fileType: "note",
  privacyLevel: "high",
  aiAccess: false,
  createdAt: "2023-01-15",
  updatedAt: "2026-06-18T00:00:00.000Z"
}
```

### Attachment

附件记录文件索引，不要求第一阶段真实上传文件。

```js
{
  id: "att-passport-cover",
  documentId: "doc-passport",
  name: "护照首页.jpg",
  mimeType: "image/jpeg",
  size: "1.2 MB",
  storagePath: "",
  date: "2023-01-15"
}
```

### Source

来源证据支撑节点、关系或回答。

```js
{
  id: "source-passport-main",
  documentId: "doc-passport",
  entityId: "passport",
  quote: "护照号、签发日期和有效期信息",
  location: "护照信息 / 基本信息",
  createdAt: "2026-06-18T00:00:00.000Z"
}
```

## 3. 枚举建议

### 知识域

- `identity`：身份
- `work`：工作
- `files`：文件
- `people`：人脉
- `life`：生活
- `projects`：项目
- `accounts`：账号

### 节点类型

- `document_id`：证件
- `person`：联系人
- `file`：文件
- `project`：项目
- `account`：账号
- `event`：事件
- `note`：笔记
- `task`：任务

### 关系类型

- `belongs_to`：属于
- `related_to`：关联
- `contains`：包含
- `proves`：证明
- `uses`：使用
- `reminds`：提醒
- `archived_in`：归档
- `contact_for`：联系人
- `depends_on`：依赖

### 隐私等级

- `high`：高隐私，默认禁止 AI 访问。
- `medium`：中隐私，默认禁止云端 AI 访问，可本地检索。
- `low`：低隐私，可进入 AI 预留上下文。

## 4. 迁移策略

- 当前 `initialNodes` 每一项迁移为一个 `Entity`。
- 当前 `baseEdges` 迁移为 `Edge`，使用现有 ID。
- 当前 `links` 不再作为关系数据源，只作为迁移校验参考。
- 当前 `attachments` 迁移为 `Attachment`。
- 当前 `preview` 先迁移为一个 `Document` 的正文或摘要字段。
- 图谱和详情面板都从 `edges` 读取关系。

## 5. 数据一致性规则

- 所有实体 ID 必须唯一。
- 所有边的 `fromId` 和 `toId` 必须存在于 `entities`。
- 所有关系显示均来自 `edges`。
- 所有重要节点至少有一个 `sourceId` 或明确标记为手动创建。
- 删除实体前必须处理关联边。
- 标题可以修改，但关系不能依赖标题。
