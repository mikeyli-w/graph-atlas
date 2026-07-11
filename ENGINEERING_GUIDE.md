# Graph Atlas 工程实现指南

本文档负责定义代码组织、模块边界、命名、组件拆分、storage 访问约束、关系派生约束和错误处理策略。本文档不负责产品范围、完整隐私政策、测试体系或迁移算法；对应内容见 `PRODUCT_REQUIREMENTS.md`、`PRIVACY_AND_AI_TRUST.md`、`TEST_STRATEGY.md` 和 `DATA_MIGRATION_PLAN.md`。

## 1. 目标

本指南定义第一阶段开发的工程约定，确保实现过程小步、可测、可回退，不重写现有 UI。

## 2. 推荐目录结构

第一阶段建议逐步演进为：

```text
graph-atlas/src/
  App.jsx
  main.jsx
  styles.css
  data/
    seedKnowledgeStore.js
    schema.js
  storage/
    knowledgeStoreStorage.js
    migrations.js
  repositories/
    knowledgeStoreRepository.js
  domain/
    relationships.js
    privacy.js
    search.js
  services/
    knowledgeService.js
    inboxService.js
    aiContextService.js
  selectors/
    graphSelectors.js
    detailSelectors.js
    homeSelectors.js
  components/
    GraphCanvas.jsx
    VaultSidebar.jsx
    DetailPanel.jsx
    RecentPanel.jsx
```

第一阶段不要求一次性全部拆完，但新增数据、存储和领域逻辑不应继续堆进 `App.jsx`。

## 3. 模块边界

- 数据层：定义 seed data、schema、枚举和迁移输入输出。
- 仓储层：定义 `KnowledgeStoreRepository`，隔离 localStorage 和未来存储实现。
- 持久化层：负责 localStorage adapter、版本识别、迁移和回退。
- 应用服务层：承载新增资料、更新节点、建立关系、搜索、收集箱确认和 AI 上下文构建。
- 领域层：负责关系派生、隐私默认值、搜索过滤、数据校验。
- Selector / View Model 层：把 domain store 派生为图谱、详情、首页摘要等 UI 可直接消费的数据。
- UI 层：只负责渲染、事件触发和展示状态。
- 图谱层：只消费 `entities` 和 `edges`，不自己维护关系来源。

## 4. 命名规范

- 实体使用 `entity` / `entities`。
- 关系使用 `edge` / `edges`。
- 文档使用 `document` / `documents`。
- 附件使用 `attachment` / `attachments`。
- 来源使用 `source` / `sources`。
- 隐私等级使用 `privacyLevel`，值为 `high | medium | low`。
- AI 访问开关使用 `aiAccess`。

## 5. React 组件原则

- 容器组件负责组合状态和数据派生。
- 展示组件接收 props，不直接读写 localStorage。
- 表单组件只提交结构化 patch，不直接修改全局数据。
- canvas 绘制逻辑应从数据派生，不读取 DOM 文本。
- 组件不能直接组装复杂业务展示数据，必须消费 selector / view model 输出。
- `GraphCanvas` 不直接理解完整 domain store，只接收图谱 view model。
- `DetailPanel` 不直接遍历原始 `edges` 拼详情关系，只接收详情 view model。
- 首页任务摘要不在组件内临时计算，必须由 `homeSelectors` 派生。

## 6. localStorage 约束

- 禁止组件直接调用 `window.localStorage`，必须通过 repository / storage helper。
- 新 key 使用 `graph-atlas-store`。
- 旧 key `graph-atlas-nodes` 只在迁移逻辑中读取。
- 解析失败不能覆盖旧数据。
- 写入前必须保证 store 具备版本号。
- UI 不直接调用 repository；写操作必须通过 service 层。

## 7. 应用服务约束

- 所有写操作必须通过 service 层，例如 `knowledgeService.addEntity`、`knowledgeService.updateEntity`、`knowledgeService.createEdge`。
- service 层负责组合领域规则、仓储读写和错误恢复。
- domain 层保持纯函数优先，不直接访问 localStorage。
- repository 层只负责读写 store，不承载业务规则。
- AI 上下文构建必须通过 `aiContextService`，并调用隐私过滤规则。

## 8. 最小接口契约

第一阶段保持 JavaScript 实现，不强制改成 TypeScript。本节接口是文档级契约，用于统一模块边界和测试目标。

```js
KnowledgeStoreRepository.loadStore()
KnowledgeStoreRepository.saveStore(store)
KnowledgeStoreRepository.resetToSeed()

knowledgeService.addEntity(input)
knowledgeService.updateEntity(id, patch)

relationshipService.createEdge(input)

graphSelectors.selectGraphViewModel(store, activeId)
detailSelectors.selectDetailViewModel(store, activeId)
homeSelectors.selectHomeSummary(store)
```

契约说明：

- repository 返回和保存完整 v1 knowledge store。
- service 方法负责执行写操作、调用领域规则并触发持久化。
- selector 方法只接收 store 和必要 UI 状态，返回 UI 可直接消费的 view model。
- selector 不写入 store，不调用 repository，不产生副作用。
- 测试应优先覆盖 migration、privacy、relationships、selectors 和 store validation。

## 9. 关系约束

- 图谱连线、详情关系、关系跳转都必须从 `edges` 派生。
- 禁止使用节点标题作为关系目标。
- 标题可以改，ID 不应变化。
- 关系目标缺失时，UI 显示“目标已缺失”，不能崩溃。

## 10. 隐私约束

完整隐私等级、AI 访问规则和 AI 回答边界以 `PRIVACY_AND_AI_TRUST.md` 为唯一事实来源。本节只列工程实现必须遵守的约束。

- 新建实体必须有 `privacyLevel`。
- 新建实体必须有 `aiAccess`。
- 高隐私默认 `aiAccess: false`。
- UI 不得声称真实加密，除非实现加密。
- 隐私过滤作为 cross-cutting policy，影响搜索、AI 上下文、未来导出和敏感字段展示。

## 11. 错误处理策略

- JSON 损坏：回退 seed data，保留旧 key，不覆盖。
- 重复 ID：拒绝保存并提示。
- 边引用缺失：跳过渲染该边，并在开发模式输出警告。
- 来源缺失：显示“手动创建”或“暂无来源”。
- 保存失败：保留用户输入，显示失败状态。

## 12. 禁止事项

- 不在 `App.jsx` 继续堆大型 seed data。
- 不在组件里直接读写 `window.localStorage`。
- 不用标题建立关系。
- 不在 P0 引入后端、数据库、向量库或复杂状态管理库。
- 不把 AI 聊天作为首页入口。
- 不写“已加密”类未实现承诺文案。

## 13. 实现策略

- 小步提交，不做大重写。
- 先迁移数据模型，再调整 UI。
- 每个 P0 任务必须带最小验证。
- 文档和实现不一致时，同步更新唯一事实来源文档。
- P0-006 关系统一、P0-008 资料状态、P0-009 首页任务入口都必须通过 selector / view model 落地。
