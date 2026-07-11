import { describe, expect, it } from "vitest";

import { KNOWLEDGE_STORE_VERSION, validateKnowledgeStore } from "./schema.js";
import { baseEdges, initialNodes, seedKnowledgeStore, vaultTree } from "./seedKnowledgeStore.js";

describe("seedKnowledgeStore", () => {
  it("uses the v1 knowledge store structure", () => {
    expect(seedKnowledgeStore.version).toBe(KNOWLEDGE_STORE_VERSION);
    expect(seedKnowledgeStore.metadata.schemaVersion).toBe(1);
    expect(seedKnowledgeStore.entities.length).toBe(13);
    expect(seedKnowledgeStore.edges.length).toBe(20);
    expect(seedKnowledgeStore.documents.length).toBe(13);
    expect(seedKnowledgeStore.attachments.length).toBe(13);
    expect(seedKnowledgeStore.sources.length).toBe(13);
    expect(seedKnowledgeStore.inbox).toEqual([]);
    expect(seedKnowledgeStore.layoutSnapshots).toEqual([]);
    expect(seedKnowledgeStore.auditLog).toEqual([]);
  });

  it("has unique entity ids", () => {
    const ids = seedKnowledgeStore.entities.map((entity) => entity.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses unmistakably synthetic identity placeholders", () => {
    const serializedSeed = JSON.stringify(seedKnowledgeStore);

    expect(serializedSeed).toContain("DEMO-PASSPORT-001");
    expect(serializedSeed).toContain("DEMO-ID-001");
    expect(serializedSeed).toContain("demo@example.invalid");
    expect(serializedSeed).not.toMatch(/\b1[3-9]\d{9}\b/);
    expect(serializedSeed).not.toMatch(/\b\d{17}[\dXx]\b/);
    expect(serializedSeed).not.toMatch(/\b[A-Z]\d{8}\b/);
    expect(serializedSeed).not.toContain("/Users/");
  });

  it("has edges that reference existing entities by id", () => {
    const entityIds = new Set(seedKnowledgeStore.entities.map((entity) => entity.id));

    for (const edge of seedKnowledgeStore.edges) {
      expect(edge).toEqual(
        expect.objectContaining({
          fromId: expect.any(String),
          toId: expect.any(String),
        }),
      );
      expect(entityIds.has(edge.fromId)).toBe(true);
      expect(entityIds.has(edge.toId)).toBe(true);
    }
  });

  it("does not keep legacy links as the formal relationship source", () => {
    for (const entity of seedKnowledgeStore.entities) {
      expect(entity.links).toBeUndefined();
    }
  });

  it("validates the seed knowledge store", () => {
    expect(validateKnowledgeStore(seedKnowledgeStore)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("keeps layout snapshots optional for older v1 stores but validates them when present", () => {
    const legacyCompatibleStore = { ...seedKnowledgeStore };
    delete legacyCompatibleStore.layoutSnapshots;

    expect(validateKnowledgeStore(legacyCompatibleStore)).toEqual({
      valid: true,
      errors: [],
    });

    expect(
      validateKnowledgeStore({
        ...seedKnowledgeStore,
        layoutSnapshots: [
          {
            id: "layout-1",
            title: "坏布局",
            createdAt: "2026-06-19T00:00:00.000Z",
            positions: [{ entityId: "missing-entity", x: 10, y: 20 }],
          },
        ],
      }),
    ).toEqual({
      valid: false,
      errors: ["Layout snapshot layout-1 references missing entity missing-entity."],
    });
  });

  it("allows source records to target existing relationship edges", () => {
    const relationshipSourceStore = {
      ...seedKnowledgeStore,
      sources: [
        ...seedKnowledgeStore.sources,
        {
          id: "source-edge-passport-profile-manual",
          targetType: "edge",
          targetId: "edge-passport-属于-profile",
          kind: "manual",
          label: "关系依据：手动确认护照属于个人资料",
          createdAt: "2026-06-24T00:00:00.000Z",
        },
      ],
    };

    expect(validateKnowledgeStore(relationshipSourceStore)).toEqual({
      valid: true,
      errors: [],
    });
    expect(
      validateKnowledgeStore({
        ...relationshipSourceStore,
        sources: relationshipSourceStore.sources.map((source) =>
          source.id === "source-edge-passport-profile-manual"
            ? { ...source, targetId: "missing-edge" }
            : source,
        ),
      }),
    ).toEqual({
      valid: false,
      errors: ["Source source-edge-passport-profile-manual references missing target missing-edge."],
    });
  });

  it("keeps the current UI seed view compatible", () => {
    expect(vaultTree).toHaveLength(5);
    expect(initialNodes.find((node) => node.id === "passport")).toEqual(
      expect.objectContaining({
        title: "护照",
        links: expect.arrayContaining([["个人资料", "属于"]]),
      }),
    );
    expect(baseEdges).toEqual(
      expect.arrayContaining([["passport", "profile", "属于"]]),
    );
  });
});
