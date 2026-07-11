import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectDetailViewModel } from "../selectors/detailSelectors.js";
import {
  GRAPH_ATLAS_LEGACY_NODES_KEY,
  GRAPH_ATLAS_STORE_KEY,
} from "../storage/knowledgeStoreStorage.js";
import { knowledgeService } from "../services/knowledgeService.js";
import { createKnowledgeStoreRepository } from "./knowledgeStoreRepository.js";

describe("KnowledgeStoreRepository", () => {
  it("loads the seed store when localStorage is empty", () => {
    const repository = createKnowledgeStoreRepository(createMemoryStorage());

    expect(repository.loadStore()).toEqual(seedKnowledgeStore);
  });

  it("saves and reloads a complete v1 knowledge store", () => {
    const storage = createMemoryStorage();
    const repository = createKnowledgeStoreRepository(storage);
    const store = {
      ...repository.loadStore(),
      metadata: {
        ...seedKnowledgeStore.metadata,
        updatedAt: "2026-06-19T00:00:00.000Z",
      },
      updatedAt: "2026-06-19T00:00:00.000Z",
    };

    repository.saveStore(store);

    expect(JSON.parse(storage.getItem(GRAPH_ATLAS_STORE_KEY))).toEqual(store);
    expect(createKnowledgeStoreRepository(storage).loadStore()).toEqual(store);
  });

  it("loads older v1 stores without layout snapshots", () => {
    const storage = createMemoryStorage();
    const store = { ...seedKnowledgeStore };
    delete store.layoutSnapshots;
    storage.setItem(GRAPH_ATLAS_STORE_KEY, JSON.stringify(store));

    expect(createKnowledgeStoreRepository(storage).loadStore()).toEqual(store);
  });

  it("backfills seeded vault materials into older v1 stores", () => {
    const storage = createMemoryStorage();
    const missingIds = new Set([
      "project-records",
      "contract-index",
      "emergency-contacts",
      "certificate-attachments",
    ]);
    const oldStore = {
      ...seedKnowledgeStore,
      entities: seedKnowledgeStore.entities.filter((entity) => !missingIds.has(entity.id)),
      documents: seedKnowledgeStore.documents.filter((document) => !missingIds.has(document.entityId)),
      attachments: seedKnowledgeStore.attachments.filter((attachment) => !missingIds.has(attachment.entityId)),
      sources: seedKnowledgeStore.sources.filter((source) => !missingIds.has(source.targetId)),
      edges: seedKnowledgeStore.edges.filter(
        (edge) => !missingIds.has(edge.fromId) && !missingIds.has(edge.toId),
      ),
    };
    storage.setItem(GRAPH_ATLAS_STORE_KEY, JSON.stringify(oldStore));

    const loaded = createKnowledgeStoreRepository(storage).loadStore();

    expect(loaded.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "project-records", title: "项目记录" }),
        expect.objectContaining({ id: "contract-index", title: "合同索引" }),
        expect.objectContaining({ id: "emergency-contacts", title: "紧急联系人" }),
        expect.objectContaining({ id: "certificate-attachments", title: "证书附件" }),
      ]),
    );
    expect(loaded.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: "project-records", title: "项目记录 内容" }),
      ]),
    );
    expect(loaded.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromId: "travel",
          toId: "emergency-contacts",
          label: "紧急联系人",
        }),
      ]),
    );
    expect(JSON.parse(storage.getItem(GRAPH_ATLAS_STORE_KEY))).toEqual(loaded);
  });

  it("does not duplicate backfilled materials when the user already has the same title", () => {
    const storage = createMemoryStorage();
    const oldStore = {
      ...seedKnowledgeStore,
      entities: [
        ...seedKnowledgeStore.entities.filter((entity) => entity.id !== "project-records"),
        {
          ...seedKnowledgeStore.entities.find((entity) => entity.id === "project-records"),
          id: "custom-project-records",
          title: "项目记录",
        },
      ],
      documents: seedKnowledgeStore.documents.filter((document) => document.entityId !== "project-records"),
      attachments: seedKnowledgeStore.attachments.filter((attachment) => attachment.entityId !== "project-records"),
      sources: seedKnowledgeStore.sources.filter((source) => source.targetId !== "project-records"),
      edges: seedKnowledgeStore.edges.filter(
        (edge) => edge.fromId !== "project-records" && edge.toId !== "project-records",
      ),
    };
    storage.setItem(GRAPH_ATLAS_STORE_KEY, JSON.stringify(oldStore));

    const loaded = createKnowledgeStoreRepository(storage).loadStore();

    expect(loaded.entities.filter((entity) => entity.title === "项目记录")).toHaveLength(1);
    expect(loaded.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "custom-project-records", title: "项目记录" }),
      ]),
    );
  });

  it("normalizes legacy user relationships into editable manual relationships", () => {
    const storage = createMemoryStorage();
    const oldStore = {
      ...seedKnowledgeStore,
      edges: [
        ...seedKnowledgeStore.edges,
        {
          id: "edge-legacy-new-material-waiting-passport",
          fromId: "travel",
          toId: "passport",
          relationType: "待关联",
          label: "待关联",
          source: "user",
        },
      ],
    };
    storage.setItem(GRAPH_ATLAS_STORE_KEY, JSON.stringify(oldStore));

    const loaded = createKnowledgeStoreRepository(storage).loadStore();
    const normalizedEdge = loaded.edges.find(
      (edge) => edge.fromId === "travel" && edge.toId === "passport" && edge.source === "manual",
    );
    const detailViewModel = selectDetailViewModel(loaded, "travel");

    expect(normalizedEdge).toEqual(
      expect.objectContaining({
        id: "edge-travel-关联-passport",
        relationType: "关联",
        label: "关联",
        source: "manual",
        evidence: "旧版用户创建关系",
      }),
    );
    expect(loaded.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetType: "edge",
          targetId: "edge-travel-关联-passport",
          kind: "manual",
          evidence: "旧版用户创建关系",
        }),
      ]),
    );
    expect(detailViewModel.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: "passport",
          relation: "关联",
          canEdit: true,
          canDelete: true,
          evidenceLabel: "来源说明：旧版用户创建关系",
          sourceAuditLabel: "手动创建 · 手动可编辑",
        }),
      ]),
    );
    expect(JSON.parse(storage.getItem(GRAPH_ATLAS_STORE_KEY))).toEqual(loaded);
  });

  it("keeps newly added material after a repository reload", () => {
    const storage = createMemoryStorage();
    const repository = createKnowledgeStoreRepository(storage);
    const result = knowledgeService.addEntity(repository.loadStore(), {
      title: "新签证预约单",
      type: "文件",
      privacy: "中（本地保存）",
      summary: "预约时间和材料清单",
      relatedEntityId: "travel",
    });

    repository.saveStore(result.store);
    const reloaded = createKnowledgeStoreRepository(storage).loadStore();

    expect(reloaded.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.entityId,
          title: "新签证预约单",
          lifecycleStatus: "pending",
        }),
      ]),
    );
    expect(reloaded.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: result.entityId,
          body: "预约时间和材料清单",
        }),
      ]),
    );
    expect(reloaded.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromId: result.entityId,
          toId: "travel",
        }),
      ]),
    );
  });

  it("keeps dragged graph positions after a repository reload", () => {
    const storage = createMemoryStorage();
    const repository = createKnowledgeStoreRepository(storage);
    const positioned = knowledgeService.updateEntityPosition(repository.loadStore(), "passport", {
      x: 61.234,
      y: 35.678,
    });

    repository.saveStore(positioned);
    const reloadedPassport = createKnowledgeStoreRepository(storage)
      .loadStore()
      .entities.find((entity) => entity.id === "passport");

    expect(reloadedPassport).toEqual(
      expect.objectContaining({
        x: 61.23,
        y: 35.68,
      }),
    );
  });

  it("falls back to the seed store without overwriting corrupt v1 storage", () => {
    const storage = createMemoryStorage();
    storage.setItem(GRAPH_ATLAS_STORE_KEY, "{not valid json");
    const repository = createKnowledgeStoreRepository(storage);

    expect(repository.loadStore()).toEqual(seedKnowledgeStore);
    expect(storage.getItem(GRAPH_ATLAS_STORE_KEY)).toBe("{not valid json");
  });

  it("migrates valid legacy nodes into v1 storage", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      GRAPH_ATLAS_LEGACY_NODES_KEY,
      JSON.stringify([
        {
          id: "passport",
          title: "护照",
          type: "证件",
          icon: "PAS",
          color: "#9d6bff",
          x: 50,
          y: 47,
          privacy: "高（仅自己可见）",
          tags: ["证件"],
          updated: "今天",
          created: "2023-01-15",
          favorite: true,
          attachments: [
            {
              name: "护照首页.jpg",
              size: "1.2 MB",
              date: "2023-01-15",
              reference: "/Users/me/Documents/passport.jpg",
            },
          ],
          preview: "护照内容",
        },
      ]),
    );
    const repository = createKnowledgeStoreRepository(storage);
    const migrated = repository.loadStore();

    expect(migrated.version).toBe("v1_knowledge_store");
    expect(migrated.entities).toEqual([
      expect.objectContaining({
        id: "passport",
        privacyLevel: "high",
        aiAccess: false,
      }),
    ]);
    expect(migrated.documents).toEqual([
      expect.objectContaining({
        entityId: "passport",
        body: "护照内容",
      }),
    ]);
    expect(migrated.attachments).toEqual([
      expect.objectContaining({
        name: "护照首页.jpg",
        reference: "/Users/me/Documents/passport.jpg",
      }),
    ]);
    expect(migrated.layoutSnapshots).toEqual([]);
    expect(JSON.parse(storage.getItem(GRAPH_ATLAS_STORE_KEY))).toEqual(migrated);
    expect(storage.getItem(GRAPH_ATLAS_LEGACY_NODES_KEY)).not.toBeNull();
  });

  it("falls back to the seed store when legacy storage is corrupt", () => {
    const storage = createMemoryStorage();
    storage.setItem(GRAPH_ATLAS_LEGACY_NODES_KEY, "{not valid json");
    const repository = createKnowledgeStoreRepository(storage);

    expect(repository.loadStore()).toEqual(seedKnowledgeStore);
    expect(storage.getItem(GRAPH_ATLAS_STORE_KEY)).toBeNull();
  });
});

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}
