import {
  createEdgeId,
} from "../data/schema.js";
import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { updatePrivacyAccess } from "../domain/privacy.js";
import { knowledgeStoreRepository } from "../repositories/knowledgeStoreRepository.js";

export const knowledgeService = {
  loadStore() {
    return knowledgeStoreRepository.loadStore();
  },

  saveStore(store) {
    knowledgeStoreRepository.saveStore(store);
  },

  resetToSeed() {
    return cloneStore(seedKnowledgeStore);
  },

  updateEntity(store, entityId, patch) {
    const currentEntity = store.entities.find((entity) => entity.id === entityId);
    const title = Object.prototype.hasOwnProperty.call(patch, "title")
      ? patch.title?.trim()
      : null;
    const type = Object.prototype.hasOwnProperty.call(patch, "type")
      ? patch.type?.trim()
      : null;

    if (!currentEntity) {
      throw new Error("节点不存在");
    }
    if (Object.prototype.hasOwnProperty.call(patch, "title") && !title) {
      throw new Error("标题必填");
    }
    if (Object.prototype.hasOwnProperty.call(patch, "type") && !type) {
      throw new Error("类型必填");
    }

    const updatedAt = new Date().toISOString();
    const displayUpdated = "刚刚";
    const nextStore = {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt,
      },
      updatedAt,
      entities: store.entities.map((entity) => {
        if (entity.id !== entityId) return entity;

        const nextEntity = {
          ...entity,
          updated: displayUpdated,
        };

        if (title) nextEntity.title = title;
        if (type) nextEntity.type = type;
        if ("favorite" in patch) nextEntity.favorite = patch.favorite;
        if ("privacy" in patch) {
          Object.assign(nextEntity, updatePrivacyAccess(entity, patch.privacy));
        }

        return nextEntity;
      }),
    };

    if ("preview" in patch) {
      return {
        ...nextStore,
        documents: store.documents.map((document) =>
          document.entityId === entityId
            ? { ...document, body: patch.preview, updated: displayUpdated }
            : document,
        ),
      };
    }

    if (title) {
      return {
        ...nextStore,
        documents: store.documents.map((document) =>
          document.entityId === entityId && document.title === `${currentEntity.title} 内容`
            ? { ...document, title: `${title} 内容`, updated: displayUpdated }
            : document,
        ),
      };
    }

    return nextStore;
  },

  updateEntityPosition(store, entityId, position) {
    const nextPosition = normalizeGraphPosition(position);
    const hasEntity = store.entities.some((entity) => entity.id === entityId);

    if (!hasEntity) {
      throw new Error("节点不存在");
    }

    const updatedAt = new Date().toISOString();

    return {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt,
      },
      updatedAt,
      entities: store.entities.map((entity) =>
        entity.id === entityId
          ? {
              ...entity,
              x: nextPosition.x,
              y: nextPosition.y,
            }
          : entity,
      ),
    };
  },

  resetGraphLayout(store) {
    const defaultPositions = new Map(
      seedKnowledgeStore.entities.map((entity) => [entity.id, { x: entity.x, y: entity.y }]),
    );
    const updatedAt = new Date().toISOString();

    return {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt,
      },
      updatedAt,
      entities: store.entities.map((entity) => {
        const defaultPosition = defaultPositions.get(entity.id);

        if (!defaultPosition) return entity;

        return {
          ...entity,
          x: defaultPosition.x,
          y: defaultPosition.y,
        };
      }),
    };
  },

  captureGraphLayoutPositions(store) {
    return store.entities.map((entity) => ({
      entityId: entity.id,
      x: normalizeGraphCoordinate(entity.x),
      y: normalizeGraphCoordinate(entity.y),
    }));
  },

  restoreGraphLayoutPositions(store, positions = []) {
    if (!Array.isArray(positions)) {
      throw new Error("布局坐标必须是数组");
    }

    const positionMap = new Map(
      positions.map((position) => [
        position.entityId,
        {
          x: normalizeGraphCoordinate(position.x),
          y: normalizeGraphCoordinate(position.y),
        },
      ]),
    );
    const updatedAt = new Date().toISOString();

    return {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt,
      },
      updatedAt,
      entities: store.entities.map((entity) => {
        const position = positionMap.get(entity.id);

        if (!position) return entity;

        return {
          ...entity,
          x: position.x,
          y: position.y,
        };
      }),
    };
  },

  saveGraphLayout(store, input = {}) {
    const snapshots = Array.isArray(store.layoutSnapshots) ? store.layoutSnapshots : [];
    const createdAt = new Date().toISOString();
    const title = input.title?.trim() || `布局版本 ${snapshots.length + 1}`;
    const snapshot = {
      id: `layout-${Date.now()}-${snapshots.length + 1}`,
      title,
      note: input.note?.trim() || "",
      createdAt,
      positions: store.entities.map((entity) => ({
        entityId: entity.id,
        x: normalizeGraphCoordinate(entity.x),
        y: normalizeGraphCoordinate(entity.y),
      })),
    };

    return {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt: createdAt,
      },
      updatedAt: createdAt,
      layoutSnapshots: [snapshot, ...snapshots],
    };
  },

  updateGraphLayoutSnapshot(store, snapshotId, input = {}) {
    const snapshots = Array.isArray(store.layoutSnapshots) ? store.layoutSnapshots : [];
    const snapshotExists = snapshots.some((snapshot) => snapshot.id === snapshotId);
    const title = input.title?.trim();

    if (!snapshotExists) {
      throw new Error("布局版本不存在");
    }
    if (!title) {
      throw new Error("布局名称必填");
    }

    const updatedAt = new Date().toISOString();

    return {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt,
      },
      updatedAt,
      layoutSnapshots: snapshots.map((snapshot) =>
        snapshot.id === snapshotId
          ? {
              ...snapshot,
              title,
              note: input.note?.trim() || "",
            }
          : snapshot,
      ),
    };
  },

  copyGraphLayoutSnapshot(store, snapshotId, input = {}) {
    const snapshots = Array.isArray(store.layoutSnapshots) ? store.layoutSnapshots : [];
    const sourceSnapshot = snapshots.find((snapshot) => snapshot.id === snapshotId);

    if (!sourceSnapshot) {
      throw new Error("布局版本不存在");
    }

    const createdAt = new Date().toISOString();
    const requestedTitle = input.title?.trim();
    const title = requestedTitle || createUniqueLayoutCopyTitle(sourceSnapshot.title, snapshots);
    const snapshot = {
      ...sourceSnapshot,
      id: `layout-${Date.now()}-${snapshots.length + 1}`,
      title,
      note: input.note?.trim() || sourceSnapshot.note || "",
      createdAt,
      positions: sourceSnapshot.positions.map((position) => ({ ...position })),
    };

    return {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt: createdAt,
      },
      updatedAt: createdAt,
      layoutSnapshots: [snapshot, ...snapshots],
    };
  },

  applyGraphLayout(store, snapshotId) {
    const snapshots = Array.isArray(store.layoutSnapshots) ? store.layoutSnapshots : [];
    const snapshot = snapshots.find((item) => item.id === snapshotId);

    if (!snapshot) {
      throw new Error("布局版本不存在");
    }

    const positions = new Map(
      snapshot.positions.map((position) => [
        position.entityId,
        {
          x: normalizeGraphCoordinate(position.x),
          y: normalizeGraphCoordinate(position.y),
        },
      ]),
    );
    const updatedAt = new Date().toISOString();

    return {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt,
      },
      updatedAt,
      entities: store.entities.map((entity) => {
        const position = positions.get(entity.id);

        if (!position) return entity;

        return {
          ...entity,
          x: position.x,
          y: position.y,
        };
      }),
    };
  },

  deleteGraphLayout(store, snapshotId) {
    const snapshots = Array.isArray(store.layoutSnapshots) ? store.layoutSnapshots : [];
    const snapshotExists = snapshots.some((snapshot) => snapshot.id === snapshotId);

    if (!snapshotExists) {
      throw new Error("布局版本不存在");
    }

    const updatedAt = new Date().toISOString();

    return {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt,
      },
      updatedAt,
      layoutSnapshots: snapshots.filter((snapshot) => snapshot.id !== snapshotId),
    };
  },

  addEntityTag(store, entityId, tagInput) {
    const tag = normalizeTagInput(tagInput);
    const entity = store.entities.find((item) => item.id === entityId);

    if (!tag) {
      throw new Error("标签必填");
    }
    if (!entity) {
      throw new Error("节点不存在");
    }
    if (entity.tags.includes(tag)) {
      throw new Error("标签已存在");
    }

    const updatedAt = new Date().toISOString();

    return {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt,
      },
      updatedAt,
      entities: store.entities.map((item) =>
        item.id === entityId
          ? {
              ...item,
              tags: [...item.tags, tag],
              updated: "刚刚",
            }
          : item,
      ),
    };
  },

  updateEntityTag(store, entityId, currentTagInput, nextTagInput) {
    const currentTag = normalizeTagInput(currentTagInput);
    const nextTag = normalizeTagInput(nextTagInput);
    const entity = store.entities.find((item) => item.id === entityId);

    if (!currentTag) {
      throw new Error("当前标签必填");
    }
    if (!nextTag) {
      throw new Error("标签必填");
    }
    if (!entity) {
      throw new Error("节点不存在");
    }
    if (!entity.tags.includes(currentTag)) {
      throw new Error("标签不存在");
    }
    if (currentTag !== nextTag && entity.tags.includes(nextTag)) {
      throw new Error("标签已存在");
    }

    const updatedAt = new Date().toISOString();

    return {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt,
      },
      updatedAt,
      entities: store.entities.map((item) =>
        item.id === entityId
          ? {
              ...item,
              tags: item.tags.map((tag) => (tag === currentTag ? nextTag : tag)),
              updated: "刚刚",
            }
          : item,
      ),
    };
  },

  deleteEntityTag(store, entityId, tagInput) {
    const tag = normalizeTagInput(tagInput);
    const entity = store.entities.find((item) => item.id === entityId);

    if (!tag) {
      throw new Error("标签必填");
    }
    if (!entity) {
      throw new Error("节点不存在");
    }
    if (!entity.tags.includes(tag)) {
      throw new Error("标签不存在");
    }
    if (entity.tags.length <= 1) {
      throw new Error("至少保留一个标签");
    }

    const updatedAt = new Date().toISOString();

    return {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt,
      },
      updatedAt,
      entities: store.entities.map((item) =>
        item.id === entityId
          ? {
              ...item,
              tags: item.tags.filter((itemTag) => itemTag !== tag),
              updated: "刚刚",
            }
          : item,
      ),
    };
  },

  addRelationship(store, fromId, input = {}) {
    const fromEntity = store.entities.find((entity) => entity.id === fromId);
    const targetId = input.targetId?.trim();
    const targetEntity = store.entities.find((entity) => entity.id === targetId);
    const relationType = input.relationType?.trim();
    const evidence = input.evidence?.trim();
    const reciprocal = Boolean(input.reciprocal);

    if (!fromEntity) {
      throw new Error("当前资料不存在");
    }
    if (!targetId || !targetEntity) {
      throw new Error("目标资料必填");
    }
    if (fromId === targetId) {
      throw new Error("不能关联到当前资料");
    }
    if (!relationType) {
      throw new Error("关系类型必填");
    }

    const reciprocalRelationType = getReverseRelationshipType(relationType);
    const edgeId = createEdgeId(fromId, relationType, targetId);
    const reciprocalEdgeId = createEdgeId(targetId, reciprocalRelationType, fromId);
    const edgeExists = store.edges.some((edge) => edge.id === edgeId);
    const reciprocalEdgeExists = store.edges.some((edge) => edge.id === reciprocalEdgeId);

    if (edgeExists) {
      throw new Error("关系已存在");
    }
    if (reciprocal && reciprocalEdgeExists) {
      throw new Error("反向关系已存在");
    }

    const updatedAt = new Date().toISOString();
    const edges = [
      createManualEdge({
        id: edgeId,
        fromId,
        toId: targetId,
        relationType,
        evidence,
      }),
    ];

    if (reciprocal) {
      edges.push(
        createManualEdge({
          id: reciprocalEdgeId,
          fromId: targetId,
          toId: fromId,
          relationType: reciprocalRelationType,
          evidence,
        }),
      );
    }

    const relationshipSources = edges.map((edge) =>
      createRelationshipSource({
        edge,
        sourceKind: "manual",
        createdAt: updatedAt,
      }),
    );

    return {
      edgeId,
      edgeIds: edges.map((edge) => edge.id),
      store: {
        ...store,
        metadata: {
          ...store.metadata,
          updatedAt,
        },
        edges: [...store.edges, ...edges],
        sources: [...store.sources, ...relationshipSources],
        auditLog: [
          ...(store.auditLog || []),
          ...edges.map((edge) =>
            createManualRelationshipAuditEntry({
              edge,
              status: "created",
              createdAt: updatedAt,
            }),
          ),
        ],
        updatedAt,
      },
    };
  },

  updateRelationship(store, edgeId, input = {}) {
    const relationshipId = edgeId?.trim();
    const edge = store.edges.find((item) => item.id === relationshipId);
    const targetId = input.targetId?.trim();
    const relationType = input.relationType?.trim();
    const evidence = input.evidence?.trim();

    if (!edge) {
      throw new Error("关系不存在");
    }
    if (edge.source !== "manual") {
      throw new Error("只能编辑手动创建的关系");
    }
    if (!targetId || !store.entities.some((entity) => entity.id === targetId)) {
      throw new Error("目标资料必填");
    }
    if (edge.fromId === targetId) {
      throw new Error("不能关联到当前资料");
    }
    if (!relationType) {
      throw new Error("关系类型必填");
    }

    const nextEdgeId = createEdgeId(edge.fromId, relationType, targetId);
    const edgeExists = store.edges.some((item) => item.id === nextEdgeId && item.id !== edge.id);

    if (edgeExists) {
      throw new Error("关系已存在");
    }

    const updatedAt = new Date().toISOString();
    const nextEdge = createManualEdge({
      id: nextEdgeId,
      fromId: edge.fromId,
      toId: targetId,
      relationType,
      evidence,
    });
    const nextSource = createRelationshipSource({
      edge: nextEdge,
      sourceKind: "manual",
      createdAt: updatedAt,
    });

    return {
      edgeId: nextEdge.id,
      store: {
        ...store,
        metadata: {
          ...store.metadata,
          updatedAt,
        },
        edges: store.edges.map((item) => (item.id === edge.id ? nextEdge : item)),
        sources: [
          ...store.sources.filter(
            (source) => !(source.targetType === "edge" && source.targetId === edge.id),
          ),
          nextSource,
        ],
        auditLog: [
          ...(store.auditLog || []),
          createManualRelationshipAuditEntry({
            edge: nextEdge,
            status: "updated",
            createdAt: updatedAt,
            previousEdge: edge,
          }),
        ],
        updatedAt,
      },
    };
  },

  deleteRelationship(store, edgeId) {
    const relationshipId = edgeId?.trim();
    const edge = store.edges.find((item) => item.id === relationshipId);

    if (!edge) {
      throw new Error("关系不存在");
    }
    if (edge.source !== "manual") {
      throw new Error("只能删除手动创建的关系");
    }

    const updatedAt = new Date().toISOString();

    return {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt,
      },
      edges: store.edges.filter((item) => item.id !== relationshipId),
      sources: store.sources.filter(
        (source) => !(source.targetType === "edge" && source.targetId === relationshipId),
      ),
      auditLog: [
        ...(store.auditLog || []),
        createManualRelationshipAuditEntry({
          edge,
          status: "deleted",
          createdAt: updatedAt,
        }),
      ],
      updatedAt,
    };
  },

  addEntity(store, input) {
    const title = input.title?.trim();
    const type = input.type?.trim();
    const privacy = input.privacy?.trim();

    if (!title) {
      throw new Error("标题必填");
    }
    if (!type) {
      throw new Error("类型必填");
    }
    if (!privacy) {
      throw new Error("隐私级别必填");
    }

    const createdAt = new Date().toISOString();
    const entityId = `entity-${Date.now()}`;
    const documentId = `doc-${entityId}`;
    const sourceId = `source-${entityId}-manual`;
    const privacyAccess = updatePrivacyAccess(
      {
        privacyLevel: "medium",
        aiAccess: false,
      },
      privacy,
    );
    const relatedEntityId = input.relatedEntityId || null;
    const edges = relatedEntityId
      ? [
          createManualEdge({
            id: createEdgeId(entityId, "关联", relatedEntityId),
            fromId: entityId,
            toId: relatedEntityId,
            relationType: "关联",
            evidence: "新增资料时关联当前资料",
          }),
        ]
      : [];
    const entity = {
      id: entityId,
      title,
      type,
      icon: "NEW",
      color: "#c89cff",
      x: 42 + Math.random() * 24,
      y: 38 + Math.random() * 28,
      privacyLevel: privacyAccess.privacyLevel,
      aiAccess: privacyAccess.aiAccess,
      tags: [type],
      updated: "刚刚",
      created: "今天",
      favorite: false,
      lifecycleStatus: input.lifecycleStatus || "pending",
    };
    const document = {
      id: documentId,
      entityId,
      title: `${title} 内容`,
      kind: "note",
      body: input.summary?.trim() || `# ${title}\n- 待补充摘要、附件和关系`,
      updated: "刚刚",
    };
    const attachments = normalizeAttachmentInput(input.attachments).map((attachment, index) => ({
      id: `att-${entityId}-${index + 1}`,
      entityId,
      documentId,
      name: attachment.name,
      size: attachment.size,
      date: attachment.date,
      reference: attachment.reference,
      localCopy: attachment.localCopy,
    }));
    const source = {
      id: sourceId,
      targetType: "entity",
      targetId: entityId,
      kind: "manual",
      label: "手动创建",
    };

    return {
      entityId,
      store: {
        ...store,
        metadata: {
          ...store.metadata,
          updatedAt: createdAt,
        },
        entities: [...store.entities, entity],
        edges: [...store.edges, ...edges],
        documents: [...store.documents, document],
        attachments: [...store.attachments, ...attachments],
        sources: [
          ...store.sources,
          source,
          ...edges.map((edge) =>
            createRelationshipSource({
              edge,
              sourceKind: "manual",
              createdAt,
            }),
          ),
        ],
        auditLog: [
          ...(store.auditLog || []),
          ...edges.map((edge) =>
            createManualRelationshipAuditEntry({
              edge,
              status: "created",
              createdAt,
            }),
          ),
        ],
        updatedAt: createdAt,
      },
    };
  },

  addEntitySource(store, entityId, input = {}) {
    const entity = store.entities.find((item) => item.id === entityId);
    const label = input.label?.trim();

    if (!entity) {
      throw new Error("资料不存在");
    }
    if (!label) {
      throw new Error("来源说明必填");
    }

    const createdAt = new Date().toISOString();
    const sourceId = `source-${entityId}-manual-${Date.now()}`;
    const source = {
      id: sourceId,
      targetType: "entity",
      targetId: entityId,
      kind: "manual",
      label,
      createdAt,
    };

    return {
      sourceId,
      store: {
        ...store,
        metadata: {
          ...store.metadata,
          updatedAt: createdAt,
        },
        sources: [...store.sources, source],
        entities: store.entities.map((item) =>
          item.id === entityId
            ? {
                ...item,
                updated: "刚刚",
              }
            : item,
        ),
        updatedAt: createdAt,
      },
    };
  },

  addEntityAttachment(store, entityId, input = {}) {
    const entity = store.entities.find((item) => item.id === entityId);
    const document = store.documents.find((item) => item.entityId === entityId);
    const name = input.name?.trim();

    if (!entity) {
      throw new Error("资料不存在");
    }
    if (!document) {
      throw new Error("资料内容不存在");
    }
    if (!name) {
      throw new Error("附件名称必填");
    }
    if (
      store.attachments.some(
        (attachment) => attachment.entityId === entityId && attachment.name === name,
      )
    ) {
      throw new Error("附件索引已存在");
    }

    const updatedAt = new Date().toISOString();
    const attachmentId = createUniqueAttachmentId(store, entityId);
    const attachment = {
      id: attachmentId,
      entityId,
      documentId: document.id,
      name,
      size: input.size?.trim() || "索引",
      date: input.date?.trim() || "今天",
      reference: input.reference?.trim() || "",
      localCopy: normalizeLocalCopy(input.localCopy),
    };

    return {
      attachmentId,
      store: {
        ...store,
        metadata: {
          ...store.metadata,
          updatedAt,
        },
        attachments: [...store.attachments, attachment],
        entities: store.entities.map((item) =>
          item.id === entityId
            ? {
                ...item,
                updated: "刚刚",
              }
            : item,
        ),
        updatedAt,
      },
    };
  },

  updateEntityAttachment(store, attachmentId, input = {}) {
    const attachment = store.attachments.find((item) => item.id === attachmentId);
    const name = input.name?.trim();

    if (!attachment) {
      throw new Error("附件索引不存在");
    }
    if (!name) {
      throw new Error("附件名称必填");
    }
    if (
      store.attachments.some(
        (item) =>
          item.id !== attachmentId &&
          item.entityId === attachment.entityId &&
          item.name === name,
      )
    ) {
      throw new Error("附件索引已存在");
    }

    const updatedAt = new Date().toISOString();

    return {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt,
      },
      attachments: store.attachments.map((item) =>
        item.id === attachmentId
          ? {
              ...item,
              name,
              size: input.size?.trim() || "索引",
              date: input.date?.trim() || "今天",
              reference: input.reference?.trim() || "",
              localCopy: normalizeLocalCopy(input.localCopy ?? item.localCopy),
            }
          : item,
      ),
      entities: store.entities.map((item) =>
        item.id === attachment.entityId
          ? {
              ...item,
              updated: "刚刚",
            }
          : item,
      ),
      updatedAt,
    };
  },

  deleteEntityAttachment(store, attachmentId) {
    const attachment = store.attachments.find((item) => item.id === attachmentId);

    if (!attachment) {
      throw new Error("附件索引不存在");
    }

    const updatedAt = new Date().toISOString();

    return {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt,
      },
      attachments: store.attachments.filter((item) => item.id !== attachmentId),
      entities: store.entities.map((item) =>
        item.id === attachment.entityId
          ? {
              ...item,
              updated: "刚刚",
            }
          : item,
      ),
      updatedAt,
    };
  },

  updateEntitySource(store, sourceId, input = {}) {
    const source = store.sources.find((item) => item.id === sourceId);
    const label = input.label?.trim();

    if (!source || source.targetType !== "entity") {
      throw new Error("来源不存在");
    }
    if (source.kind !== "manual" || !source.createdAt) {
      throw new Error("只能编辑手动补充的来源");
    }
    if (!label) {
      throw new Error("来源说明必填");
    }

    const updatedAt = new Date().toISOString();

    return {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt,
      },
      sources: store.sources.map((item) =>
        item.id === sourceId
          ? {
              ...item,
              label,
              updatedAt,
            }
          : item,
      ),
      entities: store.entities.map((item) =>
        item.id === source.targetId
          ? {
              ...item,
              updated: "刚刚",
            }
          : item,
      ),
      updatedAt,
    };
  },

  deleteEntitySource(store, sourceId) {
    const source = store.sources.find((item) => item.id === sourceId);

    if (!source || source.targetType !== "entity") {
      throw new Error("来源不存在");
    }
    if (source.kind !== "manual" || !source.createdAt) {
      throw new Error("只能移除手动补充的来源");
    }

    const updatedAt = new Date().toISOString();

    return {
      ...store,
      metadata: {
        ...store.metadata,
        updatedAt,
      },
      sources: store.sources.filter((item) => item.id !== sourceId),
      entities: store.entities.map((item) =>
        item.id === source.targetId
          ? {
              ...item,
              updated: "刚刚",
            }
          : item,
      ),
      updatedAt,
    };
  },

  addQuickNote(store) {
    return this.addEntity(store, {
      title: "新的个人笔记",
      type: "笔记",
      privacy: "中（本地保存）",
      summary: "# 新的个人笔记\n- 在这里记录一条新的个人资料线索\n- 可继续补充标签、附件和关系",
      relatedEntityId: "passport",
    });
  },
};

export function getReverseRelationshipType(relationType) {
  const normalizedRelationType = String(relationType || "").trim();
  const reverseRelationshipTypes = {
    属于: "包含",
    包含: "属于",
    证明: "被证明",
    被证明: "证明",
    使用: "被使用",
    被使用: "使用",
    提醒: "被提醒",
    被提醒: "提醒",
    归档: "被归档",
    被归档: "归档",
    依赖: "被依赖",
    被依赖: "依赖",
  };

  return reverseRelationshipTypes[normalizedRelationType] || normalizedRelationType;
}

function cloneStore(store) {
  return JSON.parse(JSON.stringify(store));
}

function normalizeGraphPosition(position) {
  return {
    x: normalizeGraphCoordinate(position?.x),
    y: normalizeGraphCoordinate(position?.y),
  };
}

function normalizeGraphCoordinate(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error("节点坐标必须是数字");
  }

  return Math.round(Math.min(Math.max(number, 0), 100) * 100) / 100;
}

function createUniqueLayoutCopyTitle(title, snapshots) {
  const baseTitle = `${title} 副本`;
  const existingTitles = new Set(snapshots.map((snapshot) => snapshot.title));

  if (!existingTitles.has(baseTitle)) return baseTitle;

  let copyIndex = 2;
  while (existingTitles.has(`${baseTitle} ${copyIndex}`)) {
    copyIndex += 1;
  }

  return `${baseTitle} ${copyIndex}`;
}

function normalizeTagInput(value) {
  return String(value || "")
    .trim()
    .replace(/^#+/, "")
    .trim()
    .replace(/\s+/g, " ");
}

function createManualEdge({ id, fromId, toId, relationType, evidence }) {
  return {
    id,
    fromId,
    toId,
    relationType,
    label: relationType,
    source: "manual",
    ...(evidence ? { evidence } : {}),
  };
}

function createManualRelationshipAuditEntry({
  edge,
  status,
  createdAt,
  previousEdge = null,
}) {
  return {
    id: `audit-${edge.id}-${status}-${Date.now()}`,
    kind: "manual-relationship",
    status,
    edgeId: edge.id,
    fromId: edge.fromId,
    toId: edge.toId,
    relationType: edge.relationType,
    evidence: edge.evidence || "",
    previousEdgeId: previousEdge?.id || "",
    previousToId: previousEdge?.toId || "",
    previousRelationType: previousEdge?.relationType || "",
    previousEvidence: previousEdge?.evidence || "",
    createdAt,
  };
}

export function createRelationshipSource({ edge, sourceKind, createdAt }) {
  const kind = sourceKind || edge.source || "manual";
  return {
    id: `source-${edge.id}-${kind}`,
    targetType: "edge",
    targetId: edge.id,
    kind,
    label: edge.evidence ? `关系依据：${edge.evidence}` : getRelationshipSourceLabel(kind),
    ...(edge.evidence ? { evidence: edge.evidence } : {}),
    createdAt,
  };
}

function getRelationshipSourceLabel(kind) {
  if (kind === "manual") return "手动创建关系";
  if (kind === "suggestion") return "AI 建议确认关系";
  if (kind === "seed") return "示例关系来源";
  return "关系来源待确认";
}

function normalizeAttachmentInput(attachments) {
  if (Array.isArray(attachments)) {
    return attachments
      .map((attachment) => ({
        name: attachment.name?.trim(),
        size: attachment.size?.trim() || "索引",
        date: attachment.date?.trim() || "今天",
        reference: attachment.reference?.trim() || "",
        localCopy: normalizeLocalCopy(attachment.localCopy),
      }))
      .filter((attachment) => attachment.name);
  }

  if (typeof attachments !== "string") return [];

  return attachments
    .split(/[\n,，]+/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      size: "索引",
      date: "今天",
      reference: "",
      localCopy: null,
    }));
}

function createUniqueAttachmentId(store, entityId) {
  const existingIds = new Set(store.attachments.map((attachment) => attachment.id));
  const timestamp = Date.now();
  let index = 0;
  let id = `att-${entityId}-manual-${timestamp}`;

  while (existingIds.has(id)) {
    index += 1;
    id = `att-${entityId}-manual-${timestamp}-${index}`;
  }

  return id;
}

function normalizeLocalCopy(localCopy) {
  if (!localCopy || typeof localCopy !== "object") return null;

  return {
    storageKey: String(localCopy.storageKey || ""),
    mimeType: String(localCopy.mimeType || "application/octet-stream"),
    byteSize: Number(localCopy.byteSize) || 0,
    contentHash: String(localCopy.contentHash || ""),
    contentEncoding: String(localCopy.contentEncoding || ""),
    contentBase64: String(localCopy.contentBase64 || ""),
    textPreview: String(localCopy.textPreview || ""),
    copyStatus: String(localCopy.copyStatus || ""),
    copyLimitBytes: Number(localCopy.copyLimitBytes) || 0,
  };
}
