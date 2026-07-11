# Graph Atlas 数据迁移计划

本文档负责定义数据版本、localStorage key、读取顺序、迁移规则、校验规则、失败处理和写入策略。本文档不负责整体架构、产品范围或测试体系；整体架构见 `SYSTEM_ARCHITECTURE.md`，产品范围见 `PRODUCT_REQUIREMENTS.md`，测试体系见 `TEST_STRATEGY.md`。

## 1. 目标

将当前 `nodes + links + baseEdges` 数据升级为版本化 knowledge store，同时保证旧 localStorage 数据不会被意外覆盖。

## 2. 数据版本

当前版本：

- `v0_nodes_only`
- localStorage key：`graph-atlas-nodes`
- 数据形态：节点数组，每个节点包含 `links`、`attachments` 和 `preview`

目标版本：

- `v1_knowledge_store`
- localStorage key：`graph-atlas-store`
- 数据形态：`entities + edges + documents + attachments + sources`

## 3. 目标 Store 结构

```js
{
  version: "v1_knowledge_store",
  metadata: {
    schemaVersion: 1,
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
    lastMigrationAt: "2026-06-18T00:00:00.000Z",
    storageAdapter: "localStorage"
  },
  entities: [],
  edges: [],
  documents: [],
  attachments: [],
  sources: [],
  inbox: [],
  auditLog: [],
  updatedAt: "2026-06-18T00:00:00.000Z"
}
```

`version` 标识 store 主版本，`metadata.schemaVersion` 用于未来更细粒度的数据结构迁移。`auditLog` 是审计事件预留字段，第一阶段可以保持空数组，不要求实现审计 UI。

最小 audit event 类型：

- `entity_created`
- `entity_updated`
- `edge_created`
- `privacy_changed`
- `migration_completed`
- `storage_recovered`

如第一阶段写入 audit event，最小结构为：

```js
{
  id: "audit-001",
  type: "migration_completed",
  createdAt: "2026-06-18T00:00:00.000Z",
  actor: "system",
  targetId: "store",
  summary: "Migrated v0 nodes to v1 knowledge store"
}
```

## 4. 读取顺序

1. 尝试读取 `graph-atlas-store`。
2. 如果存在且有效，直接使用。
3. 如果不存在，尝试读取旧 key `graph-atlas-nodes`。
4. 如果旧 key 有效，迁移为 v1 store。
5. 如果两个 key 都不存在，使用 seed knowledge store。
6. 如果任一 key JSON 损坏，不能覆盖原数据，使用 seed store 并记录恢复状态。

## 5. 迁移规则

- 每个旧 node 迁移为一个 entity。
- `node.privacy` 映射为 `privacyLevel`。
- `privacyLevel` 派生 `aiAccess`。
- `node.attachments` 迁移为 attachments。
- `node.preview` 迁移为 document 或 document body。
- `baseEdges` 迁移为 edges。
- `node.links` 只用于校验，不作为正式关系来源。
- 每个 entity 至少生成一个 source 或标记为手动创建。
- 初始化 `metadata`，包含 `schemaVersion`、`createdAt`、`updatedAt`、`lastMigrationAt` 和 `storageAdapter`。
- 初始化 `auditLog: []`，第一阶段不写入审计事件也可通过验收。

## 6. 隐私映射

- `高（仅自己可见）` -> `high`
- `中（加密保存）` -> `medium`
- `低（可导出）` -> `low`
- 未知值 -> `medium`

AI 访问默认值：

- `high` -> `false`
- `medium` -> `false`
- `low` -> `true`

## 7. ID 生成规则

- seed data 使用稳定语义 ID，例如 `passport`、`travel-checklist`。
- 用户新增实体使用 `entity-${timestampOrRandom}` 或等价稳定唯一策略。
- document 使用 `doc-${entityId}` 或 `doc-${timestampOrRandom}`。
- attachment 使用 `att-${documentId}-${slugOrRandom}`。
- source 使用 `source-${entityId}-${slugOrRandom}`。
- edge 推荐使用 `edge-${fromId}-${relationType}-${toId}`；如果同一关系允许多条，则追加短随机后缀。
- audit event 使用 `audit-${timestampOrRandom}`。

迁移旧数据时优先保留原 ID；缺失 ID 时按上述规则补齐。测试中可以注入固定 ID factory，保证单元测试稳定、快照可读。

## 8. 校验规则

迁移后必须检查：

- entity ID 唯一。
- edge ID 唯一。
- edge `fromId` 和 `toId` 存在。
- 每个 entity 有 `privacyLevel`。
- 每个 entity 有 `aiAccess`。
- attachments 引用存在的 document。
- sources 引用存在的 document 或 entity。
- `metadata` 存在。
- `metadata.schemaVersion` 存在。
- `auditLog` 存在且为数组。
- audit event 如存在，必须包含 `id`、`type`、`createdAt`。

## 9. 失败处理

- JSON 解析失败：使用 seed store，不覆盖旧 key。
- 校验失败：过滤无效 edge，补齐缺失隐私字段。
- store 写入失败：保留内存状态，提示保存失败。
- 旧数据迁移失败：保留旧 key，使用 seed store。

## 10. 写入策略

- 只写入新 key `graph-atlas-store`。
- 不主动删除旧 key `graph-atlas-nodes`。
- 后续稳定后再提供清理旧数据入口。

## 11. 验收标准

- 无数据时使用 seed store。
- 旧 key 存在时能迁移或安全回退。
- 损坏 JSON 不导致页面崩溃。
- 迁移后图谱和详情关系一致。
- 高隐私实体默认不进入 AI 上下文。
- 目标 store 包含 `metadata` 和 `metadata.schemaVersion`。
- 目标 store 预留 `auditLog`，但第一阶段不强制展示审计记录。

## 12. v0.1.0 发布兼容说明

v0.1.0 仍是本地优先的静态前端发布，不引入账号、云同步或服务端迁移。

- 主知识库继续使用 `localStorage` 中的 `graph-atlas-store`。
- 旧 `graph-atlas-nodes` 仍按既有规则迁移或安全回退。
- IndexedDB 附件副本继续使用 `graph-atlas-attachments / attachmentCopies`。
- 本地附件目录 handle 继续保存在独立 IndexedDB 存储中，不写入 knowledge store。
- 发布到 GitHub Pages 不会把用户本机数据上传到云端，也不会自动跨设备合并。
- 发布前建议用户在设置页导出本地备份包；可选择明文 JSON 或密码加密备份。恢复时仍通过设置页二次确认覆盖当前资料库。
- 加密备份只加密导出的本地文件，不会把 localStorage / IndexedDB 自动迁移到云端，也不提供账号级密码找回或跨设备合并。
