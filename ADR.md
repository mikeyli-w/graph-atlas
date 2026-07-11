# Graph Atlas ADR

## ADR-001：第一阶段保留 React/Vite

状态：接受

背景：当前原型已使用 React + Vite 实现，UI 结构和样式已经能表达产品方向。

决策：第一阶段继续使用 React/Vite，不重写技术栈。

后果：可以专注数据模型和交互地基，避免重写带来的不确定性。

## ADR-002：第一阶段使用 localStorage，不引入后端

状态：接受

背景：产品方向是本地隐私优先，第一阶段重点是本地知识库地基。

决策：第一阶段继续使用 localStorage，但必须通过统一 storage helper 访问。

后果：实现简单、低成本；但需要明确这不等于真实加密，也不提供多端同步。

## ADR-003：第一阶段不引入向量库

状态：接受

背景：向量检索只有在文档分块、来源证据和隐私过滤稳定后才有价值。

决策：第一阶段不引入向量库，先完成结构化数据、关系一致性和本地搜索。

后果：AI 能力后置，但能降低复杂度和隐私风险。

## ADR-004：关系统一使用 ID-based edges

状态：接受

背景：当前 `links` 使用标题，`baseEdges` 使用 ID，存在漂移风险。

决策：所有正式关系统一使用 `edges`，并通过 `fromId` / `toId` 引用实体 ID。

后果：标题可修改而不破坏关系，图谱和详情面板能共享同一数据源。

## ADR-005：AI 只做预留和引用机制，不做开放聊天

状态：接受

背景：开放聊天容易在数据和隐私地基不稳时制造幻觉和泄露风险。

决策：第一阶段只预留 AI 上下文、引用和建议确认机制，不实现开放式聊天。

后果：AI 体验推进更慢，但可信度更高。

## ADR-006：高隐私资料默认不进入 AI 上下文

状态：接受

背景：系统会管理证件、账号、联系人和合同等敏感资料。

决策：`privacyLevel: "high"` 的资料默认 `aiAccess: false`，且不能被自动打开。

后果：保护隐私优先；用户需要显式授权才能扩大 AI 可访问范围。

## ADR-007：使用 Repository 抽象隔离 localStorage

状态：接受

背景：第一阶段使用 localStorage 是合理的低成本选择，但未来可能切换到 IndexedDB、SQLite、文件系统或后端同步。

决策：通过 `KnowledgeStoreRepository` 抽象访问知识库数据，localStorage 只是第一阶段 adapter。

后果：业务逻辑不会被 localStorage 绑定死；实现上需要避免 UI 和 domain 直接调用 `window.localStorage`。

## ADR-008：引入 Application Services 承载业务用例

状态：接受

背景：如果只拆组件和 domain helper，新增资料、建立关系、搜索、确认收集箱、构建 AI 上下文等流程仍可能散落在 UI 中。

决策：引入 Application Services 层承载用例流程，例如 `knowledgeService`、`inboxService` 和 `aiContextService`。

后果：UI 更薄，业务流程更可测；新增服务层会增加少量结构，但能降低后续耦合。

## ADR-009：附件副本当前阶段使用 IndexedDB，不接文件系统或后端上传

状态：接受

背景：收集箱已能通过附件存储适配器把小型本地文件副本写入浏览器 IndexedDB，并在失败时回退 inline base64。文件系统和后端上传会引入权限、同步、隐私、配额、迁移和运维复杂度。

决策：当前阶段继续使用 `createBrowserAttachmentStorageAdapter` 的 IndexedDB 优先、inline fallback 策略；不新增文件系统 adapter，不接后端上传，不修改 `attachments.localCopy` manifest。

后果：当前本地优先原型保持轻量且已有浏览器回归保护；大文件长期保存、真实文件管理和跨设备同步留到后续独立阶段，再单独设计 adapter 接口、权限模型、迁移策略和浏览器/桌面/后端测试矩阵。
