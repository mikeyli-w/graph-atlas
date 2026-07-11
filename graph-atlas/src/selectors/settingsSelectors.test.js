import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";
import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectSettingsViewModel } from "./settingsSelectors.js";

describe("selectSettingsViewModel", () => {
  it("summarizes local data and storage metadata", () => {
    const viewModel = selectSettingsViewModel(seedKnowledgeStore);

    expect(viewModel).toEqual(
      expect.objectContaining({
        storeVersion: "v1_knowledge_store",
        schemaVersion: 1,
        storageAdapter: "localStorage",
        updatedAt: seedKnowledgeStore.updatedAt,
        releaseInfo: {
          version: packageJson.version,
          buildType: "静态前端发布",
          dataMode: "本地优先，当前不会自动上传或云同步",
        },
      }),
    );
    expect(viewModel.localData).toEqual([
      { id: "entities", label: "资料", count: seedKnowledgeStore.entities.length },
      { id: "edges", label: "关系", count: seedKnowledgeStore.edges.length },
      { id: "attachments", label: "附件", count: seedKnowledgeStore.attachments.length },
      { id: "sources", label: "来源", count: seedKnowledgeStore.sources.length },
      { id: "inbox", label: "待整理", count: 0 },
    ]);
    expect(viewModel.largeFileStorageSummary).toEqual({
      skippedCount: 0,
      label: "0 个大文件待外部存储",
      description: "当前没有等待外部存储的大文件；文件系统 adapter 和后端同步仍未启用。",
    });
    expect(viewModel.cloudSyncSummary).toEqual({
      configured: false,
      label: "云同步未配置",
      description: "当前仅使用本地资料库；不会自动上传、拉取或合并。",
      statusLabel: "未配置",
    });
    expect(viewModel.storageCapabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "local-backup",
          label: "本地备份包",
          configured: true,
          statusLabel: "可用",
        }),
        expect.objectContaining({
          id: "file-system",
          label: "文件系统 adapter",
          configured: false,
          statusLabel: "浏览器不支持",
        }),
        expect.objectContaining({
          id: "backend-sync",
          label: "后端同步 adapter",
          configured: false,
          statusLabel: "未配置",
        }),
      ]),
    );
  });

  it("reports privacy distribution and AI defaults", () => {
    const viewModel = selectSettingsViewModel(seedKnowledgeStore);

    expect(viewModel.privacySummary).toEqual([
      expect.objectContaining({
        privacyLevel: "high",
        label: "高（仅自己可见）",
        count: 2,
        aiDefault: "默认 AI 不可见",
      }),
      expect.objectContaining({
        privacyLevel: "medium",
        label: "中（本地保存）",
        count: 9,
        aiDefault: "默认 AI 不可见",
      }),
      expect.objectContaining({
        privacyLevel: "low",
        label: "低（可导出）",
        count: 2,
        aiDefault: "默认 AI 可见",
      }),
    ]);
  });

  it("counts attachments waiting for external large-file storage", () => {
    const store = {
      ...seedKnowledgeStore,
      attachments: seedKnowledgeStore.attachments.map((attachment) =>
        attachment.id === "att-files-1"
          ? {
              ...attachment,
              localCopy: {
                storageKey: "local-library://graph-atlas/attachments/archive.zip",
                mimeType: "application/zip",
                byteSize: 6000000,
                contentHash: "",
                contentEncoding: "",
                contentBase64: "",
                textPreview: "",
                copyStatus: "skipped-too-large",
                copyLimitBytes: 5242880,
              },
            }
          : attachment,
      ),
    };
    const viewModel = selectSettingsViewModel(store);

    expect(viewModel.largeFileStorageSummary).toEqual({
      skippedCount: 1,
      label: "1 个大文件未保存完整副本",
      description: "已保留附件索引和本地引用；文件系统 adapter 或后端同步启用后再保存完整副本。",
    });
  });

  it("reports enabled local directory storage for future large files", () => {
    const viewModel = selectSettingsViewModel(seedKnowledgeStore, {
      attachmentStorage: {
        fileSystem: {
          supported: true,
          configured: true,
          permissionState: "granted",
        },
      },
    });

    expect(viewModel.storageCapabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "file-system",
          configured: true,
          statusLabel: "已授权",
          canStore: true,
        }),
      ]),
    );
    expect(viewModel.largeFileStorageSummary).toEqual({
      skippedCount: 0,
      label: "本地附件目录已启用",
      description: "后续新选择的大文件可保存到本地附件目录；这不是云同步。",
    });
  });

  it("reports configured remote attachment upload status", () => {
    const viewModel = selectSettingsViewModel(seedKnowledgeStore, {
      attachmentStorage: {
        backend: {
          endpoint: "https://uploads.example.test/attachments",
          lastStatus: "success",
        },
      },
    });

    expect(viewModel.storageCapabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "backend-sync",
          configured: true,
          statusLabel: "最近成功",
          canStore: true,
        }),
      ]),
    );
    expect(viewModel.largeFileStorageSummary).toEqual({
      skippedCount: 0,
      label: "后端附件上传已配置",
      description: "后续新选择的大文件可保存到已配置的后端 endpoint；当前仍不提供账号体系或自动云同步。",
    });
  });

  it("reports remote upload failures in the large-file summary", () => {
    const viewModel = selectSettingsViewModel(seedKnowledgeStore, {
      attachmentStorage: {
        backend: {
          endpoint: "https://uploads.example.test/attachments",
          lastStatus: "error",
        },
      },
    });

    expect(viewModel.storageCapabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "backend-sync",
          configured: true,
          statusLabel: "上传失败",
          canStore: true,
        }),
      ]),
    );
    expect(viewModel.largeFileStorageSummary).toEqual({
      skippedCount: 0,
      label: "后端附件上传需检查",
      description: "后端 endpoint 已配置但最近上传失败；请修复配置后再保存新的大文件副本。",
    });
  });

  it("reports both local directory and remote upload when both are available", () => {
    const viewModel = selectSettingsViewModel(seedKnowledgeStore, {
      attachmentStorage: {
        fileSystem: {
          supported: true,
          configured: true,
          permissionState: "granted",
        },
        backend: {
          endpoint: "https://uploads.example.test/attachments",
          lastStatus: "configured",
        },
      },
    });

    expect(viewModel.largeFileStorageSummary).toEqual({
      skippedCount: 0,
      label: "本地目录和后端上传已可用",
      description: "后续新选择的大文件可保存到本地附件目录或后端附件存储；当前不会自动云同步。",
    });
  });

  it("reports cloud sync connection and snapshot states", () => {
    expect(
      selectSettingsViewModel(seedKnowledgeStore, {
        cloudSync: {
          endpoint: "https://sync.example.test/api",
          lastStatus: "connected",
        },
      }).cloudSyncSummary,
    ).toEqual({
      configured: true,
      label: "云同步连接成功",
      description: "可手动推送当前资料库快照或检查远端快照。",
      statusLabel: "连接成功",
    });

    expect(
      selectSettingsViewModel(seedKnowledgeStore, {
        cloudSync: {
          endpoint: "https://sync.example.test/api",
          lastStatus: "success",
          lastSnapshotId: "snapshot-1",
          lastSyncedAt: "2026-07-01T01:00:00.000Z",
        },
      }).cloudSyncSummary,
    ).toEqual({
      configured: true,
      label: "最近推送成功",
      description: "snapshot-1 · 2026-07-01T01:00:00.000Z",
      statusLabel: "最近成功",
    });

    expect(
      selectSettingsViewModel(seedKnowledgeStore, {
        cloudSync: {
          endpoint: "https://sync.example.test/api",
          lastStatus: "error",
        },
      }).cloudSyncSummary.statusLabel,
    ).toBe("连接失败");
  });

  it("reports release readiness checks from the current store", () => {
    const viewModel = selectSettingsViewModel(seedKnowledgeStore);

    expect(viewModel.releaseReadiness.summary).toBe("10/10 项自动检查通过");
    expect(viewModel.releaseReadiness.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "storage",
          group: "数据与持久化",
          label: "示例数据可恢复",
          passed: true,
          statusLabel: "通过",
        }),
        expect.objectContaining({
          id: "passport-attachments",
          group: "搜索与资料查找",
          label: "护照附件可追溯",
          passed: true,
        }),
        expect.objectContaining({
          id: "ai-not-home-entry",
          group: "隐私与安全",
          label: "AI 不是首页任务入口",
          passed: true,
        }),
      ]),
    );
  });

  it("flags release readiness checks that need attention", () => {
    const unsafeStore = {
      ...seedKnowledgeStore,
      entities: seedKnowledgeStore.entities.map((entity) =>
        entity.privacyLevel === "high" ? { ...entity, aiAccess: true } : entity,
      ),
    };
    const viewModel = selectSettingsViewModel(unsafeStore);
    const highPrivacyCheck = viewModel.releaseReadiness.checks.find(
      (check) => check.id === "high-privacy-ai",
    );

    expect(viewModel.releaseReadiness.summary).toBe("9/10 项自动检查通过");
    expect(highPrivacyCheck).toEqual(
      expect.objectContaining({
        passed: false,
        statusLabel: "需检查",
      }),
    );
  });
});
