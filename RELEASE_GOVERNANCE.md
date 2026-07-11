# Graph Atlas Release Governance

本文档记录 v0.1.x 阶段的发布治理约定。它不替代 GitHub 仓库设置；分支保护、GitHub Pages 开关和自定义域名仍需要仓库管理员在 GitHub UI 中启用。

## 版本与 tag 策略

- 应用版本写在 `graph-atlas/package.json` 和 `graph-atlas/package-lock.json`。
- 正式发布 tag 必须使用 `graph-atlas-vX.Y.Z`，例如 `graph-atlas-v0.1.0`。
- `RELEASE.md` 必须包含对应的 `## vX.Y.Z` 发布说明。
- `npm run release:verify` 会校验 package、lockfile、release notes、tag 名和 GitHub Pages release workflow 关键配置是否一致。

发布前 dry-run：

```bash
cd graph-atlas
npm run release:dry-run
```

`release:dry-run` 会先打印 dry-run 边界，再顺序执行 `release:verify`、`test:run`、`build` 和 `test:release:preview`。它只验证本地和仓库内发布配置，不创建 tag、不 push、不部署，也不运行全量浏览器 smoke。正式发布前需确认 GitHub Actions CI 或 `npm run test:e2e` 已通过。

正式发布命令：

```bash
cd ..
git tag graph-atlas-v0.1.0
git push origin graph-atlas-v0.1.0
```

## GitHub Pages 设置

- Source 选择 GitHub Actions。
- Release workflow 部署 `graph-atlas/dist`。
- 自定义域名如需启用，应在 Pages 设置中配置域名和 DNS；本仓库不提交 CNAME，直到域名确定。

## 分支保护建议

建议保护 `main`：

- 要求 `Graph Atlas CI / graph-atlas-ci` 通过后才能合并。
- 要求 pull request review，避免直接推送未验证发布配置。
- 不要求 release workflow 作为 PR 必过项；release workflow 只在手动发布或 tag 发布时运行。

## 用户迁移公告模板

发布 v0.1.x 前，可按以下模板通知试用用户：

```text
Graph Atlas vX.Y.Z 已发布。

本次发布不会把你的本地资料上传到云端，也不会自动跨设备同步。你的资料仍保存在当前浏览器的 localStorage / IndexedDB 中。

升级前建议：
1. 打开设置页。
2. 点击“导出备份”，保存本地明文 JSON 备份包。
3. 如果你配置过本地附件目录，请单独保管该目录中的文件。

如果升级后需要恢复：
1. 打开设置页。
2. 选择此前导出的备份包。
3. 二次确认覆盖恢复当前资料库。

已知限制：当前不是云同步，不提供账号、加密备份或跨设备合并。
```
