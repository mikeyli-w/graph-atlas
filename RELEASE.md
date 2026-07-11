# Graph Atlas Release

## v0.1.0

v0.1.0 是 Graph Atlas 当前 MVP 的第一个可发布版本，目标是把本地隐私优先的个人资料工作台从开发收口推进到可静态托管、可验证、可回滚。

发布范围：

- 本地知识库 v1 store、收集箱确认入库、搜索、附件索引、资料关系图谱和详情编辑。
- 隐私等级、AI 可见状态、AI 安全预览和引用式问答预留。
- 本地明文备份包导出/覆盖恢复、IndexedDB 附件副本、本地附件目录副本、可选远端附件 adapter 和历史大文件补拷贝。
- 移动端基础导航、详情抽屉、图谱操作条和三视口浏览器 smoke。
- GitHub Actions CI、生产构建静态预览 smoke 和 GitHub Pages release workflow。

发布前检查：

```bash
cd graph-atlas
npm run release:dry-run
npm run test:e2e
```

`release:dry-run` 是本地发布演练总入口，会运行发布元数据校验、单元测试、生产构建和静态预览 smoke；它不创建 tag、不 push、不部署，也不运行全量浏览器 smoke。正式发布前还需要确认 GitHub Actions CI 或 `npm run test:e2e` 已通过。

发布 tag：

- 正式 tag 使用 `graph-atlas-v0.1.0`。
- `npm run release:verify` 会检查 tag、`package.json`、`package-lock.json` 和本文件的版本是否一致。
- 分支保护、自定义域名和迁移公告模板见 `RELEASE_GOVERNANCE.md`。

发布前备份建议：

- 在设置页点击“导出备份”，保存本地明文 JSON 备份包。
- 备份包包含 knowledge store 和 IndexedDB 附件副本记录。
- 本地附件目录中的外部文件不会自动打包进 JSON；需要用户自行保管该目录。

已知限制：

- 当前不是云同步，不提供账号、鉴权、跨设备合并或服务端存储。
- 备份包是本地明文 JSON，不是加密备份。
- GitHub Pages 只托管静态前端；浏览器数据仍保存在当前设备。
- File System Access 本地目录能力取决于浏览器支持和用户授权。

回滚方式：

- 代码回滚：回滚对应 release commit，或在 GitHub Pages 重新部署上一版构建产物。
- 用户数据回滚：在设置页导入此前导出的本地备份包，并二次确认覆盖恢复。
- 附件外部副本回滚：IndexedDB 副本会随备份包恢复；本地附件目录和远端副本需要按用户保存的目录或后端记录单独处理。
