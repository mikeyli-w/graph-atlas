# Graph Atlas

Graph Atlas 是一个本地隐私优先的个人重要资料与关系管理原型。它不是普通笔记软件，而是面向证件、联系人、文件、旅行资料、项目资料和重要账号的个人知识操作台。

当前项目已经完成第一阶段 MVP 地基：本地知识库模型、收集箱确认入库、搜索与附件索引、隐私与 AI 可见状态、浏览器级 smoke 回归和 GitHub Actions CI 均已接入。当前不再处于“准备开发地基”状态，而是进入 MVP 收口后的产品缺口补齐阶段。

## 当前状态

- 前端原型目录：`graph-atlas/`
- 技术栈：React + Vite
- 当前版本：`0.1.0`
- 公开演示安全：内置资料只使用 `DEMO-*`、`示例用户` 和 `.invalid` 邮箱等明确的合成占位值，不包含真实个人资料；用户在浏览器中创建的数据仍只保存在自己的本地存储中。
- 当前数据：v1 seed knowledge store + localStorage；附件副本使用 IndexedDB，必要时回退 inline manifest；设置页支持本地明文或密码加密备份包导出/覆盖恢复，也可手动选择本地附件目录保存新上传的大文件完整副本，或配置可选 HTTP 上传 endpoint 保存后续大文件副本；云同步目前是可选客户端契约、手动快照诊断和远端差异预览，不会自动上传、拉取、覆盖或合并。
- 核心能力：资料工作台、收集箱确认入库、关系地图、搜索、附件索引、来源证据、隐私级别、AI 安全状态、引用式问答预留。
- 当前重点：当前 MVP、手动关系管理、本地关系模板管理、移动端基础体验与详情快捷编辑、本地备份包、本地目录附件副本、可选远端附件 adapter、云同步客户端契约与远端差异预览、历史大文件补拷贝、发布 gate、GitHub Pages 发布 workflow、移动端双指缩放和空白画布平移/惯性滑动均已收口；后续只保留真实云服务端、账号体系、跨设备冲突合并和商业化发布等非阻塞未来想法。

## 北极星

Graph Atlas 第一版不是通用个人知识库，而是：

> 本地隐私优先的重要资料保险箱 + 关系地图。

第一版只服务一个强场景：出国 / 出行前，用户能确认重要资料是否齐全、能否快速找到、AI 是否不能乱看。

第一体验原则：

> 别再找资料了。它们已经在这里。

## 协作约束：先理解产品意图

本项目的需求输入默认可能是口语化、非技术化、不完整，甚至带有情绪反馈。协作者不能要求需求方先把问题翻译成专业技术语言，也不能只按字面关键词直接实现。

处理任何新需求时，必须先用产品经理视角完成一次需求理解：

- 先判断用户真正想解决的场景、痛点和期望结果。
- 将口语化描述翻译为产品目标、用户路径、信息优先级和可验收结果。
- 如果需求不清晰，先给出最可能的产品假设；只有影响范围、数据风险或交互方向会明显不同的时候，才提出少量澄清问题。
- 面向非技术用户沟通，用结果、体验和风险解释方案，避免把内部实现细节当作主要表达。
- 进入实现前，应明确本次改动的成功标准：用户能看到什么、能完成什么、如何判断这次改动是好的。

特别是前端与交互需求，应优先判断“用户第一眼需要看到什么、下一步应该点哪里、哪些信息应该降噪”，再决定组件、状态和代码实现方式。

## 文档地图

- `PRODUCT_REQUIREMENTS.md`：产品唯一事实来源，包含定位、MVP、用户旅程、指标和验收。
- `SYSTEM_ARCHITECTURE.md`：系统架构唯一事实来源，包含当前架构、目标架构、数据模型和迁移策略。
- `PRIVACY_AND_AI_TRUST.md`：隐私和 AI 信任唯一事实来源，包含隐私等级、AI 访问规则、引用规则和无证据状态。
- `UX_AND_INFORMATION_ARCHITECTURE.md`：体验与信息架构唯一事实来源，包含导航、知识域、节点/关系类型和交互流程。
- `ROADMAP_AND_BACKLOG.md`：开发执行唯一事实来源，包含阶段路线、P0/P1/P2 backlog 和发布清单。
- `ENGINEERING_GUIDE.md`：工程实现规范，包含模块边界、命名、组件拆分、storage 和错误处理约束。
- `TEST_STRATEGY.md`：测试唯一事实来源，包含单元、集成、UI 回归、隐私和 smoke test。
- `DATA_MIGRATION_PLAN.md`：数据迁移计划，包含版本、localStorage key、迁移规则和失败回退。
- `ADR.md`：技术决策记录，解释第一阶段关键取舍。
- `RELEASE_GOVERNANCE.md`：发布治理约定，包含 tag 策略、GitHub Pages 设置、分支保护建议和用户迁移公告模板。
- `COMPETITIVE_REFERENCE.md`：竞品与参照，用于产品差异化判断。
- `PROJECT_KNOWLEDGE_GRAPH.md`：当前原型审计快照，用于理解现有代码和数据关系。

历史探索文档已归档到 `docs/archive/`。

## 唯一事实来源

- 产品定位、MVP 范围、用户旅程、指标和产品验收：更新 `PRODUCT_REQUIREMENTS.md`。
- 当前架构、目标架构、数据模型和架构原则：更新 `SYSTEM_ARCHITECTURE.md`。
- 隐私等级、AI 访问、引用式回答和无证据状态：更新 `PRIVACY_AND_AI_TRUST.md`。
- 导航、信息架构、交互流程和页面状态：更新 `UX_AND_INFORMATION_ARCHITECTURE.md`。
- 阶段路线、任务优先级、PR 拆分和发布清单：更新 `ROADMAP_AND_BACKLOG.md`。
- 工程实现约束、模块边界和错误处理：更新 `ENGINEERING_GUIDE.md`。
- 测试层级、测试场景和 smoke test：更新 `TEST_STRATEGY.md`。
- 数据版本、localStorage key 和迁移细节：更新 `DATA_MIGRATION_PLAN.md`。
- 技术取舍原因：更新 `ADR.md`。

## 文档阅读顺序

1. `README.md`
2. `PRODUCT_REQUIREMENTS.md`
3. `SYSTEM_ARCHITECTURE.md`
4. `PRIVACY_AND_AI_TRUST.md`
5. `UX_AND_INFORMATION_ARCHITECTURE.md`
6. `ENGINEERING_GUIDE.md`
7. `DATA_MIGRATION_PLAN.md`
8. `TEST_STRATEGY.md`
9. `ROADMAP_AND_BACKLOG.md`
10. `ADR.md`

## 开发运行

进入前端原型目录：

```bash
cd graph-atlas
```

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev
```

生产构建：

```bash
npm run build
```

单元测试：

```bash
npm run test:run
```

本地浏览器 smoke（默认使用系统 Chrome）：

```bash
npm run test:e2e
```

新机器或 CI 若没有系统 Chrome，可先安装 Playwright 托管 Chromium，再运行托管 Chromium 路径：

```bash
npm run test:e2e:install
npm run test:e2e:ci
```

CI 使用 GitHub Actions 自动运行 `npm ci`、`npm run test:run`、`npm run build`、`npm run test:release:preview` 和 `npm run test:e2e:ci`。

预览生产构建：

```bash
npm run preview
```

生产构建静态预览 smoke：

```bash
npm run test:release:preview
```

发布前本地检查：

```bash
npm run release:dry-run
```

`release:dry-run` 是发布配置、单元测试、生产构建和静态预览 smoke 的本地总入口，会明确提示“不创建 tag、不 push、不部署”，并顺序执行 `release:verify`、`test:run`、`build` 和 `test:release:preview`。它不运行全量浏览器 smoke；正式发布前还需要确认 GitHub Actions CI 或 `npm run test:e2e` 已通过。`release:verify` 只是 dry-run 内部的元数据校验步骤，日常发布前优先跑 dry-run。发布前建议先在设置页导出本地备份包；可选择明文 JSON 或密码加密备份，密码不会被保存且无法找回。GitHub Pages release workflow 会在手动触发或推送 `graph-atlas-v*` tag 时运行发布检查并部署 `graph-atlas/dist`；实际 Pages 启用仍需仓库设置支持。正式 tag 必须形如 `graph-atlas-v0.1.0`，并与 `package.json` 版本和 `RELEASE.md` 章节一致。

当前仓库已提交 `graph-atlas/package-lock.json`，用于固定 React/Vite/Vitest/Playwright 依赖解析结果。

## 下一步开发入口

当前开发以 `ROADMAP_AND_BACKLOG.md` 为执行入口；工程约束见 `ENGINEERING_GUIDE.md`，测试要求见 `TEST_STRATEGY.md`，数据迁移细节见 `DATA_MIGRATION_PLAN.md`。

本期手动关系管理入口、关系来源对象、关系审计历史、常用反向关系词映射、资料库关系词复用、自定义关系词和本地关系模板管理、移动端基础体验与详情快捷编辑、本地备份包、大文件占位提示、本地目录附件副本、可选远端附件 adapter、云同步客户端契约、远端快照差异预览、历史大文件补拷贝、关系来源说明、发布 gate、移动端双指缩放、空白画布平移/惯性滑动和图谱缩放状态可访问反馈均已补齐。用户可在详情关系区维护手动关系，在设置页维护关系模板词，并在“历史”页追溯手动关系新增、编辑和移除记录；也可在设置页导出包含 knowledge store 与 IndexedDB 附件副本的本地明文或密码加密备份包，并通过二次确认覆盖恢复。手机端详情抽屉已提供摘要状态和标签、关系、附件、来源、正文快捷编辑入口。超出 IndexedDB 上限的新文件在选择本地附件目录后可保存完整副本；配置远端 endpoint 后也可保存为 remote manifest；云同步设置只支持手动测试连接、推送当前资料库快照和检查远端快照差异，不自动覆盖本地资料库；历史超限附件可由用户主动补拷贝。后续只把真实后端服务、跨设备合并同步、账号权限、云端密钥管理和更高级触控手势作为未来想法，不作为当前开发任务阻塞项。

## MVP 原则

- 本地优先：默认数据保存在本地。
- 隐私优先：高隐私资料默认不进入 AI 上下文。
- 证据优先：重要信息必须有来源或手动创建标记。
- 关系优先：图谱关系参与检索和推理，不只是视觉效果。
- 人工确认：AI 可以建议，但不能擅自修改知识库。
