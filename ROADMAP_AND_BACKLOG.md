# Graph Atlas 路线图与开发待办

本文档负责定义阶段路线、任务优先级、推荐 PR 拆分和发布验收清单。本文档不负责完整产品需求、工程规范或完整测试体系；产品需求见 `PRODUCT_REQUIREMENTS.md`，工程规范见 `ENGINEERING_GUIDE.md`，完整测试体系见 `TEST_STRATEGY.md`。

## 1. 阶段路线

### 阶段 0：文档收敛

目标：将探索期文档收敛为少量核心文档。

验收：

- 每个主题只有一个唯一事实来源。
- 历史文档已归档到 `docs/archive/`。
- 应用代码不受影响。

### 阶段 1：本地知识库地基

目标：统一数据模型和关系来源。

交付：

- 种子数据从 `App.jsx` 拆出。
- 建立 `entities`、`edges`、`documents`、`attachments`、`sources`。
- 图谱和详情面板都从 `edges` 渲染关系。
- localStorage 安全读取和回退。
- 基础新增资料流程。
- 轻量收集箱入口：新增资料默认进入待整理。
- 移除误导性加密承诺文案。
- 第一屏任务摘要：找资料、新增资料、出行检查。
- 资料状态字段或等价展示：已保存、待整理、缺附件、AI 不可见、需检查。

验收：

- 图谱连线和详情关系列表完全一致。
- 损坏 localStorage 不会导致页面崩溃。
- 新增节点刷新后仍存在。
- 当前护照示例场景可用。
- UI 不再出现“已加密”类未实现承诺。
- 第一屏不是纯图谱，能先展示任务摘要和资料状态。

### 阶段 2：收集箱与人工确认

目标：资料进入系统前可被整理和确认。

交付：

- 收集箱视图。
- 待整理资料状态。
- 手动新增文档、附件、关系建议。
- 人工确认后入库。

验收：

- 新资料不会直接污染正式图谱。
- 确认后可生成实体、附件和来源。
- 拒绝的建议不会入库。

### 阶段 3：本地检索与隐私过滤

目标：先做可靠查找，再做 AI。

交付：

- 扩展搜索范围：标题、标签、类型、摘要、来源。
- 隐私等级过滤。
- AI 可访问开关。
- AI 上下文预览。

验收：

- 高隐私资料默认不进入 AI 上下文。
- 搜索能跨实体、关系和附件索引命中。
- 用户能看见哪些资料将被 AI 使用。

### 阶段 4：引用式 AI 问答

目标：AI 基于允许访问的资料回答。

交付：

- 问答入口。
- 检索结果引用。
- 无证据提示。
- 关系路径展示。

验收：

- AI 回答必须有来源。
- 没有来源时不编造。
- 高隐私资料默认不可用。

## 2. P0 Backlog

P0 的目标是让任何工程师可以按编号直接开工。每个任务都必须有输入、输出和验收标准；完整测试体系仍以 `TEST_STRATEGY.md` 为唯一事实来源。

### P0-001 移除误导性加密文案

输入：

- 当前 UI 中未实现的“加密”类文案。
- `PRIVACY_AND_AI_TRUST.md` 中的文案约束。

输出：

- 将“本地加密 vault 已连接”改为“本地 Vault 已连接”或“本地资料库”。
- 检查 UI 中是否存在端到端加密、安全处理等未实现承诺。

验收：

- UI 不再声称已加密。
- 隐私文案与 `PRIVACY_AND_AI_TRUST.md` 一致。
- 不改变现有数据和交互行为。

测试要求：

- 全局搜索不再出现“本地加密”“端到端加密”等未实现承诺。
- 默认护照场景仍能打开。

预期文件影响：

- 主要修改 `graph-atlas/src/App.jsx` 或当前承载该文案的 UI 组件。
- 不新增数据、存储或服务模块。

### P0-002 拆出 seed data

输入：

- 当前 `App.jsx` 中的 `initialNodes`、`vaultTree`、`baseEdges` 和附件示例。

输出：

- 建立独立 seed data 模块。
- `App.jsx` 从 seed data 模块读取默认数据。
- UI 行为保持不变。

验收：

- 应用启动后默认护照节点、侧边栏、图谱和详情仍可用。
- seed data 不再继续堆在主组件里。

测试要求：

- 构建通过。
- 默认选中节点和默认图谱关系不丢失。

预期文件影响：

- 新增 `graph-atlas/src/data/seedKnowledgeStore.js`。
- 更新 `graph-atlas/src/App.jsx` 读取 seed data。
- 不改变 UI 行为。

### P0-003 建立 `entities + edges` 数据模型

完整测试体系见 `TEST_STRATEGY.md`；本节只列本任务必须覆盖的任务级检查。

输入：

- seed data 模块。
- 当前 `baseEdges` 和 `links`。

输出：

- 定义 `entities`、`edges`、`documents`、`attachments`、`sources`。
- 将现有 `baseEdges` 迁移为 `edges`。
- 当前 `links` 不再作为正式关系来源，只保留为迁移校验参考或移除。

验收：

- 知识库 store 具备 v1 结构。
- 所有正式关系以 `fromId` / `toId` 指向实体 ID。

测试要求：

- 迁移后的 entity ID 唯一。
- 所有 edge 的 `fromId` 和 `toId` 都能找到实体。

预期文件影响：

- 新增或更新 `graph-atlas/src/data/schema.js`。
- 更新 `graph-atlas/src/data/seedKnowledgeStore.js` 为 v1 store 结构。
- 可新增最小数据校验 helper，但不引入数据库或后端。

### P0-004 增加 storage helper 和 repository

完整测试体系见 `TEST_STRATEGY.md`；本节只列本任务必须覆盖的任务级检查。

输入：

- v1 knowledge store 结构。
- `DATA_MIGRATION_PLAN.md` 中的 key 和迁移策略。

输出：

- 建立 storage helper。
- 建立 `KnowledgeStoreRepository` localStorage adapter。
- 应用读写通过 repository，不直接访问 localStorage。
- 写入时保存完整知识库对象，而不是单一 nodes 数组。

验收：

- UI 不直接调用 localStorage 读写知识库。
- 业务写操作有统一入口。

测试要求：

- 空 localStorage 使用 seed store。
- 保存后刷新仍能读取 v1 store。

预期文件影响：

- 新增 `graph-atlas/src/repositories/knowledgeStoreRepository.js`。
- 新增 `graph-atlas/src/storage/knowledgeStoreStorage.js`。
- 更新 `graph-atlas/src/App.jsx` 通过 service 或 repository 读取 store。

### P0-005 修复 localStorage 损坏回退

输入：

- `KnowledgeStoreRepository`。
- 旧 `graph-atlas-nodes` 数据兼容要求。

输出：

- 给 localStorage 读取增加 `try/catch`。
- 解析失败时回退到种子数据。
- 为旧 `graph-atlas-nodes` 数据预留兼容迁移。

验收：

- 手动写入损坏 JSON 后页面仍能打开。
- 旧数据存在时能迁移或回退。

测试要求：

- 空 localStorage 使用 seed store。
- 损坏 `graph-atlas-store` 不覆盖旧数据。
- 旧 `graph-atlas-nodes` 可迁移或安全回退。

预期文件影响：

- 新增或更新 `graph-atlas/src/storage/migrations.js`。
- 更新 `graph-atlas/src/repositories/knowledgeStoreRepository.js` 的读取、迁移和回退逻辑。
- 可补充迁移单测，从 P0-003 起允许引入 Vitest。

### P0-006 统一图谱和详情关系来源

输入：

- v1 `entities` 和 `edges`。
- 当前图谱连线和详情关系展示。

输出：

- 图谱连线从 `edges` 渲染。
- 详情关系列表从同一份 `edges` 派生。
- 关系跳转使用实体 ID。

验收：

- 图谱连线和详情关系列表来自同一份 `edges`。
- 改节点标题不会破坏关系跳转。

测试要求：

- 修改实体标题后，关系跳转仍然可用。
- 默认护照关系完整显示。

预期文件影响：

- 新增或更新 `graph-atlas/src/domain/relationships.js`。
- 新增或更新 `graph-atlas/src/selectors/graphSelectors.js`。
- 新增或更新 `graph-atlas/src/selectors/detailSelectors.js`。
- 更新图谱和详情相关组件消费 selector 输出。

### P0-007 增加隐私字段和 AI 可见状态

完整隐私规则见 `PRIVACY_AND_AI_TRUST.md`，完整测试体系见 `TEST_STRATEGY.md`；本节只列本任务必须覆盖的任务级检查。

输入：

- v1 entities。
- 隐私模型文档。

输出：

- 将 UI 中的隐私级别映射为 `high / medium / low`。
- 新增 `aiAccess` 字段。
- 新建节点根据类型设置默认隐私。
- 搜索结果和未来 AI 上下文能按隐私过滤。
- 详情页展示 AI 可见 / AI 不可见状态。

验收：

- 高隐私节点默认 `aiAccess: false`。
- UI 仍显示中文隐私标签。
- 用户能看见资料是否 AI 可见。

测试要求：

- 高隐私默认不进入 AI 上下文。
- 中隐私默认不进入云端 AI 上下文。
- 低隐私可进入 AI 预留上下文。

预期文件影响：

- 新增或更新 `graph-atlas/src/domain/privacy.js`。
- 更新 `graph-atlas/src/selectors/detailSelectors.js` 暴露 AI 可见状态。
- 更新详情展示相关组件显示中文隐私标签和 AI 可见 / AI 不可见。

### P0-008 增加资料状态字段/展示

输入：

- v1 entities。
- 产品需求中的资料状态定义。

输出：

- 为重要资料提供状态：已保存、待整理、缺附件、AI 不可见、需检查。
- 首页、列表或详情中至少一处展示资料状态。
- 高隐私资料优先展示“AI 不可见”。

验收：

- 用户能看出资料是否安全、完整、可用。
- AI 作为资料状态出现，而不是首页主入口。

测试要求：

- 护照展示 AI 不可见状态。
- 缺少附件的资料可展示缺附件状态。

预期文件影响：

- 新增或更新资料状态 selector，可放在 `graph-atlas/src/selectors/detailSelectors.js` 或 `graph-atlas/src/selectors/homeSelectors.js`。
- 更新展示组件消费资料状态 view model。
- 不在组件内临时计算复杂资料状态。

### P0-009 增加首页任务入口

输入：

- 当前首页/主界面。
- UX 文档中的首页结构。

输出：

- 首页展示“别再找资料了。它们已经在这里。”这一主张。
- 提供找资料、新增资料、出行检查三个任务入口。
- 在图谱之前展示出行检查摘要或资料状态摘要。

验收：

- 第一屏不再只是“我的知识图谱”。
- 用户无需理解图谱即可开始找资料、存资料或检查资料。

测试要求：

- 第一屏展示三个任务入口。
- 出行检查入口能定位到护照、签证、旅行清单、文件资料和紧急联系人。

预期文件影响：

- 新增或更新 `graph-atlas/src/selectors/homeSelectors.js`。
- 新增或更新首页任务入口组件，或在现有主界面中抽出首页摘要区域。
- 更新样式文件以支持任务入口和资料状态摘要。

### P0-010 增加最小新增资料流程

输入：

- 当前“新笔记”或新增入口。
- v1 entities、privacy defaults 和资料状态。

输出：

- 新增资料表单支持标题、类型、隐私级别。
- 新增资料默认进入待整理状态。
- 新增后写入 store，刷新后保留。

验收：

- 标题、类型、隐私级别必填。
- 新增后自动选中或可立即定位。
- 新增资料刷新后保留。

测试要求：

- 空标题不能保存。
- 高隐私新资料默认 `aiAccess: false`。
- 新增资料出现在列表或图谱中。

预期文件影响：

- 新增或更新新增资料表单组件。
- 新增或更新 `graph-atlas/src/services/knowledgeService.js`。
- 更新 repository 保存路径，确保新增资料写入 v1 store 并可刷新保留。

## 3. P1 Backlog

### 基础新增资料

- 扩展“新笔记”为基础新增资料流程。
- 支持选择节点类型和隐私级别。
- 新增后写入 `entities`。
- 可选建立一条与当前节点的关系。
- 新增资料默认进入待整理状态，再确认入库。

验收：

- 新增节点刷新后保留。
- 新增节点能在图谱中显示。
- 新增节点能出现在详情面板。

### 来源与附件展示

- 将现有附件迁移到 `attachments`。
- 详情面板从附件索引读取附件。
- 新增来源证据区块。
- 节点显示关联来源数量。

验收：

- 护照节点能显示原有两个附件。
- 重要节点至少显示一个来源或手动创建标记。

### 收集箱视图

- 启用左侧“收集箱”入口。
- 展示待整理资料列表。
- 支持新增手动资料条目。
- 支持将资料确认入库。

验收：

- 收集箱条目未确认前不进入正式图谱。
- 确认后生成实体或文档。

## 4. P2 Backlog

- 关系建议队列。
- 搜索增强。
- AI 上下文预览。
- 引用式回答接口预留。
- AI 问答入口。

## 5. 开发顺序

1. P0-001 移除误导性加密文案。
2. P0-002 拆出 seed data。
3. P0-003 建立 `entities + edges` 数据模型。
4. P0-004 增加 storage helper 和 repository。
5. P0-005 修复 localStorage 损坏回退。
6. P0-006 统一图谱和详情关系来源。
7. P0-007 增加隐私字段和 AI 可见状态。
8. P0-008 增加资料状态字段/展示。
9. P0-009 增加首页任务入口。
10. P0-010 增加最小新增资料流程。
11. 附件与来源展示。
12. 轻量收集箱入口。
13. 搜索增强。
14. AI 上下文预览。
15. 引用式 AI 问答。

## 6. 第一阶段推荐 PR 拆分

1. 信任文案：完成 P0-001，先移除未实现加密承诺。
2. 数据拆分：完成 P0-002 和 P0-003，新增 seed knowledge store 和 schema。
3. Storage repository：完成 P0-004 和 P0-005，统一读写、迁移和损坏回退。
4. Edge 派生关系：完成 P0-006，图谱和详情面板改为从 `edges` 派生。
5. 隐私与状态：完成 P0-007 和 P0-008，补充 AI 可见状态和资料状态。
6. 第一屏体验：完成 P0-009，增加任务摘要和三个任务入口。
7. 新增资料表单：完成 P0-010，默认进入待整理并可持久化。
8. 附件和来源展示：迁移附件索引，增加“来自哪里”区块。

### 本期收口补齐：手动新增关系入口（已完成）

目标：

- 补齐 PRD 中“用户在详情关系区主动新增关系”的入口，避免关系创建只依赖新增资料时顺手关联或关系建议确认。

交付：

- 详情关系区提供“新增关系”入口。
- 用户可选择目标资料、关系类型和来源说明或手动创建标记。
- 保存后写入 ID-based `edges`，并让图谱连线和详情关系列表同步更新。
- 关系跳转继续使用实体 ID，不依赖标题。
- 手动创建的关系提供行内二次确认移除入口；默认 seed 关系不在本期删除范围内。
- 手动创建的关系可编辑目标资料、关系类型和来源说明；默认 seed 关系保持只读。
- 新增关系时可选择同时创建反向关系，反向关系按方向映射关系类型后写入 ID-based manual edge。
- 反向关系映射覆盖常用方向词：`包含/属于`、`证明/被证明`、`使用/被使用`、`提醒/被提醒`、`归档/被归档`、`依赖/被依赖`。
- 关系类型输入框会提示并复用当前资料库中已有的关系词，例如 `计划使用`、`用于登录`、`关联证件` 和 `相关证明`，也包含设置页可维护的本地模板词，例如 `保管位置`、`提交材料`、`到期提醒`，并允许用户直接输入新的关系词。
- 关系列表显示来源说明和权限原因；无来源说明时显示“手动创建”或“示例关系”。
- 手动关系新增、编辑、移除会写入资料变更历史，便于追溯用户维护过哪些关系。

验收：

- 用户能在不新增资料的情况下，从当前详情页主动建立一条关系。
- 用户误建手动关系后，能二次确认移除，刷新后不会恢复。
- 用户能修正手动关系的目标资料、关系类型和来源说明，搜索能命中更新后的依据。
- 用户能一次创建双向关系，并在目标资料详情中看到按方向映射后的反向关系。
- 用户创建“证明”等方向关系时，反向关系应显示为“被证明”，而不是生硬重复同一关系词。
- 用户能选择 seed、历史资料里已经出现过的关系词或设置页维护的本地模板词，也能直接输入新的关系词，不需要只被固定 9 个关系类型限制。
- 用户能看懂一条关系为什么可编辑或只读，以及只读关系应通过新增手动关系补充。
- 用户能在“历史”页看到手动关系新增、编辑和移除记录。
- 修改目标资料标题后，新增关系仍能正确跳转。
- 本任务属于当前阶段补齐项，不属于文件系统/同步/部署/完整移动端导航等未来阶段能力。

验收证据：

- `npm run test:run` 覆盖手动关系服务、关系 ID 稳定性、错误输入、关系搜索、编辑限制、反向关系类型映射、双向关系和手动关系删除限制。
- `npm run test:e2e` 覆盖详情页真实点击新增关系、编辑关系、带预览提示的双向关系、关系权限说明、刷新后保留、搜索关系结果和二次确认移除。

### 下一阶段启动：移动端导航与基础编辑（已完成）

目标：

- 让手机用户不依赖桌面侧栏，也能完成首页任务、打开关系图、操作图谱、查看并编辑当前资料详情、进入收集箱和进入设置。

交付：

- 390x844 移动视口显示底部导航：首页、关系图、详情、收集箱、设置。
- 详情页在手机端变为底部抽屉，图谱节点、搜索结果、最近更新和底部“详情”入口均可打开。
- 图谱区域提供移动端操作条：缩小、放大、复位、当前资料；复位仅恢复缩放，不重置节点布局；图谱空白区域支持双指捏合缩放。
- 手机端保留节点拖拽持久化，详情抽屉可完成隐私切换、收藏、新增标签和 Markdown 编辑。
- 切换到收集箱或设置时自动关闭详情抽屉。
- 桌面右侧详情面板保持原样，数据模型、路由和 selector 均未改变。

验收：

- 手机端底部导航按钮不重叠，页面无水平溢出。
- 点击“关系图”能定位到图谱区域；点击资料节点能看到标题、状态、标签、关系和附件。
- 点击“放大”“缩小”“复位”“当前资料”均可用，双指捏合缩放可用，缩放状态有可访问反馈，拖拽节点刷新后仍保留位置。
- 详情抽屉内的隐私、收藏、标签和 Markdown 编辑刷新后仍保留。
- 点击“收集箱”“设置”能进入对应页面，且不会残留详情抽屉遮挡。

验收证据：

- `npm run test:e2e -- e2e/mobile-home.spec.js` 覆盖移动端底部导航、图谱操作条、缩放状态反馈、双指捏合缩放、节点拖拽持久化、详情抽屉编辑、收集箱/设置切换和无溢出。
- `npm run test:e2e` 覆盖完整浏览器 smoke。

### 文件/同步第一步：本地备份包（已完成）

目标：

- 在不引入后端、不做云同步的前提下，让用户能把当前本地资料库和 IndexedDB 附件副本导出为一个本地备份包，并可二次确认覆盖恢复。

交付：

- 设置页“存储”区提供“导出备份”和“导入备份”。
- 备份包格式为 `graph-atlas-backup` v1，包含 `store` 和 `attachmentCopies`。
- 导入时先校验备份格式和 v1 store schema，再恢复 IndexedDB 附件副本，成功后覆盖 knowledge store。
- 导入前显示资料、关系、附件索引、附件副本和导出时间摘要；确认恢复后才覆盖当前资料库。
- 备份文件明确为本地明文 JSON；不声明加密，不做合并恢复。

验收：

- 用户能导出包含新增资料和 IndexedDB 附件副本的备份包。
- 重置资料库后，用户能导入备份并找回新增资料、附件搜索结果和 IndexedDB 副本记录。
- 无效备份或附件副本恢复失败时不会覆盖当前资料库。

验收证据：

- `npm run test:run -- backupPackage settingsSelectors` 覆盖备份包格式、store 校验、附件副本导出/恢复和失败不覆盖。
- `npm run test:e2e -- e2e/backup-restore.spec.js` 覆盖真实浏览器导出、重置、导入恢复、搜索找回和 IndexedDB 副本存在。

### 文件/同步第二步：附件外部存储 adapter 契约（已完成）

目标：

- 在不接真实后端、不启用文件系统写入的前提下，把未来外部存储从文档概念收敛成可测试的 adapter 契约和设置页能力诊断。

交付：

- 附件存储 adapter 统一表达 `store`、`read`、`remove` 和 `getCapabilities`。
- IndexedDB adapter 支持写入后读回附件副本，并可按 `storageKey` 删除副本。
- inline base64 保留为 fallback adapter，不作为长期大文件路径。
- 设置页“存储能力”显示 IndexedDB 附件副本、本地备份包、inline fallback、文件系统 adapter 未启用、后端同步未配置。
- 保持 `attachments.localCopy`、IndexedDB database/store、路由、依赖和后端配置不变。

验收：

- IndexedDB 附件副本可 store/read/remove。
- 无 IndexedDB 时 browser adapter 回退 inline，并在能力诊断中体现 fallback。
- 用户能在设置页看到当前不是云同步，不会自动上传，文件系统和后端 adapter 仍未启用。

验收证据：

- `npm run test:run -- attachmentStorageAdapter settingsSelectors` 覆盖 adapter 契约、capabilities 和设置页派生数据。
- `npm run test:e2e -- e2e/settings-and-suggestions.spec.js` 覆盖真实浏览器设置页能力诊断。

### 文件/同步第三步：大文件占位与外部存储待配置（已完成）

目标：

- 在不接后端、不启用文件系统写入的前提下，让用户清楚知道超出当前本地副本上限的附件“已保留索引，但没有保存完整副本”。

交付：

- 收集箱选择超限文件后保留附件名、大小、日期、本地引用和 `localCopy` manifest。
- 收集箱附件行显示“未保存完整副本”提示，并说明可先入库、后续等待文件系统或后端存储 adapter。
- 详情附件区显示“未保存完整副本 / 需要外部存储”、已保留的信息和后续行动建议。
- 设置页“存储能力”下显示“大文件长期保存”摘要，并统计当前资料库中等待外部存储的大文件数量。
- 保持 `attachments.localCopy` 结构、IndexedDB database/store、路由、依赖和后端配置不变。

验收：

- 超限附件可以确认入库，并能通过附件索引和文件名搜索找回。
- 用户能在收集箱、详情页和设置页理解完整副本未保存的原因和下一步。
- 文件系统 adapter、后端同步 adapter 仍明确显示为未启用/未配置。

验收证据：

- `npm run test:run -- detailSelectors settingsSelectors inboxAttachmentRows` 覆盖详情行动提示、设置页大文件统计和收集箱超限 manifest。
- `npm run test:e2e -- e2e/attachment-upload.spec.js` 覆盖真实浏览器超限文件选择、入库、详情提示、搜索和设置页风险摘要。

### 文件/同步第四步：本地目录附件存储 adapter（已完成）

目标：

- 在不接后端、不改 knowledge store schema 的前提下，让用户选择本机附件目录后，新上传的大文件可保存完整副本。

交付：

- 新增 File System Access 本地目录 adapter，实现 `store/read/remove/getCapabilities`。
- 设置页“本地附件目录”支持选择目录、重新授权和清除授权；目录 handle 保存在独立 IndexedDB 记录中，不写入 knowledge store。
- 小文件继续优先 IndexedDB，失败时 inline fallback；超出 IndexedDB 上限的新文件在目录已授权时保存到本机目录。
- 详情页显示“本地副本已保存到本地附件目录”，收集箱显示“完整副本将保存到本地附件目录”。
- 本地备份包仍只包含 knowledge store 和 IndexedDB 附件副本；本地目录中的外部文件不自动打包。

验收：

- 未配置目录时，超限文件仍保持“索引已保留 / 外部存储待配置”。
- 配置目录后，超限文件保存为 `contentEncoding: "file-system"` / `copyStatus: "stored-file-system"`。
- 用户能在设置页看到文件系统 adapter 的未启用、已授权和清除后的状态变化。

验收证据：

- `npm run test:run -- attachmentStorageAdapter detailSelectors settingsSelectors` 覆盖本地目录 adapter、浏览器存储选择策略和详情/设置派生状态。
- `npm run test:e2e -- e2e/attachment-upload.spec.js` 覆盖真实浏览器目录授权 mock、超限文件保存到本地目录、详情状态和搜索命中。
- `npm run test:e2e -- e2e/settings-and-suggestions.spec.js` 覆盖设置页本地目录授权与清除状态。

### 文件/同步第五步：可选远端附件 adapter（已完成）

目标：

- 在不新增真实后端服务、不改 knowledge store schema 的前提下，为后续大文件后端保存提供可配置客户端契约。

范围：

- 新增 HTTP attachment upload adapter，配置 endpoint 后可把超出 IndexedDB 上限的新文件保存为 `contentEncoding: "remote"` / `copyStatus: "stored-remote"`。
- 设置页显示后端同步配置诊断：未配置、已配置、上传失败、最近成功。
- 浏览器回归通过 mock endpoint 验证 remote manifest、详情状态和搜索命中。
- 当前仍不提供账号、鉴权服务端、跨设备合并同步或真实云存储。

验收证据：

- `npm run test:run -- attachmentStorageAdapter detailSelectors settingsSelectors` 覆盖 remote adapter、浏览器存储选择策略和设置页派生状态。
- `npm run test:e2e -- e2e/attachment-upload.spec.js` 覆盖配置 mock endpoint 后超限文件保存为 remote manifest。
- `npm run test:e2e -- e2e/settings-and-suggestions.spec.js` 覆盖设置页后端配置诊断。

### 文件/同步第六步：历史大文件补拷贝（已完成）

目标：

- 让历史 `skipped-too-large` 附件在本地目录或远端 adapter 可用时，由用户主动补保存完整副本。

范围：

- 新增 `backfillLargeFileCopies` 服务，补拷贝成功后更新附件 manifest，失败时不破坏原索引、本地引用和搜索能力。
- 设置页提供“补拷贝历史大文件”入口，用户选择对应本地文件后逐条处理。
- 冲突策略保持最小版：localStorage 仍是主知识库，不做跨设备合并。

验收证据：

- `npm run test:run -- attachmentBackfillService attachmentStorageAdapter` 覆盖补拷贝成功、失败不覆盖、remote/local adapter 路径。
- `npm run test:e2e -- e2e/attachment-upload.spec.js` 覆盖历史超限附件补拷贝到本地附件目录。

### 文件/同步第七步：云同步客户端契约（已完成）

目标：

- 在不内置真实后端、不做账号体系、不改变本地优先存储的前提下，为后续跨设备同步定义可测试客户端边界。

范围：

- 新增 HTTP cloud sync adapter，支持 `GET /capabilities`、`POST /snapshots` 和 `GET /snapshots/latest`。
- 设置页提供云同步 endpoint/token 配置、测试连接、手动推送当前资料库快照、检查远端快照摘要和清除配置。
- 推送快照需要二次确认；拉取远端快照只显示摘要，不自动覆盖本地资料库。
- 当前仍不提供真实云服务端、账号注册登录、自动同步、冲突合并、云端附件存储或账号恢复。

验收证据：

- `npm run test:run -- cloudSyncAdapter settingsSelectors` 覆盖配置持久化、连接测试、快照推送、远端摘要预览和错误边界。
- `npm run test:e2e -- e2e/settings-and-suggestions.spec.js` 覆盖设置页 mock 云同步链路和本地资料不被远端预览覆盖。

### 文件/同步第八步：云同步远端快照差异预览（已完成）

目标：

- 在不做自动同步、覆盖恢复或冲突合并的前提下，让用户检查远端快照时能看到它与当前本地资料库的差异摘要。

范围：

- 新增远端快照差异派生能力，支持 `summary-only`、`store-diff` 和 `incompatible` 三种结果。
- 远端只返回 summary 时只显示本地/远端资料数量差异，并提示无法判断具体冲突。
- 远端返回完整 store 时显示远端新增、本地独有和可能冲突资料；远端 store 不兼容时只显示“远端快照需检查”。
- 设置页继续不提供远端覆盖、恢复、自动合并或自动同步入口。

验收证据：

- `npm run test:run -- cloudSnapshotDiff cloudSyncAdapter settingsSelectors` 覆盖 summary-only、完整 store 差异、不兼容 store 和 adapter 保留远端 store。
- `npm run test:e2e -- e2e/settings-and-suggestions.spec.js` 覆盖远端摘要差异、完整远端 store 差异和不兼容远端快照均不会改变本地 13 份资料。

### 发布 gate：静态构建预览 smoke（已完成）

目标：

- 在 CI 和本地命令中确认生产构建产物 `dist/` 可由静态服务打开，核心页面不白屏。
- 将 v0.1.0 发布推进为可手动触发、可追踪、可回滚的 GitHub Pages 静态发布。

范围：

- 新增 `npm run test:release:preview`，通过 Vite preview 启动生产构建并执行 Playwright smoke。
- 新增 `npm run release:check`，串行执行单测、生产构建和静态预览 smoke。
- 新增 `npm run release:verify`，校验 package 版本、lockfile 版本、release notes 章节和 tag 名一致。
- GitHub Actions 在 Vitest、build 和全量 e2e 之间执行 release preview smoke。
- GitHub Pages release workflow 在手动触发或推送 `graph-atlas-v*` tag 时运行发布检查并部署 `graph-atlas/dist`。
- 发布前建议用户在设置页导出本地明文备份包；发布不会把 localStorage / IndexedDB 数据迁移到云端。
- 发布治理文档记录 tag 策略、GitHub Pages 设置、分支保护建议和用户迁移公告模板。
- CI 仍使用托管 Chromium，本地默认使用系统 Chrome。

验收证据：

- `npm run build` 通过。
- `npm run release:verify` 通过。
- `npm run release:check` 通过。
- `npm run test:release:preview` 通过，确认生产构建首页可见并可搜索“护照”。

### 移动端多视口与关系来源对象（已完成）

目标：

- 把移动端 smoke 从单一 390x844 扩展到常见手机和小平板竖屏，并让关系来源对象和来源说明在详情中更清楚。

范围：

- 移动端回归覆盖 390x844、430x932、768x1024，验证底部导航、图谱操作条、双指捏合缩放、详情抽屉、无横向溢出和不重叠。
- 移动端 CSS/JS 断点统一为 `820px`，避免 768 视口样式与交互不一致。
- 关系派生模型展示“手动创建 / AI 建议确认 / 示例关系”、来源说明和可编辑状态；手动/AI 确认关系写入 `sources.targetType = "edge"` 来源对象，seed 关系可派生来源对象；标签建议可先修改标签名再确认，关系建议可先修改目标、关系类型和来源说明再确认，摘要建议可先修改摘要内容再确认，搜索与编辑能力保持不变。

验收证据：

- `npm run test:e2e -- e2e/mobile-home.spec.js` 覆盖三种移动视口、图谱操作条、详情抽屉和基础编辑。
- `npm run test:e2e -- e2e/manual-relationship.spec.js` 覆盖手动关系来源说明、来源可编辑状态、seed 关系只读、编辑、双向创建和移除；`npm run test:e2e -- e2e/settings-and-suggestions.spec.js` 覆盖标签、关系和摘要建议修改后确认。

## 7. 发布验收清单

数据与持久化：

- [x] 损坏 localStorage 不会导致页面崩溃。
- [x] 新增节点刷新后仍存在。
- [x] 重置功能有二次确认。
- [x] 示例数据可恢复。
- [x] 旧 `graph-atlas-nodes` 数据有迁移或回退策略。
- [x] 本地备份包可导出并二次确认覆盖恢复。
- [x] 附件存储 adapter 契约和存储能力诊断可用。
- [x] 大文件超限时保留索引并提示外部存储待配置。
- [x] 本地附件目录 adapter 可保存新上传的大文件完整副本。
- [x] 可选远端附件 adapter 可在配置 endpoint 后保存新上传的大文件副本。
- [x] 历史超限附件可由用户主动补拷贝，失败不破坏原索引。
- [x] 云同步客户端契约可手动测试连接、推送资料库快照和预览远端快照差异，但不自动覆盖本地资料库。

图谱与关系：

- [x] 图谱连线和详情关系列表来自同一份 `edges`。
- [x] 修改节点标题不会破坏关系跳转。
- [x] 默认护照关系完整显示。
- [x] 手动关系可新增、编辑、可选按方向映射双向创建和移除。
- [x] 关系来源说明可区分手动创建、AI 建议确认和示例关系。
- [x] 关系权限说明可区分手动可编辑、AI 建议确认只读和示例关系只读。
- [x] 手动和 AI 确认关系有 edge-target 来源对象，seed 关系可派生只读来源对象。
- [x] 移动端图谱支持空白画布平移、双指缩放和节点拖拽，复位只还原视图缩放/平移，不改节点布局。

隐私与安全：

- [x] 所有实体有隐私级别。
- [x] 高隐私资料默认 `aiAccess: false`。
- [x] UI 不再误导性声称“已加密”。
- [x] AI 上下文预览排除高隐私资料。
- [x] AI 问答不作为第一阶段核心验收入口。
- [x] AI 只作为资料状态或后续增强能力出现，不作为首页主入口。

搜索与资料查找：

- [x] 搜索覆盖标题、类型、标签和内容。
- [x] 搜索空状态有新增入口。
- [x] 护照附件可通过搜索或详情找到。

新增资料：

- [x] 标题必填。
- [x] 类型和隐私级别必填。
- [x] 新增后自动选中。
- [x] 新增后可持久化。
- [x] 新增资料默认进入待整理状态。

第一屏体验：

- [x] 第一屏展示“别再找资料了。它们已经在这里。”或等价主张。
- [x] 第一屏提供找资料、新增资料、出行检查。
- [x] 第一屏展示资料状态摘要，而不是只展示图谱。
- [x] 移动端 390x844、430x932、768x1024 无横向溢出，底部导航和详情抽屉可用。

文档：

- [x] `PRODUCT_REQUIREMENTS.md` 与实际范围一致。
- [x] `SYSTEM_ARCHITECTURE.md` 与实现一致。
- [x] `PRIVACY_AND_AI_TRUST.md` 与 UI 文案一致。
- [x] GitHub Actions release gate 覆盖生产构建静态预览 smoke。
- [x] GitHub Pages release workflow 可手动触发或通过 `graph-atlas-v*` tag 发布 `graph-atlas/dist`。
- [x] v0.1.0 发布说明包含范围、备份建议、已知限制和回滚方式。
- [x] 发布 tag、分支保护建议和用户迁移公告模板已有发布治理文档。

验收证据：

- `npm run test:run` 覆盖当前 33 个 Vitest 文件、199 个单元/集成测试。
- `npm run test:e2e` 覆盖当前 40 个 Playwright 浏览器 smoke。
- `npm run test:release:preview` 验证生产构建产物可由静态服务打开。
- `npm run release:verify` 验证发布元数据和 tag 约定。
- `npm run release:check` 验证发布前本地检查链路。
- `npm run build` 验证生产构建可用。
- `git diff --check` 验证文档和代码 diff 无空白错误。
