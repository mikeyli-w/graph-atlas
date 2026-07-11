import { getPrivacyLabel } from "../domain/privacy.js";
import { selectAttachmentStorageCapabilities } from "../storage/attachmentStorageAdapter.js";
import { selectHomeSummary } from "./homeSelectors.js";
import packageJson from "../../package.json";

const privacyOrder = ["high", "medium", "low"];
const defaultReleaseInfo = {
  version: packageJson.version,
  buildType: "静态前端发布",
  dataMode: "本地优先，当前不会自动上传或云同步",
};

export function selectSettingsViewModel(store, options = {}) {
  const inboxCounts = store.inbox.reduce(
    (counts, entry) => ({
      ...counts,
      [entry.status]: (counts[entry.status] || 0) + 1,
    }),
    {},
  );

  return {
    storeVersion: store.version,
    schemaVersion: store.metadata.schemaVersion,
    storageAdapter: store.metadata.storageAdapter,
    updatedAt: store.updatedAt || store.metadata.updatedAt,
    localData: [
      { id: "entities", label: "资料", count: store.entities.length },
      { id: "edges", label: "关系", count: store.edges.length },
      { id: "attachments", label: "附件", count: store.attachments.length },
      { id: "sources", label: "来源", count: store.sources.length },
      { id: "inbox", label: "待整理", count: inboxCounts.pending || 0 },
    ],
    privacySummary: privacyOrder.map((privacyLevel) => ({
      privacyLevel,
      label: getPrivacyLabel(privacyLevel),
      count: store.entities.filter((entity) => entity.privacyLevel === privacyLevel).length,
      aiDefault: privacyLevel === "low" ? "默认 AI 可见" : "默认 AI 不可见",
    })),
    releaseInfo: {
      ...defaultReleaseInfo,
      ...options.releaseInfo,
    },
    releaseReadiness: selectReleaseReadiness(store, selectHomeSummary(store)),
    storageCapabilities: selectAttachmentStorageCapabilities(options.attachmentStorage || {}),
    largeFileStorageSummary: selectLargeFileStorageSummary(
      store,
      options.attachmentStorage,
    ),
    cloudSyncSummary: selectCloudSyncSummary(options.cloudSync || {}),
  };
}

function selectCloudSyncSummary(cloudSync = {}) {
  const configured = Boolean(String(cloudSync.endpoint || "").trim());

  if (!configured) {
    return {
      configured: false,
      label: "云同步未配置",
      description: "当前仅使用本地资料库；不会自动上传、拉取或合并。",
      statusLabel: "未配置",
    };
  }

  if (cloudSync.lastStatus === "success") {
    return {
      configured: true,
      label: "最近推送成功",
      description: `${cloudSync.lastSnapshotId || "远端快照"} · ${cloudSync.lastSyncedAt || "时间未知"}`,
      statusLabel: "最近成功",
    };
  }

  if (cloudSync.lastStatus === "preview") {
    return {
      configured: true,
      label: "远端快照可预览",
      description: `${cloudSync.lastSnapshotId || "远端快照"} · 不会自动覆盖本地资料库`,
      statusLabel: "可预览",
    };
  }

  if (cloudSync.lastStatus === "error") {
    return {
      configured: true,
      label: "云同步需检查",
      description: "最近一次云同步请求失败；请检查 endpoint、token 或网络。",
      statusLabel: "连接失败",
    };
  }

  if (cloudSync.lastStatus === "connected") {
    return {
      configured: true,
      label: "云同步连接成功",
      description: "可手动推送当前资料库快照或检查远端快照。",
      statusLabel: "连接成功",
    };
  }

  return {
    configured: true,
    label: "云同步已配置",
    description: "当前只提供手动快照推送和远端摘要预览，不会自动同步。",
    statusLabel: "已配置",
  };
}

function selectLargeFileStorageSummary(store, attachmentStorage = {}) {
  const skippedAttachments = store.attachments.filter(
    (attachment) => attachment.localCopy?.copyStatus === "skipped-too-large",
  );
  const fileSystem = attachmentStorage.fileSystem || {};
  const backend = attachmentStorage.backend || {};
  const fileSystemReady =
    Boolean(fileSystem.supported) &&
    Boolean(fileSystem.configured || fileSystem.directoryHandle) &&
    fileSystem.permissionState === "granted";
  const backendConfigured = Boolean(String(backend.endpoint || "").trim());
  const backendReady = backendConfigured && backend.lastStatus !== "error";

  if (fileSystemReady && backendReady) {
    return {
      skippedCount: skippedAttachments.length,
      label: skippedAttachments.length > 0
        ? `${skippedAttachments.length} 个历史大文件仍待补拷贝`
        : "本地目录和后端上传已可用",
      description: skippedAttachments.length > 0
        ? "后续新选择的大文件可保存到本地附件目录或后端附件存储；已有待外部存储附件需手动补拷贝。"
        : "后续新选择的大文件可保存到本地附件目录或后端附件存储；当前不会自动云同步。",
    };
  }

  if (fileSystemReady) {
    return {
      skippedCount: skippedAttachments.length,
      label: skippedAttachments.length > 0
        ? `${skippedAttachments.length} 个历史大文件仍待补拷贝`
        : "本地附件目录已启用",
      description: skippedAttachments.length > 0
        ? "后续新选择的大文件会保存到本地附件目录；已有待外部存储附件不会自动迁移。"
        : "后续新选择的大文件可保存到本地附件目录；这不是云同步。",
    };
  }

  if (backendReady) {
    return {
      skippedCount: skippedAttachments.length,
      label: skippedAttachments.length > 0
        ? `${skippedAttachments.length} 个历史大文件仍待补拷贝`
        : "后端附件上传已配置",
      description: skippedAttachments.length > 0
        ? "后续新选择的大文件可保存到后端附件存储；已有待外部存储附件需手动补拷贝。"
        : "后续新选择的大文件可保存到已配置的后端 endpoint；当前仍不提供账号体系或自动云同步。",
    };
  }

  if (backendConfigured) {
    return {
      skippedCount: skippedAttachments.length,
      label: skippedAttachments.length > 0
        ? `${skippedAttachments.length} 个历史大文件仍待补拷贝`
        : "后端附件上传需检查",
      description: skippedAttachments.length > 0
        ? "后端 endpoint 已配置但最近上传失败；已有待外部存储附件需先修复配置后再补拷贝。"
        : "后端 endpoint 已配置但最近上传失败；请修复配置后再保存新的大文件副本。",
    };
  }

  return {
    skippedCount: skippedAttachments.length,
    label: skippedAttachments.length > 0
      ? `${skippedAttachments.length} 个大文件未保存完整副本`
      : "0 个大文件待外部存储",
    description: skippedAttachments.length > 0
      ? "已保留附件索引和本地引用；文件系统 adapter 或后端同步启用后再保存完整副本。"
      : "当前没有等待外部存储的大文件；文件系统 adapter 和后端同步仍未启用。",
  };
}

function selectReleaseReadiness(store, homeSummary) {
  const checks = [
    createCheck(
      "storage",
      "数据与持久化",
      "示例数据可恢复",
      store.entities.length > 0 &&
        store.documents.length > 0 &&
        store.attachments.length > 0 &&
        store.sources.length > 0,
    ),
    createCheck(
      "legacy-migration",
      "数据与持久化",
      "旧数据有迁移或回退策略",
      store.version === "v1_knowledge_store" && store.metadata.schemaVersion >= 1,
    ),
    createCheck(
      "graph-relationships",
      "图谱与关系",
      "关系使用 ID 引用",
      store.edges.every((edge) => edge.fromId && edge.toId),
    ),
    createCheck(
      "privacy-levels",
      "隐私与安全",
      "所有实体有隐私级别",
      store.entities.every((entity) => ["high", "medium", "low"].includes(entity.privacyLevel)),
    ),
    createCheck(
      "high-privacy-ai",
      "隐私与安全",
      "高隐私默认 AI 不可见",
      store.entities
        .filter((entity) => entity.privacyLevel === "high")
        .every((entity) => entity.aiAccess === false),
    ),
    createCheck(
      "searchable-content",
      "搜索与资料查找",
      "资料具备标题、类型、标签和正文",
      store.entities.every((entity) => entity.title && entity.type && entity.tags.length > 0) &&
        store.documents.every((document) => document.body),
    ),
    createCheck(
      "passport-attachments",
      "搜索与资料查找",
      "护照附件可追溯",
      store.attachments.some((attachment) => attachment.entityId === "passport"),
    ),
    createCheck(
      "material-status",
      "新增资料",
      "资料状态字段可用",
      store.entities.every((entity) => Boolean(entity.lifecycleStatus)),
    ),
    createCheck(
      "home-summary",
      "第一屏体验",
      "可生成资料状态摘要",
      homeSummary.statusSummary.length > 0,
    ),
    createCheck(
      "ai-not-home-entry",
      "隐私与安全",
      "AI 不是首页任务入口",
      homeSummary.taskEntries.every((entry) => !includesAiEntry(entry)),
    ),
  ];

  return {
    summary: `${checks.filter((check) => check.passed).length}/${checks.length} 项自动检查通过`,
    checks,
  };
}

function includesAiEntry(entry) {
  return [entry.id, entry.label, entry.description, entry.action]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes("ai");
}

function createCheck(id, group, label, passed) {
  return {
    id,
    group,
    label,
    passed: Boolean(passed),
    statusLabel: passed ? "通过" : "需检查",
  };
}
