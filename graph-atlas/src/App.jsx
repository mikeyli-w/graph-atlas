import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { selectLegacyNodes } from "./data/seedKnowledgeStore.js";
import { selectAiContextPreview } from "./selectors/aiContextSelectors.js";
import { selectCitedAnswerDraft } from "./selectors/citedAnswerSelectors.js";
import { selectDetailViewModel } from "./selectors/detailSelectors.js";
import { selectGraphViewModel } from "./selectors/graphSelectors.js";
import { selectHomeSummary } from "./selectors/homeSelectors.js";
import { selectInboxViewModel } from "./selectors/inboxSelectors.js";
import { selectLayoutVersionViewModel } from "./selectors/layoutVersionSelectors.js";
import { selectRecentViewModel } from "./selectors/recentSelectors.js";
import { selectRelationshipSuggestions } from "./selectors/relationshipSuggestionSelectors.js";
import { selectSearchViewModel } from "./selectors/searchSelectors.js";
import { selectSettingsViewModel } from "./selectors/settingsSelectors.js";
import { selectSummarySuggestions } from "./selectors/summarySuggestionSelectors.js";
import { selectTagSuggestions } from "./selectors/tagSuggestionSelectors.js";
import {
  selectVaultTreeSummary,
  selectVaultTreeViewModel,
} from "./selectors/vaultTreeSelectors.js";
import { backfillLargeFileCopies } from "./services/attachmentBackfillService.js";
import { inboxService } from "./services/inboxService.js";
import { getReverseRelationshipType, knowledgeService } from "./services/knowledgeService.js";
import { relationshipSuggestionService } from "./services/relationshipSuggestionService.js";
import { summarySuggestionService } from "./services/summarySuggestionService.js";
import { tagSuggestionService } from "./services/tagSuggestionService.js";
import {
  clearAttachmentDirectoryHandle,
  createBrowserAttachmentStorageAdapter,
  loadAttachmentDirectoryHandle,
  queryAttachmentDirectoryPermission,
  requestAttachmentDirectoryPermission,
  saveAttachmentDirectoryHandle,
} from "./storage/attachmentStorageAdapter.js";
import {
  createBackupPackage,
  createEncryptedBackupPackage,
  parseBackupPackage,
  parseBackupPackageImport,
  restoreBackupPackage,
  summarizeBackupPackage,
} from "./storage/backupPackage.js";
import {
  clearCloudSyncConfig,
  createHttpCloudSyncAdapter,
  loadCloudSyncConfig,
  saveCloudSyncConfig,
} from "./storage/cloudSyncAdapter.js";
import { summarizeCloudSnapshotDiff } from "./storage/cloudSnapshotDiff.js";
import {
  addInboxAttachmentFileRowsWithContent,
  addInboxAttachmentRow,
  collectAttachmentRows,
  createInboxAttachmentRows,
  removeInboxAttachmentRow,
  serializeAttachmentLocalCopy,
  updateInboxAttachmentRow,
} from "./ui/inboxAttachmentRows.js";
import {
  createEntityNavigationHistory,
  goBackInEntityHistory,
  goForwardInEntityHistory,
  selectEntityNavigationState,
  visitEntity,
} from "./ui/entityNavigationHistory.js";
import {
  cancelLayoutApply,
  clearLayoutApplyState,
  consumeLayoutUndo,
  createLayoutApplyState,
  markLayoutApplied,
  requestLayoutApply,
} from "./ui/layoutApplyState.js";
import {
  cancelReset,
  confirmReset,
  createResetActionState,
  requestReset,
} from "./ui/resetActionState.js";
import {
  defaultRelationshipTemplateTypes,
  loadRelationshipTemplates,
  saveRelationshipTemplates,
  validateRelationshipTemplate,
} from "./ui/relationshipTemplates.js";

const tabs = ["概览", "属性", "关系", "历史"];
const defaultAddForm = {
  title: "",
  type: "笔记",
  privacy: "中（本地保存）",
  summary: "",
  linkToActive: true,
};
const defaultInboxForm = {
  title: "",
  type: "笔记",
  privacy: "中（本地保存）",
  summary: "",
  attachments: "",
};
const defaultAttachmentForm = {
  name: "",
  size: "",
  date: "",
  reference: "",
};
const defaultEntityInfoForm = {
  title: "",
  type: "",
};
const defaultAiQuestion = "旅行相关资料在哪里？";
const relationshipTypes = ["属于", "关联", "包含", "证明", "使用", "提醒", "归档", "联系人", "依赖"];
const defaultRelationshipForm = {
  targetId: "",
  relationType: "关联",
  evidence: "",
  reciprocal: false,
};
const defaultRelationshipSuggestionForm = {
  targetId: "",
  relationType: "",
  evidence: "",
};
const defaultTagSuggestionForm = {
  tag: "",
};
const defaultSummarySuggestionForm = {
  summary: "",
};
const remoteAttachmentConfigKey = "graph-atlas-remote-attachment-config";

function inferDraftTypeFromTitle(title) {
  if (title.includes("联系人")) return "联系人";
  if (title.includes("证书") || title.includes("合同") || title.includes("附件")) return "文件";
  if (title.includes("资料")) return "档案";
  return "笔记";
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches;
}

function loadRemoteAttachmentConfig() {
  const fallback = {
    endpoint: "",
    token: "",
    lastStatus: "idle",
    error: "",
    success: "",
  };

  if (typeof localStorage === "undefined") return fallback;

  try {
    const parsed = JSON.parse(localStorage.getItem(remoteAttachmentConfigKey) || "{}");

    return {
      ...fallback,
      endpoint: parsed.endpoint || "",
      token: parsed.token || "",
      lastStatus: parsed.lastStatus || (parsed.endpoint ? "configured" : "idle"),
    };
  } catch {
    return fallback;
  }
}

function persistRemoteAttachmentConfig(config) {
  if (typeof localStorage === "undefined") return;

  localStorage.setItem(
    remoteAttachmentConfigKey,
    JSON.stringify({
      endpoint: config.endpoint || "",
      token: config.token || "",
      lastStatus: config.lastStatus || "idle",
    }),
  );
}

export function App() {
  const [store, setStore] = useState(() => knowledgeService.loadStore());
  const [entityHistory, setEntityHistory] = useState(() =>
    createEntityNavigationHistory("passport"),
  );
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("概览");
  const [tagFilter, setTagFilter] = useState("全部");
  const [privacyFilter, setPrivacyFilter] = useState("全部隐私");
  const [zoom, setZoom] = useState(100);
  const [graphPan, setGraphPan] = useState({ x: 0, y: 0 });
  const [activeView, setActiveView] = useState("graph");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(defaultAddForm);
  const [addError, setAddError] = useState("");
  const [inboxForm, setInboxForm] = useState(defaultInboxForm);
  const [inboxError, setInboxError] = useState("");
  const [inboxSuccess, setInboxSuccess] = useState("");
  const [inboxConfirmSuccess, setInboxConfirmSuccess] = useState(null);
  const [inboxAttachmentDrafts, setInboxAttachmentDrafts] = useState({});
  const [pendingInboxRejectId, setPendingInboxRejectId] = useState("");
  const [pendingInboxAttachmentRemoveId, setPendingInboxAttachmentRemoveId] = useState("");
  const [aiQuestion, setAiQuestion] = useState(defaultAiQuestion);
  const [submittedAiQuestion, setSubmittedAiQuestion] = useState("");
  const [dragPreview, setDragPreview] = useState(null);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [layoutTitle, setLayoutTitle] = useState("");
  const [layoutNote, setLayoutNote] = useState("");
  const [layoutApplyState, setLayoutApplyState] = useState(createLayoutApplyState);
  const [pendingLayoutDeleteId, setPendingLayoutDeleteId] = useState("");
  const [layoutResetPending, setLayoutResetPending] = useState(false);
  const [layoutSaveStatus, setLayoutSaveStatus] = useState("");
  const [resetActionState, setResetActionState] = useState(createResetActionState);
  const [resetSuccess, setResetSuccess] = useState("");
  const [settingsResetPending, setSettingsResetPending] = useState(false);
  const [backupState, setBackupState] = useState({
    pendingPackage: null,
    summary: null,
    encryptedImportText: "",
    encryptedImportFileName: "",
    needsPassword: false,
    error: "",
    success: "",
  });
  const [backupEncryptionState, setBackupEncryptionState] = useState({
    exportEncrypted: false,
    exportPassword: "",
    importPassword: "",
  });
  const [backfillState, setBackfillState] = useState({
    error: "",
    success: "",
  });
  const [attachmentDirectoryState, setAttachmentDirectoryState] = useState(() => ({
    supported: typeof globalThis.showDirectoryPicker === "function",
    directoryHandle: null,
    permissionState: "not-configured",
    error: "",
    success: "",
  }));
  const [remoteAttachmentState, setRemoteAttachmentState] = useState(loadRemoteAttachmentConfig);
  const [cloudSyncState, setCloudSyncState] = useState(() => ({
    ...loadCloudSyncConfig(),
    error: "",
    success: "",
    latestSnapshot: null,
  }));
  const [pendingDirectoryClear, setPendingDirectoryClear] = useState(false);
  const [pendingRemoteConfigClear, setPendingRemoteConfigClear] = useState(false);
  const [pendingCloudSyncClear, setPendingCloudSyncClear] = useState(false);
  const [pendingCloudSnapshotPush, setPendingCloudSnapshotPush] = useState(false);
  const [showTagForm, setShowTagForm] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [tagError, setTagError] = useState("");
  const [tagSuccess, setTagSuccess] = useState("");
  const [editingTag, setEditingTag] = useState("");
  const [editingTagDraft, setEditingTagDraft] = useState("");
  const [pendingTagDelete, setPendingTagDelete] = useState("");
  const [editingTagSuggestionId, setEditingTagSuggestionId] = useState("");
  const [tagSuggestionForm, setTagSuggestionForm] = useState(defaultTagSuggestionForm);
  const [tagSuggestionError, setTagSuggestionError] = useState("");
  const [tagSuggestionSuccess, setTagSuggestionSuccess] = useState("");
  const [showRelationshipForm, setShowRelationshipForm] = useState(false);
  const [relationshipForm, setRelationshipForm] = useState(defaultRelationshipForm);
  const [relationshipError, setRelationshipError] = useState("");
  const [relationshipSuccess, setRelationshipSuccess] = useState("");
  const [editingRelationshipId, setEditingRelationshipId] = useState("");
  const [pendingRelationshipDeleteId, setPendingRelationshipDeleteId] = useState("");
  const [relationshipTemplates, setRelationshipTemplates] = useState(loadRelationshipTemplates);
  const [relationshipTemplateDraft, setRelationshipTemplateDraft] = useState("");
  const [relationshipTemplateError, setRelationshipTemplateError] = useState("");
  const [relationshipTemplateSuccess, setRelationshipTemplateSuccess] = useState("");
  const [showAttachmentForm, setShowAttachmentForm] = useState(false);
  const [attachmentForm, setAttachmentForm] = useState(defaultAttachmentForm);
  const [attachmentError, setAttachmentError] = useState("");
  const [attachmentSuccess, setAttachmentSuccess] = useState("");
  const [editingAttachmentId, setEditingAttachmentId] = useState("");
  const [pendingAttachmentDeleteId, setPendingAttachmentDeleteId] = useState("");
  const [editingRelationshipSuggestionId, setEditingRelationshipSuggestionId] = useState("");
  const [relationshipSuggestionForm, setRelationshipSuggestionForm] = useState(
    defaultRelationshipSuggestionForm,
  );
  const [relationshipSuggestionError, setRelationshipSuggestionError] = useState("");
  const [relationshipSuggestionSuccess, setRelationshipSuggestionSuccess] = useState("");
  const [editingSummarySuggestionId, setEditingSummarySuggestionId] = useState("");
  const [summarySuggestionForm, setSummarySuggestionForm] = useState(defaultSummarySuggestionForm);
  const [summarySuggestionError, setSummarySuggestionError] = useState("");
  const [summarySuggestionSuccess, setSummarySuggestionSuccess] = useState("");
  const [entityInfoForm, setEntityInfoForm] = useState(defaultEntityInfoForm);
  const [entityInfoError, setEntityInfoError] = useState("");
  const [entityInfoSuccess, setEntityInfoSuccess] = useState("");
  const [markdownSaveStatus, setMarkdownSaveStatus] = useState("");
  const [privacySaveStatus, setPrivacySaveStatus] = useState("");
  const [favoriteSaveStatus, setFavoriteSaveStatus] = useState("");
  const [sourceDraft, setSourceDraft] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [sourceSuccess, setSourceSuccess] = useState("");
  const [editingSourceId, setEditingSourceId] = useState("");
  const [editingSourceDraft, setEditingSourceDraft] = useState("");
  const [pendingSourceDeleteId, setPendingSourceDeleteId] = useState("");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState("home");
  const searchInputRef = useRef(null);
  const homeSummaryRef = useRef(null);
  const graphCanvasRef = useRef(null);
  const detailTagsRef = useRef(null);
  const detailRelationshipsRef = useRef(null);
  const detailAttachmentsRef = useRef(null);
  const detailSourcesRef = useRef(null);
  const markdownEditorRef = useRef(null);
  const sourceInputRef = useRef(null);
  const canvasRef = useRef(null);
  const didHydrateRef = useRef(false);
  const nodeDragRef = useRef(null);
  const graphGestureRef = useRef({ pointers: new Map(), pinch: null, pan: null, didPinch: false });
  const graphInertiaRef = useRef({ frameId: null });

  const nodes = useMemo(() => selectLegacyNodes(store), [store]);
  const navigationState = useMemo(
    () => selectEntityNavigationState(entityHistory),
    [entityHistory],
  );
  const activeId = navigationState.current;
  const graphViewModel = useMemo(() => selectGraphViewModel(store), [store]);
  const detailViewModel = useMemo(
    () => selectDetailViewModel(store, activeId),
    [store, activeId],
  );
  const homeSummary = useMemo(() => selectHomeSummary(store), [store]);
  const inboxViewModel = useMemo(() => selectInboxViewModel(store), [store]);
  const layoutVersionViewModel = useMemo(
    () => selectLayoutVersionViewModel(store),
    [store],
  );
  const recentViewModel = useMemo(
    () => selectRecentViewModel(store, { expanded: recentExpanded }),
    [store, recentExpanded],
  );
  const attachmentStorageOptions = useMemo(
    () => ({
      fileSystem: {
        supported: attachmentDirectoryState.supported,
        configured: Boolean(attachmentDirectoryState.directoryHandle),
        directoryHandle: attachmentDirectoryState.directoryHandle,
        permissionState: attachmentDirectoryState.permissionState,
      },
      backend: {
        endpoint: remoteAttachmentState.endpoint,
        lastStatus: remoteAttachmentState.lastStatus,
      },
    }),
    [
      attachmentDirectoryState.directoryHandle,
      attachmentDirectoryState.permissionState,
      attachmentDirectoryState.supported,
      remoteAttachmentState.endpoint,
      remoteAttachmentState.lastStatus,
    ],
  );
  const settingsViewModel = useMemo(
    () =>
      selectSettingsViewModel(store, {
        attachmentStorage: attachmentStorageOptions,
        cloudSync: cloudSyncState,
      }),
    [attachmentStorageOptions, cloudSyncState, store],
  );
  const vaultTreeViewModel = useMemo(() => selectVaultTreeViewModel(store), [store]);
  const vaultTreeSummary = useMemo(() => selectVaultTreeSummary(store), [store]);
  const attachmentStorageAdapter = useMemo(
    () =>
      createBrowserAttachmentStorageAdapter({
        directoryHandle: attachmentDirectoryState.permissionState === "granted"
          ? attachmentDirectoryState.directoryHandle
          : null,
        fileSystemPermissionState: attachmentDirectoryState.permissionState,
        remote: remoteAttachmentState.endpoint
          ? {
              endpoint: remoteAttachmentState.endpoint,
              token: remoteAttachmentState.token,
            }
          : null,
      }),
    [
      attachmentDirectoryState.directoryHandle,
      attachmentDirectoryState.permissionState,
      remoteAttachmentState.endpoint,
      remoteAttachmentState.token,
    ],
  );
  const searchViewModel = useMemo(
    () => selectSearchViewModel(store, { query, tagFilter, privacyFilter }),
    [store, query, tagFilter, privacyFilter],
  );
  const aiContextPreview = useMemo(
    () =>
      selectAiContextPreview(
        store,
        searchViewModel.hasActiveQuery
          ? { candidateEntityIds: searchViewModel.visibleEntityIds }
          : {},
      ),
    [store, searchViewModel.hasActiveQuery, searchViewModel.visibleEntityIds],
  );
  const relationshipSuggestions = useMemo(
    () => selectRelationshipSuggestions(store, activeId),
    [store, activeId],
  );
  const tagSuggestions = useMemo(
    () => selectTagSuggestions(store, activeId),
    [store, activeId],
  );
  const summarySuggestions = useMemo(
    () => selectSummarySuggestions(store, activeId),
    [store, activeId],
  );
  const citedAnswerDraft = useMemo(
    () =>
      submittedAiQuestion
        ? selectCitedAnswerDraft(
            store,
            {
              query: submittedAiQuestion,
              candidateEntityIds: searchViewModel.hasActiveQuery
                ? searchViewModel.visibleEntityIds
                : null,
            },
          )
        : null,
    [store, submittedAiQuestion, searchViewModel.hasActiveQuery, searchViewModel.visibleEntityIds],
  );
  const activeNode = nodes.find((node) => node.id === activeId) || nodes[0];
  const allTags = useMemo(
    () => ["全部", ...Array.from(new Set(nodes.flatMap((node) => node.tags)))],
    [nodes],
  );
  const relationshipTargetOptions = useMemo(
    () => nodes.filter((node) => node.id !== activeId),
    [nodes, activeId],
  );
  const selectedRelationshipTarget = useMemo(
    () => relationshipTargetOptions.find((node) => node.id === relationshipForm.targetId),
    [relationshipForm.targetId, relationshipTargetOptions],
  );
  const relationshipTypeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...relationshipTypes,
          ...relationshipTemplates,
          ...store.edges
            .map((edge) => (edge.relationType || edge.label || "").trim())
            .filter(Boolean),
        ]),
      ),
    [relationshipTemplates, store.edges],
  );
  const relationshipFormTypeOptions = useMemo(
    () =>
      Array.from(new Set([relationshipForm.relationType, ...relationshipTypeOptions].filter(Boolean))),
    [relationshipForm.relationType, relationshipTypeOptions],
  );
  const reverseRelationshipType = getReverseRelationshipType(relationshipForm.relationType);
  const graphZoomStatusLabel = `当前缩放 ${zoom}%`;
  const sidebarTags = allTags.slice(1);
  const primarySidebarTags = sidebarTags.slice(0, 6);
  const secondarySidebarTags = sidebarTags.slice(6);

  const filteredNodes = useMemo(() => {
    const visibleEntityIds = new Set(searchViewModel.visibleEntityIds);
    return nodes.filter((node) => visibleEntityIds.has(node.id));
  }, [nodes, searchViewModel.visibleEntityIds]);
  const visibleNodes = useMemo(
    () =>
      filteredNodes.map((node) =>
        dragPreview?.entityId === node.id
          ? {
              ...node,
              x: dragPreview.x,
              y: dragPreview.y,
            }
          : node,
      ),
    [dragPreview, filteredNodes],
  );
  const graphEdges = useMemo(() => {
    if (!dragPreview) return graphViewModel.edges;

    return graphViewModel.edges.map((edge) => ({
      ...edge,
      from:
        edge.fromId === dragPreview.entityId
          ? { x: dragPreview.x, y: dragPreview.y }
          : edge.from,
      to:
        edge.toId === dragPreview.entityId
          ? { x: dragPreview.x, y: dragPreview.y }
          : edge.to,
    }));
  }, [dragPreview, graphViewModel.edges]);
  const graphFocus = useMemo(() => {
    const relatedIds = new Set([activeId]);
    let directRelationshipCount = 0;

    for (const edge of graphViewModel.edges) {
      if (edge.fromId === activeId) {
        relatedIds.add(edge.toId);
        directRelationshipCount += 1;
      } else if (edge.toId === activeId) {
        relatedIds.add(edge.fromId);
        directRelationshipCount += 1;
      }
    }

    return {
      relatedIds,
      directRelationshipCount,
      summary: `${activeNode.title} · ${directRelationshipCount} 条直接关系 · ${filteredNodes.length} 个节点可见`,
    };
  }, [activeId, activeNode.title, filteredNodes.length, graphViewModel.edges]);

  useEffect(() => {
    if (!didHydrateRef.current) {
      didHydrateRef.current = true;
      return;
    }

    knowledgeService.saveStore(store);
  }, [store]);

  useEffect(() => {
    let active = true;

    async function loadDirectoryHandle() {
      if (typeof globalThis.showDirectoryPicker !== "function") {
        setAttachmentDirectoryState((current) => ({
          ...current,
          supported: false,
          directoryHandle: null,
          permissionState: "unsupported",
        }));
        return;
      }

      try {
        const directoryHandle = await loadAttachmentDirectoryHandle();
        const permissionState = directoryHandle
          ? await queryAttachmentDirectoryPermission(directoryHandle)
          : "not-configured";

        if (!active) return;

        setAttachmentDirectoryState((current) => ({
          ...current,
          supported: true,
          directoryHandle,
          permissionState,
          error: "",
        }));
      } catch (error) {
        if (!active) return;

        setAttachmentDirectoryState((current) => ({
          ...current,
          supported: true,
          directoryHandle: null,
          permissionState: "not-configured",
          error: error.message,
        }));
      }
    }

    void loadDirectoryHandle();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setInboxConfirmSuccess((current) =>
      current?.entityId === activeId ? current : null,
    );
  }, [activeId]);

  useEffect(() => {
    const handleSearchShortcut = (event) => {
      const isSearchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const activeElement = document.activeElement;
      const isEditingField =
        activeElement &&
        activeElement !== searchInputRef.current &&
        (["INPUT", "SELECT", "TEXTAREA"].includes(activeElement.tagName) ||
          activeElement.isContentEditable);

      if (isSearchShortcut && isEditingField) {
        event.preventDefault();
        return;
      }

      if (isSearchShortcut) {
        event.preventDefault();
        setActiveView("graph");
        setMobileSection("home");
        setMobileDetailOpen(false);
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === "Escape" && document.activeElement === searchInputRef.current && query) {
        event.preventDefault();
        setQuery("");
      }
    };

    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, [query]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawGraph(ctx, rect.width, rect.height, graphEdges, activeId, zoom, graphPan);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [graphEdges, activeId, zoom, graphPan]);

  useEffect(() => {
    setShowTagForm(false);
    setTagDraft("");
    setTagError("");
    setTagSuccess("");
    setEditingTag("");
    setEditingTagDraft("");
    setPendingTagDelete("");
    setEditingTagSuggestionId("");
    setTagSuggestionForm(defaultTagSuggestionForm);
    setTagSuggestionError("");
    setTagSuggestionSuccess("");
    setShowRelationshipForm(false);
    setRelationshipForm(defaultRelationshipForm);
    setRelationshipError("");
    setRelationshipSuccess("");
    setEditingRelationshipId("");
    setPendingRelationshipDeleteId("");
    setShowAttachmentForm(false);
    setAttachmentForm(defaultAttachmentForm);
    setAttachmentError("");
    setAttachmentSuccess("");
    setEditingAttachmentId("");
    setPendingAttachmentDeleteId("");
    setEditingRelationshipSuggestionId("");
    setRelationshipSuggestionForm(defaultRelationshipSuggestionForm);
    setRelationshipSuggestionError("");
    setRelationshipSuggestionSuccess("");
    setEditingSummarySuggestionId("");
    setSummarySuggestionForm(defaultSummarySuggestionForm);
    setSummarySuggestionError("");
    setSummarySuggestionSuccess("");
    setEntityInfoForm({
      title: activeNode.title,
      type: activeNode.type,
    });
    setEntityInfoError("");
    setEntityInfoSuccess("");
    setMarkdownSaveStatus("");
    setPrivacySaveStatus("");
    setFavoriteSaveStatus("");
    setSourceDraft("");
    setSourceError("");
    setSourceSuccess("");
    setEditingSourceId("");
    setEditingSourceDraft("");
    setPendingSourceDeleteId("");
  }, [activeId]);

  useEffect(() => {
    setEntityInfoForm({
      title: activeNode.title,
      type: activeNode.type,
    });
  }, [activeNode.title, activeNode.type]);

  const updateActive = (patch) => {
    setStore((current) => knowledgeService.updateEntity(current, activeId, patch));
  };

  const updateEntityInfoForm = (patch) => {
    setEntityInfoForm((current) => ({ ...current, ...patch }));
    setEntityInfoError("");
    setEntityInfoSuccess("");
  };

  const updatePrivacyLevel = (privacy) => {
    updateActive({ privacy });
    setPrivacySaveStatus("隐私级别已保存到本地。");
  };

  const toggleFavorite = () => {
    const nextFavorite = !activeNode.favorite;
    updateActive({ favorite: nextFavorite });
    setFavoriteSaveStatus(nextFavorite ? "已加入收藏。" : "已取消收藏。");
  };

  const submitEntityInfoForm = (event) => {
    event.preventDefault();

    try {
      setStore((current) => knowledgeService.updateEntity(current, activeId, entityInfoForm));
      setEntityInfoError("");
      setEntityInfoSuccess(`基本信息已保存：${entityInfoForm.title.trim()} · ${entityInfoForm.type.trim()}。`);
    } catch (error) {
      setEntityInfoError(error.message);
      setEntityInfoSuccess("");
    }
  };

  const openEntity = (entityId, options = {}) => {
    setEntityHistory((current) => visitEntity(current, entityId));

    if (options.revealDetailOnMobile && isMobileViewport()) {
      setActiveView("graph");
      setMobileDetailOpen(true);
      setMobileSection("detail");
    }
  };

  const navigateToEntity = (entityId) => {
    openEntity(entityId);
  };

  const scrollMobileTargetIntoView = (ref) => {
    if (typeof window === "undefined") return;

    window.requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const activateMobileSection = (section) => {
    setMobileSection(section);

    if (section === "detail") {
      setActiveView("graph");
      setMobileDetailOpen(true);
      return;
    }

    setMobileDetailOpen(false);

    if (section === "inbox") {
      setActiveView("inbox");
      return;
    }

    if (section === "settings") {
      setActiveView("settings");
      return;
    }

    setActiveView("graph");
    scrollMobileTargetIntoView(section === "graph" ? graphCanvasRef : homeSummaryRef);
  };

  const resetMobileGraphView = () => {
    stopGraphInertia();
    graphGestureRef.current = { pointers: new Map(), pinch: null, pan: null, didPinch: false };
    setZoom(100);
    setGraphPan({ x: 0, y: 0 });
    setActiveView("graph");
    setMobileDetailOpen(false);
    setMobileSection("graph");
    scrollMobileTargetIntoView(graphCanvasRef);
  };

  const openCurrentDetailOnMobile = () => {
    setActiveView("graph");
    setMobileDetailOpen(true);
    setMobileSection("detail");
  };

  const openAddForm = () => {
    setActiveView("inbox");
    setMobileDetailOpen(false);
    setMobileSection("inbox");
    setShowAddForm(false);
    setInboxError("");
    setInboxSuccess("");
  };

  const startInboxDraftFromTree = (title) => {
    setInboxForm({
      ...defaultInboxForm,
      title,
      type: inferDraftTypeFromTitle(title),
    });
    setInboxError("");
    setInboxSuccess("");
    setActiveView("inbox");
    setMobileDetailOpen(false);
    setMobileSection("inbox");
    setShowAddForm(false);
  };

  const updateAddForm = (patch) => {
    setAddForm((current) => ({ ...current, ...patch }));
    setAddError("");
  };

  const submitAddForm = (event) => {
    event.preventDefault();

    try {
      const result = knowledgeService.addEntity(store, {
        ...addForm,
        relatedEntityId: addForm.linkToActive ? activeId : null,
      });
      setStore(result.store);
      navigateToEntity(result.entityId);
      setActiveTab("概览");
      setShowAddForm(false);
      setAddForm(defaultAddForm);
      setAddError("");
    } catch (error) {
      setAddError(error.message);
    }
  };

  const updateInboxForm = (patch) => {
    setInboxForm((current) => ({ ...current, ...patch }));
    setInboxError("");
    setInboxSuccess("");
  };

  const updateAttachmentForm = (patch) => {
    setAttachmentForm((current) => ({ ...current, ...patch }));
    setAttachmentError("");
    setAttachmentSuccess("");
  };

  const startAttachmentCreate = () => {
    setShowAttachmentForm(true);
    setEditingAttachmentId("");
    setAttachmentForm(defaultAttachmentForm);
    setAttachmentError("");
    setAttachmentSuccess("");
    setPendingAttachmentDeleteId("");
  };

  const startAttachmentEdit = (attachment) => {
    setShowAttachmentForm(true);
    setEditingAttachmentId(attachment.id);
    setAttachmentForm({
      name: attachment.name,
      size: attachment.size,
      date: attachment.date,
      reference: attachment.reference,
    });
    setAttachmentError("");
    setAttachmentSuccess("");
    setPendingAttachmentDeleteId("");
  };

  const submitAttachmentForm = (event) => {
    event.preventDefault();

    try {
      const resultStore = editingAttachmentId
        ? knowledgeService.updateEntityAttachment(store, editingAttachmentId, attachmentForm)
        : knowledgeService.addEntityAttachment(store, activeId, attachmentForm).store;
      const successMessage = editingAttachmentId
        ? `附件索引已更新：${attachmentForm.name.trim()}。`
        : `附件索引已保存：${attachmentForm.name.trim()}。`;
      setStore(resultStore);
      setShowAttachmentForm(false);
      setEditingAttachmentId("");
      setAttachmentForm(defaultAttachmentForm);
      setAttachmentError("");
      setAttachmentSuccess(successMessage);
    } catch (error) {
      setAttachmentError(error.message);
      setAttachmentSuccess("");
    }
  };

  const deleteAttachment = (attachmentId) => {
    try {
      const attachment = detailViewModel.attachments.find((item) => item.id === attachmentId);
      setStore((current) => knowledgeService.deleteEntityAttachment(current, attachmentId));
      setPendingAttachmentDeleteId("");
      setAttachmentSuccess(
        attachment ? `附件索引已移除：${attachment.name}。` : "附件索引已移除。",
      );
      if (editingAttachmentId === attachmentId) {
        setEditingAttachmentId("");
        setShowAttachmentForm(false);
        setAttachmentForm(defaultAttachmentForm);
      }
      setAttachmentError("");
    } catch (error) {
      setAttachmentError(error.message);
      setAttachmentSuccess("");
    }
  };

  const submitInboxForm = (event) => {
    event.preventDefault();

    try {
      const submittedTitle = inboxForm.title.trim();
      const result = inboxService.addInboxEntry(store, inboxForm);
      setStore(result.store);
      setInboxForm(defaultInboxForm);
      setInboxError("");
      setInboxSuccess(`已加入收集箱：${submittedTitle}，可在下方确认入库。`);
      setPendingInboxRejectId("");
      setPendingInboxAttachmentRemoveId("");
    } catch (error) {
      setInboxError(error.message);
      setInboxSuccess("");
    }
  };

  const confirmInboxEntry = (event, entryId) => {
    event.preventDefault();

    try {
      const formData = new FormData(event.currentTarget);
      const result = inboxService.confirmInboxEntry(store, entryId, {
        title: formData.get("title"),
        type: formData.get("type"),
        privacy: formData.get("privacy"),
        summary: formData.get("summary"),
        attachments: collectAttachmentRows(formData),
      });
      const confirmedTitle = String(formData.get("title") || "").trim();
      setStore(result.store);
      removeInboxAttachmentDraft(entryId);
      setPendingInboxRejectId("");
      setPendingInboxAttachmentRemoveId("");
      setInboxSuccess("");
      setInboxConfirmSuccess({
        entityId: result.entityId,
        message: `已入库：${confirmedTitle || "新资料"}。`,
      });
      navigateToEntity(result.entityId);
      setActiveView("graph");
      setActiveTab("概览");
    } catch (error) {
      setInboxError(error.message);
      setInboxSuccess("");
    }
  };

  const rejectInboxEntry = (entryId) => {
    try {
      const rejectedTitle =
        store.inbox.find((entry) => entry.id === entryId)?.title?.trim() || "待整理资料";
      const result = inboxService.rejectInboxEntry(store, entryId);
      setStore(result.store);
      removeInboxAttachmentDraft(entryId);
      setPendingInboxRejectId("");
      setPendingInboxAttachmentRemoveId("");
      setInboxError("");
      setInboxSuccess(`已拒绝：${rejectedTitle}。`);
    } catch (error) {
      setInboxError(error.message);
      setInboxSuccess("");
    }
  };

  const cancelRejectInboxEntry = (entry) => {
    setPendingInboxRejectId("");
    setInboxError("");
    setInboxSuccess(`已取消拒绝：${entry.title} 仍在待整理列表。`);
  };

  const getInboxAttachmentDraftRows = (entry) =>
    inboxAttachmentDrafts[entry.id] || createInboxAttachmentRows(entry.attachments);

  const updateInboxAttachmentDraft = (entry, rowId, field, value) => {
    setInboxAttachmentDrafts((current) => ({
      ...current,
      [entry.id]: updateInboxAttachmentRow(
        current[entry.id] || createInboxAttachmentRows(entry.attachments),
        rowId,
        field,
        value,
      ),
    }));
  };

  const addInboxAttachmentDraftRow = (entry) => {
    setInboxAttachmentDrafts((current) => ({
      ...current,
      [entry.id]: addInboxAttachmentRow(
        current[entry.id] || createInboxAttachmentRows(entry.attachments),
      ),
    }));
  };

  const addInboxAttachmentDraftFiles = async (entry, files) => {
    try {
      const currentRows =
        inboxAttachmentDrafts[entry.id] || createInboxAttachmentRows(entry.attachments);
      const nextRows = await addInboxAttachmentFileRowsWithContent(
        currentRows,
        files,
        attachmentStorageAdapter,
      );

      setInboxAttachmentDrafts((current) => ({
        ...current,
        [entry.id]: nextRows,
      }));
      if (nextRows.some((row) => row.localCopy?.copyStatus === "stored-remote")) {
        persistRemoteAttachmentConfig({
          ...remoteAttachmentState,
          lastStatus: "success",
          error: "",
          success: "最近一次后端附件上传成功。",
        });
        setRemoteAttachmentState((current) => ({
          ...current,
          lastStatus: "success",
          error: "",
          success: "最近一次后端附件上传成功。",
        }));
      }
      setInboxError("");
    } catch (error) {
      setInboxError(error.message);
    }
  };

  const removeInboxAttachmentDraftRow = (entry, rowId) => {
    setInboxAttachmentDrafts((current) => ({
      ...current,
      [entry.id]: removeInboxAttachmentRow(
        current[entry.id] || createInboxAttachmentRows(entry.attachments),
        rowId,
      ),
    }));
    setPendingInboxAttachmentRemoveId("");
  };

  const cancelInboxAttachmentDraftRowRemoval = (entry, attachment) => {
    setPendingInboxAttachmentRemoveId("");
    setInboxError("");
    setInboxSuccess(`已取消移除附件索引：${attachment.name || "未命名附件"}。`);
  };

  const removeInboxAttachmentDraft = (entryId) => {
    setInboxAttachmentDrafts((current) => {
      const { [entryId]: _removed, ...rest } = current;
      return rest;
    });
    setPendingInboxAttachmentRemoveId("");
  };

  const saveCurrentLayout = (event) => {
    event.preventDefault();
    const savedTitle = layoutTitle || layoutVersionViewModel.nextTitle;

    setLayoutApplyState(clearLayoutApplyState());
    setPendingLayoutDeleteId("");
    setLayoutResetPending(false);
    setStore((current) =>
      knowledgeService.saveGraphLayout(current, {
        title: savedTitle,
        note: layoutNote,
      }),
    );
    setLayoutTitle("");
    setLayoutNote("");
    setLayoutSaveStatus(`布局已保存：${savedTitle}`);
  };

  const applySavedLayout = (snapshot) => {
    const undoPositions = knowledgeService.captureGraphLayoutPositions(store);

    setDragPreview(null);
    setPendingLayoutDeleteId("");
    setLayoutResetPending(false);
    setLayoutSaveStatus("");
    setStore((current) => knowledgeService.applyGraphLayout(current, snapshot.id));
    setLayoutApplyState(markLayoutApplied(snapshot, undoPositions));
  };

  const undoApplySavedLayout = () => {
    if (!layoutApplyState.undo) return;

    const undo = consumeLayoutUndo(layoutApplyState);
    setDragPreview(null);
    setStore((current) =>
      knowledgeService.restoreGraphLayoutPositions(current, undo.positions),
    );
    setPendingLayoutDeleteId("");
    setLayoutResetPending(false);
    setLayoutSaveStatus("布局应用已撤销。");
    setLayoutApplyState(undo.nextState);
  };

  const requestApplySavedLayout = (snapshotId) => {
    setPendingLayoutDeleteId("");
    setLayoutResetPending(false);
    setLayoutSaveStatus("");
    setLayoutApplyState((current) => requestLayoutApply(current, snapshotId));
  };

  const cancelApplySavedLayout = (snapshot) => {
    setLayoutApplyState((current) => cancelLayoutApply(current));
    setLayoutSaveStatus(`已取消应用布局版本：${snapshot.title}，当前布局未更改。`);
  };

  const deleteSavedLayout = (snapshot) => {
    setLayoutApplyState(clearLayoutApplyState());
    setPendingLayoutDeleteId("");
    setLayoutResetPending(false);
    setStore((current) => knowledgeService.deleteGraphLayout(current, snapshot.id));
    setLayoutSaveStatus(`布局版本已删除：${snapshot.title}`);
  };

  const copySavedLayout = (snapshot) => {
    setLayoutApplyState(clearLayoutApplyState());
    setPendingLayoutDeleteId("");
    setLayoutResetPending(false);
    const nextStore = knowledgeService.copyGraphLayoutSnapshot(store, snapshot.id);
    const copyTitle = nextStore.layoutSnapshots[0].title;
    setStore(nextStore);
    setLayoutSaveStatus(`布局版本已复制：${copyTitle}`);
  };

  const updateSavedLayout = (event, snapshotId) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const updatedTitle = formData.get("title");
    setLayoutApplyState(clearLayoutApplyState());
    setPendingLayoutDeleteId("");
    setLayoutResetPending(false);
    setStore((current) =>
      knowledgeService.updateGraphLayoutSnapshot(current, snapshotId, {
        title: updatedTitle,
        note: formData.get("note"),
      }),
    );
    setLayoutSaveStatus(`布局版本已更新：${updatedTitle}`);
  };

  const requestResetGraphLayout = () => {
    setLayoutApplyState(clearLayoutApplyState());
    setPendingLayoutDeleteId("");
    setLayoutSaveStatus("");
    setLayoutResetPending(true);
  };

  const cancelResetGraphLayout = () => {
    setLayoutResetPending(false);
    setLayoutSaveStatus("已取消恢复默认布局，当前节点位置未更改。");
  };

  const resetCurrentGraphLayout = () => {
    setDragPreview(null);
    setLayoutApplyState(clearLayoutApplyState());
    setPendingLayoutDeleteId("");
    setLayoutResetPending(false);
    setStore((current) => knowledgeService.resetGraphLayout(current));
    setLayoutSaveStatus("默认布局已恢复。");
  };

  const submitAiQuestion = (event) => {
    event.preventDefault();
    setSubmittedAiQuestion(aiQuestion.trim());
  };

  const describeRelationshipSuggestion = (suggestionId, override = {}) => {
    const suggestion = relationshipSuggestions.find((item) => item.id === suggestionId);
    const targetId = override.targetId || suggestion?.toId;
    const targetTitle =
      relationshipTargetOptions.find((node) => node.id === targetId)?.title ||
      suggestion?.toTitle ||
      "目标资料";
    const relationType = override.relationType || suggestion?.relationType || "关系";

    return `${activeNode.title} → ${targetTitle} · ${relationType}`;
  };

  const describeTagSuggestion = (suggestionId, override = {}) => {
    const suggestion = tagSuggestions.find((item) => item.id === suggestionId);

    return override.tag || suggestion?.tag || "标签";
  };

  const describeSummarySuggestion = (suggestionId, override = {}) => {
    const suggestion = summarySuggestions.find((item) => item.id === suggestionId);
    const summary = override.summary || suggestion?.summary || "摘要";

    return summary.length > 32 ? `${summary.slice(0, 32)}...` : summary;
  };

  const confirmRelationshipSuggestion = (suggestionId) => {
    const relationshipSummary = describeRelationshipSuggestion(suggestionId);
    const result = relationshipSuggestionService.confirm(store, activeId, suggestionId);
    setStore(result.store);
    setEditingRelationshipSuggestionId("");
    setRelationshipSuggestionForm(defaultRelationshipSuggestionForm);
    setRelationshipSuggestionError("");
    setRelationshipSuggestionSuccess(`关系建议已确认：${relationshipSummary}。`);
  };

  const startRelationshipSuggestionEdit = (suggestion) => {
    setEditingRelationshipSuggestionId(suggestion.id);
    setRelationshipSuggestionForm({
      targetId: suggestion.toId,
      relationType: suggestion.relationType,
      evidence: suggestion.evidence,
    });
    setRelationshipSuggestionError("");
    setRelationshipSuggestionSuccess("");
  };

  const updateRelationshipSuggestionForm = (patch) => {
    setRelationshipSuggestionForm((current) => ({ ...current, ...patch }));
    setRelationshipSuggestionError("");
    setRelationshipSuggestionSuccess("");
  };

  const submitRelationshipSuggestionEdit = (event, suggestionId) => {
    event.preventDefault();

    try {
      const relationshipSummary = describeRelationshipSuggestion(
        suggestionId,
        relationshipSuggestionForm,
      );
      const result = relationshipSuggestionService.confirm(
        store,
        activeId,
        suggestionId,
        relationshipSuggestionForm,
      );
      setStore(result.store);
      setEditingRelationshipSuggestionId("");
      setRelationshipSuggestionForm(defaultRelationshipSuggestionForm);
      setRelationshipSuggestionError("");
      setRelationshipSuggestionSuccess(`关系建议已确认：${relationshipSummary}。`);
    } catch (error) {
      setRelationshipSuggestionError(error.message);
      setRelationshipSuggestionSuccess("");
    }
  };

  const rejectRelationshipSuggestion = (suggestionId) => {
    const relationshipSummary = describeRelationshipSuggestion(suggestionId);
    const result = relationshipSuggestionService.reject(store, activeId, suggestionId);
    setStore(result.store);
    if (editingRelationshipSuggestionId === suggestionId) {
      setEditingRelationshipSuggestionId("");
      setRelationshipSuggestionForm(defaultRelationshipSuggestionForm);
      setRelationshipSuggestionError("");
    }
    setRelationshipSuggestionSuccess(`关系建议已拒绝：${relationshipSummary}。`);
  };

  const confirmTagSuggestion = (suggestionId) => {
    const tagLabel = describeTagSuggestion(suggestionId);
    const result = tagSuggestionService.confirm(store, activeId, suggestionId);
    setStore(result.store);
    setEditingTagSuggestionId("");
    setTagSuggestionForm(defaultTagSuggestionForm);
    setTagSuggestionError("");
    setTagSuggestionSuccess(`标签建议已确认：${tagLabel}。`);
  };

  const startTagSuggestionEdit = (suggestion) => {
    setEditingTagSuggestionId(suggestion.id);
    setTagSuggestionForm({ tag: suggestion.tag });
    setTagSuggestionError("");
    setTagSuggestionSuccess("");
  };

  const updateTagSuggestionForm = (patch) => {
    setTagSuggestionForm((current) => ({ ...current, ...patch }));
    setTagSuggestionError("");
    setTagSuggestionSuccess("");
  };

  const submitTagSuggestionEdit = (event, suggestionId) => {
    event.preventDefault();

    try {
      const tagLabel = describeTagSuggestion(suggestionId, tagSuggestionForm);
      const result = tagSuggestionService.confirm(store, activeId, suggestionId, tagSuggestionForm);
      setStore(result.store);
      setEditingTagSuggestionId("");
      setTagSuggestionForm(defaultTagSuggestionForm);
      setTagSuggestionError("");
      setTagSuggestionSuccess(`标签建议已确认：${tagLabel}。`);
    } catch (error) {
      setTagSuggestionError(error.message);
      setTagSuggestionSuccess("");
    }
  };

  const rejectTagSuggestion = (suggestionId) => {
    const tagLabel = describeTagSuggestion(suggestionId);
    const result = tagSuggestionService.reject(store, activeId, suggestionId);
    setStore(result.store);
    if (editingTagSuggestionId === suggestionId) {
      setEditingTagSuggestionId("");
      setTagSuggestionForm(defaultTagSuggestionForm);
      setTagSuggestionError("");
    }
    setTagSuggestionSuccess(`标签建议已拒绝：${tagLabel}。`);
  };

  const confirmSummarySuggestion = (suggestionId) => {
    const summaryLabel = describeSummarySuggestion(suggestionId);
    const result = summarySuggestionService.confirm(store, activeId, suggestionId);
    setStore(result.store);
    setEditingSummarySuggestionId("");
    setSummarySuggestionForm(defaultSummarySuggestionForm);
    setSummarySuggestionError("");
    setSummarySuggestionSuccess(`摘要建议已确认：${summaryLabel}。`);
  };

  const startSummarySuggestionEdit = (suggestion) => {
    setEditingSummarySuggestionId(suggestion.id);
    setSummarySuggestionForm({ summary: suggestion.summary });
    setSummarySuggestionError("");
    setSummarySuggestionSuccess("");
  };

  const updateSummarySuggestionForm = (patch) => {
    setSummarySuggestionForm((current) => ({ ...current, ...patch }));
    setSummarySuggestionError("");
    setSummarySuggestionSuccess("");
  };

  const submitSummarySuggestionEdit = (event, suggestionId) => {
    event.preventDefault();

    try {
      const summaryLabel = describeSummarySuggestion(suggestionId, summarySuggestionForm);
      const result = summarySuggestionService.confirm(
        store,
        activeId,
        suggestionId,
        summarySuggestionForm,
      );
      setStore(result.store);
      setEditingSummarySuggestionId("");
      setSummarySuggestionForm(defaultSummarySuggestionForm);
      setSummarySuggestionError("");
      setSummarySuggestionSuccess(`摘要建议已确认：${summaryLabel}。`);
    } catch (error) {
      setSummarySuggestionError(error.message);
      setSummarySuggestionSuccess("");
    }
  };

  const rejectSummarySuggestion = (suggestionId) => {
    const summaryLabel = describeSummarySuggestion(suggestionId);
    const result = summarySuggestionService.reject(store, activeId, suggestionId);
    setStore(result.store);
    if (editingSummarySuggestionId === suggestionId) {
      setEditingSummarySuggestionId("");
      setSummarySuggestionForm(defaultSummarySuggestionForm);
      setSummarySuggestionError("");
    }
    setSummarySuggestionSuccess(`摘要建议已拒绝：${summaryLabel}。`);
  };

  const submitTagForm = (event) => {
    event.preventDefault();

    try {
      const nextStore = knowledgeService.addEntityTag(store, activeId, tagDraft);
      setStore(nextStore);
      setShowTagForm(false);
      setTagDraft("");
      setTagError("");
      setTagSuccess(`标签已保存：${tagDraft.trim()}。`);
    } catch (error) {
      setTagError(error.message);
      setTagSuccess("");
    }
  };

  const startTagEdit = (tag) => {
    setEditingTag(tag);
    setEditingTagDraft(tag);
    setPendingTagDelete("");
    setShowTagForm(false);
    setTagError("");
    setTagSuccess("");
  };

  const submitTagEdit = (event) => {
    event.preventDefault();

    try {
      const nextStore = knowledgeService.updateEntityTag(
        store,
        activeId,
        editingTag,
        editingTagDraft,
      );
      setStore(nextStore);
      setEditingTag("");
      setEditingTagDraft("");
      setTagError("");
      setTagSuccess(`标签已更新：${editingTag} → ${editingTagDraft.trim()}。`);
    } catch (error) {
      setTagError(error.message);
      setTagSuccess("");
    }
  };

  const deleteTag = (tag) => {
    try {
      const nextStore = knowledgeService.deleteEntityTag(store, activeId, tag);
      setStore(nextStore);
      setPendingTagDelete("");
      if (editingTag === tag) {
        setEditingTag("");
        setEditingTagDraft("");
      }
      setTagError("");
      setTagSuccess(`标签已移除：${tag}。`);
    } catch (error) {
      setTagError(error.message);
      setTagSuccess("");
    }
  };

  const submitSourceForm = (event) => {
    event.preventDefault();

    try {
      const result = knowledgeService.addEntitySource(store, activeId, {
        label: sourceDraft,
      });
      setStore(result.store);
      setSourceDraft("");
      setSourceError("");
      setSourceSuccess(`来源说明已补充：${formatFeedbackSnippet(sourceDraft)}。`);
    } catch (error) {
      setSourceError(error.message);
      setSourceSuccess("");
    }
  };

  const startSourceEdit = (source) => {
    setEditingSourceId(source.id);
    setEditingSourceDraft(source.label);
    setPendingSourceDeleteId("");
    setSourceError("");
    setSourceSuccess("");
  };

  const submitSourceEdit = (event, sourceId) => {
    event.preventDefault();

    try {
      setStore((current) =>
        knowledgeService.updateEntitySource(current, sourceId, {
          label: editingSourceDraft,
        }),
      );
      setEditingSourceId("");
      setEditingSourceDraft("");
      setSourceError("");
      setSourceSuccess(`来源说明已更新：${formatFeedbackSnippet(editingSourceDraft)}。`);
    } catch (error) {
      setSourceError(error.message);
      setSourceSuccess("");
    }
  };

  const deleteSource = (sourceId) => {
    try {
      const source = detailViewModel.sources.find((item) => item.id === sourceId);
      setStore((current) => knowledgeService.deleteEntitySource(current, sourceId));
      setPendingSourceDeleteId("");
      setEditingSourceId("");
      setEditingSourceDraft("");
      setSourceError("");
      setSourceSuccess(
        source ? `来源说明已移除：${formatFeedbackSnippet(source.label)}。` : "来源说明已移除。",
      );
    } catch (error) {
      setSourceError(error.message);
      setSourceSuccess("");
    }
  };

  const updateRelationshipForm = (patch) => {
    setRelationshipForm((current) => ({ ...current, ...patch }));
    setRelationshipError("");
    setRelationshipSuccess("");
  };

  const submitRelationshipForm = (event) => {
    event.preventDefault();

    try {
      const targetTitle = selectedRelationshipTarget?.title || "目标资料";
      const relationType = relationshipForm.relationType || "关系";
      const relationshipSummary = `${activeNode.title} → ${targetTitle} · ${relationType}`;
      const reverseSummary =
        !editingRelationshipId && relationshipForm.reciprocal
          ? `；反向关系：${targetTitle} → ${activeNode.title} · ${getReverseRelationshipType(relationType)}`
          : "";
      const successMessage = editingRelationshipId
        ? `关系已更新：${relationshipSummary}。`
        : `关系已保存：${relationshipSummary}${reverseSummary}。`;
      const result = editingRelationshipId
        ? knowledgeService.updateRelationship(store, editingRelationshipId, relationshipForm)
        : knowledgeService.addRelationship(store, activeId, relationshipForm);
      setStore(result.store);
      setShowRelationshipForm(false);
      setRelationshipForm(defaultRelationshipForm);
      setRelationshipError("");
      setRelationshipSuccess(successMessage);
      setEditingRelationshipId("");
    } catch (error) {
      setRelationshipError(error.message);
      setRelationshipSuccess("");
    }
  };

  const startRelationshipCreate = () => {
    setActiveTab("概览");
    setShowRelationshipForm(true);
    setEditingRelationshipId("");
    setRelationshipForm(defaultRelationshipForm);
    setPendingRelationshipDeleteId("");
    setRelationshipError("");
    setRelationshipSuccess("");
  };

  const scrollMobileDetailTargetIntoView = (targetRef, focusCallback) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        focusCallback?.();
      });
    });
  };

  const activateMobileDetailShortcut = (target) => {
    setMobileDetailOpen(true);
    setMobileSection("detail");

    if (target === "body") {
      setActiveTab("属性");
      scrollMobileDetailTargetIntoView(markdownEditorRef, () => markdownEditorRef.current?.focus());
      return;
    }

    setActiveTab("概览");

    if (target === "tags") {
      setShowTagForm(true);
      setEditingTag("");
      setEditingTagDraft("");
      setPendingTagDelete("");
      setTagError("");
      setTagSuccess("");
      scrollMobileDetailTargetIntoView(detailTagsRef);
      return;
    }

    if (target === "relationships") {
      startRelationshipCreate();
      scrollMobileDetailTargetIntoView(detailRelationshipsRef);
      return;
    }

    if (target === "attachments") {
      startAttachmentCreate();
      scrollMobileDetailTargetIntoView(detailAttachmentsRef);
      return;
    }

    if (target === "sources") {
      scrollMobileDetailTargetIntoView(detailSourcesRef, () => sourceInputRef.current?.focus());
    }
  };

  const startRelationshipEdit = (relationship) => {
    setShowRelationshipForm(true);
    setEditingRelationshipId(relationship.id);
    setPendingRelationshipDeleteId("");
    setRelationshipError("");
    setRelationshipSuccess("");
    setRelationshipForm({
      targetId: relationship.targetId,
      relationType: relationship.relation,
      evidence: relationship.evidence,
      reciprocal: false,
    });
  };

  const deleteRelationship = (relationshipId) => {
    try {
      const relationship = detailViewModel.relationships.find((item) => item.id === relationshipId);
      const successMessage = relationship
        ? `关系已移除：${activeNode.title} → ${relationship.targetTitle} · ${relationship.relation}。`
        : "关系已移除。";
      setStore((current) => knowledgeService.deleteRelationship(current, relationshipId));
      setPendingRelationshipDeleteId("");
      setRelationshipError("");
      setRelationshipSuccess(successMessage);
    } catch (error) {
      setRelationshipError(error.message);
      setRelationshipSuccess("");
    }
  };

  const beginNodeDrag = (event, node) => {
    if (event.button !== 0) return;

    const canvas = canvasRef.current?.parentElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const nodeCenterX = (node.x / 100) * rect.width;
    const nodeCenterY = (node.y / 100) * rect.height;

    event.currentTarget.setPointerCapture(event.pointerId);
    nodeDragRef.current = {
      entityId: node.id,
      pointerId: event.pointerId,
      target: event.currentTarget,
      rect,
      pan: graphPan,
      offsetX: event.clientX - rect.left - nodeCenterX,
      offsetY: event.clientY - rect.top - nodeCenterY,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
      x: node.x,
      y: node.y,
    };
    navigateToEntity(node.id);
    setDragPreview({ entityId: node.id, x: node.x, y: node.y });
  };

  const moveNodeDrag = (event) => {
    const drag = nodeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const position = getPositionFromPointer(event, drag);
    const moved =
      drag.moved ||
      Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) > 3;

    nodeDragRef.current = {
      ...drag,
      ...position,
      moved,
    };
    setDragPreview({ entityId: drag.entityId, ...position });
  };

  const finishNodeDrag = (event) => {
    const drag = nodeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const position = getPositionFromPointer(event, drag);
    const moved =
      drag.moved ||
      Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) > 3;
    nodeDragRef.current = null;
    setDragPreview(null);

    if (drag.target.hasPointerCapture(event.pointerId)) {
      drag.target.releasePointerCapture(event.pointerId);
    }

    if (!moved) return;

    event.preventDefault();
    setLayoutApplyState(clearLayoutApplyState());
    setPendingLayoutDeleteId("");
    setLayoutResetPending(false);
    setLayoutSaveStatus("");
    setStore((current) => knowledgeService.updateEntityPosition(current, drag.entityId, position));
  };

  const cancelNodeDrag = (event) => {
    const drag = nodeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    nodeDragRef.current = null;
    setDragPreview(null);

    if (drag.target.hasPointerCapture(event.pointerId)) {
      drag.target.releasePointerCapture(event.pointerId);
    }
  };

  const stopGraphInertia = () => {
    const frameId = graphInertiaRef.current.frameId;
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
    }
    graphInertiaRef.current = { frameId: null };
  };

  const startGraphInertia = (panState) => {
    const velocity = getPanVelocity(panState?.samples || []) ||
      getPanDisplacementVelocity(panState);
    if (!velocity) return;

    let vx = velocity.x;
    let vy = velocity.y;
    let pan = panState.currentPan || graphPan;
    let lastTimestamp = 0;

    const step = (timestamp) => {
      if (!lastTimestamp) {
        lastTimestamp = timestamp;
        graphInertiaRef.current = { frameId: requestAnimationFrame(step) };
        return;
      }
      const delta = Math.min(timestamp - lastTimestamp, 32);
      lastTimestamp = timestamp;

      const nextPan = {
        x: clampGraphPan(pan.x + vx * delta),
        y: clampGraphPan(pan.y + vy * delta),
      };
      const hitHorizontalLimit = nextPan.x === pan.x && Math.abs(vx) > 0;
      const hitVerticalLimit = nextPan.y === pan.y && Math.abs(vy) > 0;

      pan = nextPan;
      setGraphPan(nextPan);

      if (hitHorizontalLimit) vx = 0;
      if (hitVerticalLimit) vy = 0;
      vx *= 0.9;
      vy *= 0.9;

      if (Math.hypot(vx, vy) < 0.02) {
        graphInertiaRef.current = { frameId: null };
        return;
      }

      graphInertiaRef.current = { frameId: requestAnimationFrame(step) };
    };

    graphInertiaRef.current = { frameId: requestAnimationFrame(step) };
  };

  const beginGraphGesture = (event) => {
    if (event.pointerType !== "touch" || event.target.closest(".graph-node")) return;

    event.preventDefault();
    stopGraphInertia();
    capturePointer(event.currentTarget, event.pointerId);

    const previousGesture = graphGestureRef.current;
    const pointers = new Map(previousGesture.pointers);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const didPinch = (previousGesture.pointers.size > 0 && previousGesture.didPinch) ||
      pointers.size >= 2;

    graphGestureRef.current = {
      pointers,
      pinch: createPinchState(pointers, zoom),
      pan: pointers.size === 1 ? createPanState(pointers, graphPan) : null,
      didPinch,
    };

    if (pointers.size >= 2) {
      stopGraphInertia();
      nodeDragRef.current = null;
      setDragPreview(null);
    }
  };

  const moveGraphGesture = (event) => {
    const gesture = graphGestureRef.current;
    if (!gesture.pointers.has(event.pointerId)) return;

    event.preventDefault();
    const pointers = new Map(gesture.pointers);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pinch = gesture.pinch || createPinchState(pointers, zoom);
    const didPinch = gesture.didPinch || pointers.size >= 2;
    const pan = pointers.size === 1 && !didPinch
      ? gesture.pan || createPanState(pointers, graphPan)
      : null;

    graphGestureRef.current = { pointers, pinch, pan, didPinch };

    if (pan && pointers.size === 1) {
      const [pointer] = Array.from(pointers.values());
      const nextPan = {
        x: clampGraphPan(pan.startPan.x + pointer.x - pan.startPointer.x),
        y: clampGraphPan(pan.startPan.y + pointer.y - pan.startPointer.y),
      };
      const nextPanState = addPanSample(pan, pointer, event.timeStamp, nextPan);
      graphGestureRef.current = { pointers, pinch, pan: nextPanState, didPinch };
      setGraphPan(nextPan);
      return;
    }

    if (!pinch || pointers.size < 2) return;

    const [first, second] = Array.from(pointers.values());
    const distance = getPointerDistance(first, second);
    if (pinch.startDistance <= 0 || distance <= 0) return;

    setZoom(clampZoom(Math.round(pinch.startZoom * (distance / pinch.startDistance))));
  };

  const finishGraphGesture = (event) => {
    const gesture = graphGestureRef.current;
    if (!gesture.pointers.has(event.pointerId)) return;

    const shouldStartInertia =
      event.type === "pointerup" && !gesture.didPinch && gesture.pointers.size === 1 &&
      Boolean(gesture.pan);
    const pointers = new Map(gesture.pointers);
    pointers.delete(event.pointerId);

    releasePointer(event.currentTarget, event.pointerId);

    if (shouldStartInertia) {
      startGraphInertia(gesture.pan);
    }

    graphGestureRef.current = {
      pointers,
      pinch: pointers.size >= 2 ? createPinchState(pointers, zoom) : null,
      pan: pointers.size === 1 && !gesture.didPinch ? createPanState(pointers, graphPan) : null,
      didPinch: pointers.size > 0 && gesture.didPinch,
    };
  };

  const handleTaskEntry = (action) => {
    if (action === "search") {
      setQuery("护照");
      setTagFilter("全部");
      setPrivacyFilter("全部隐私");
      setActiveView("graph");
      setMobileDetailOpen(false);
      setMobileSection("home");
      navigateToEntity("passport");
      return;
    }

    if (action === "add") {
      openAddForm();
      return;
    }

    if (action === "travel-check") {
      setQuery("");
      setTagFilter("全部");
      setPrivacyFilter("全部隐私");
      setActiveView("graph");
      setMobileDetailOpen(false);
      setMobileSection("graph");
      navigateToEntity("passport");
    }
  };

  const focusTravelCheckItem = (item) => {
    setQuery("");
    setTagFilter("全部");
    setPrivacyFilter("全部隐私");
    setMobileSection("graph");
    navigateToEntity(item.targetId);
  };

  const handleStatusSummary = (label) => {
    if (label === "待整理") {
      setActiveView("inbox");
      setMobileDetailOpen(false);
      setMobileSection("inbox");
      return;
    }

    setActiveView("graph");
    setMobileDetailOpen(false);
    setMobileSection("home");
    setTagFilter("全部");

    if (label === "缺附件") {
      setQuery("附件");
      setPrivacyFilter("全部隐私");
      navigateToEntity("passport");
      return;
    }

    if (label === "AI 不可见") {
      setQuery("");
      setPrivacyFilter("high");
      navigateToEntity("passport");
      return;
    }

    if (label === "需检查") {
      setQuery("");
      setPrivacyFilter("全部隐私");
      navigateToEntity("passport");
      return;
    }

    setQuery("");
    setPrivacyFilter("全部隐私");
  };

  const resetKnowledgeStore = ({
    nextView = "graph",
    nextMobileSection = "home",
  } = {}) => {
    setStore(knowledgeService.resetToSeed());
    setEntityHistory(createEntityNavigationHistory("passport"));
    setActiveView(nextView);
    setMobileDetailOpen(false);
    setMobileSection(nextMobileSection);
    setActiveTab("概览");
    setQuery("");
    setTagFilter("全部");
    setPrivacyFilter("全部隐私");
    setLayoutApplyState(clearLayoutApplyState());
    setPendingLayoutDeleteId("");
    setLayoutResetPending(false);
    setInboxAttachmentDrafts({});
    setPendingInboxRejectId("");
    setPendingInboxAttachmentRemoveId("");
    setInboxSuccess("");
    setResetActionState(confirmReset());
    setSettingsResetPending(false);
    setResetSuccess("资料库已重置为示例数据。");
  };

  const cancelSidebarReset = () => {
    setResetActionState(cancelReset());
    setResetSuccess("已取消重置资料库，当前资料库未更改。");
  };

  const cancelSettingsReset = () => {
    setSettingsResetPending(false);
    setResetSuccess("已取消重置资料库，当前资料库未更改。");
  };

  const exportBackupPackage = async () => {
    try {
      const backupPackage = backupEncryptionState.exportEncrypted
        ? await createEncryptedBackupPackage(store, backupEncryptionState.exportPassword)
        : await createBackupPackage(store);
      const blob = new Blob([JSON.stringify(backupPackage, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const backupFileName = backupEncryptionState.exportEncrypted
        ? `graph-atlas-backup-encrypted-${new Date().toISOString().slice(0, 10)}.json`
        : `graph-atlas-backup-${new Date().toISOString().slice(0, 10)}.json`;

      anchor.href = url;
      anchor.download = backupFileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setBackupState({
        pendingPackage: null,
        summary: null,
        encryptedImportText: "",
        encryptedImportFileName: "",
        needsPassword: false,
        error: "",
        success: backupEncryptionState.exportEncrypted
          ? `加密备份已导出：${backupFileName}。请妥善保存备份密码，应用无法找回。`
          : `备份已导出：${backupFileName}。备份文件为本地明文 JSON，请妥善保存。`,
      });
      if (backupEncryptionState.exportEncrypted) {
        setBackupEncryptionState((current) => ({
          ...current,
          exportPassword: "",
        }));
      }
    } catch (error) {
      setBackupState({
        pendingPackage: null,
        summary: null,
        encryptedImportText: "",
        encryptedImportFileName: "",
        needsPassword: false,
        error: error.message,
        success: "",
      });
    }
  };

  const previewBackupImport = async (file) => {
    if (!file) return;

    try {
      const fileText = await file.text();
      let parsedPackage;

      try {
        parsedPackage = JSON.parse(fileText);
      } catch {
        throw new Error("备份文件不是有效 JSON。");
      }

      if (parsedPackage?.format === "graph-atlas-encrypted-backup") {
        setBackupState({
          pendingPackage: null,
          summary: null,
          encryptedImportText: fileText,
          encryptedImportFileName: file.name,
          needsPassword: true,
          error: "",
          success: "这是加密备份，请输入备份密码后继续。",
        });
        setBackupEncryptionState((current) => ({
          ...current,
          importPassword: "",
        }));
        return;
      }

      const backupPackage = parseBackupPackage(fileText);
      setBackupState({
        pendingPackage: backupPackage,
        summary: summarizeBackupPackage(backupPackage),
        encryptedImportText: "",
        encryptedImportFileName: "",
        needsPassword: false,
        error: "",
        success: "",
      });
    } catch (error) {
      setBackupState({
        pendingPackage: null,
        summary: null,
        encryptedImportText: "",
        encryptedImportFileName: "",
        needsPassword: false,
        error: error.message,
        success: "",
      });
    }
  };

  const previewEncryptedBackupImport = async () => {
    if (!backupState.encryptedImportText) return;

    try {
      const backupPackage = await parseBackupPackageImport(backupState.encryptedImportText, {
        password: backupEncryptionState.importPassword,
      });
      setBackupState({
        pendingPackage: backupPackage,
        summary: summarizeBackupPackage(backupPackage),
        encryptedImportText: "",
        encryptedImportFileName: "",
        needsPassword: false,
        error: "",
        success: "加密备份已解密，请确认是否恢复。",
      });
      setBackupEncryptionState((current) => ({
        ...current,
        importPassword: "",
      }));
    } catch (error) {
      setBackupState((current) => ({
        ...current,
        pendingPackage: null,
        summary: null,
        error: error.message,
        success: "",
      }));
    }
  };

  const cancelBackupRestore = () => {
    setBackupState({
      pendingPackage: null,
      summary: null,
      encryptedImportText: "",
      encryptedImportFileName: "",
      needsPassword: false,
      error: "",
      success: "已取消备份恢复，当前资料库未更改。",
    });
  };

  const confirmBackupRestore = async () => {
    if (!backupState.pendingPackage) return;

    try {
      const restoredStore = await restoreBackupPackage(backupState.pendingPackage);
      const restoredActiveId = restoredStore.entities.some((entity) => entity.id === "passport")
        ? "passport"
        : restoredStore.entities[0]?.id;

      setStore(restoredStore);
      if (restoredActiveId) {
        setEntityHistory(createEntityNavigationHistory(restoredActiveId));
      }
      setActiveView("settings");
      setMobileDetailOpen(false);
      setMobileSection("settings");
      setActiveTab("概览");
      setQuery("");
      setTagFilter("全部");
      setPrivacyFilter("全部隐私");
      setLayoutApplyState(clearLayoutApplyState());
      setPendingLayoutDeleteId("");
      setLayoutResetPending(false);
      setInboxAttachmentDrafts({});
      setPendingInboxRejectId("");
      setPendingInboxAttachmentRemoveId("");
      setInboxSuccess("");
      setResetSuccess("");
      setBackupState({
        pendingPackage: null,
        summary: null,
        encryptedImportText: "",
        encryptedImportFileName: "",
        needsPassword: false,
        error: "",
        success: "备份已恢复，当前资料库已替换为备份内容。",
      });
    } catch (error) {
      setBackupState((current) => ({
        ...current,
        error: error.message,
        success: "",
      }));
    }
  };

  const chooseAttachmentDirectory = async () => {
    setPendingDirectoryClear(false);
    if (typeof globalThis.showDirectoryPicker !== "function") {
      setAttachmentDirectoryState((current) => ({
        ...current,
        supported: false,
        error: "当前浏览器不支持选择本地附件目录。",
        success: "",
      }));
      return;
    }

    try {
      const directoryHandle = await globalThis.showDirectoryPicker({ mode: "readwrite" });
      const permissionState = await requestAttachmentDirectoryPermission(directoryHandle);

      if (permissionState !== "granted") {
        setAttachmentDirectoryState((current) => ({
          ...current,
          supported: true,
          directoryHandle,
          permissionState,
          error: "未获得本地附件目录写入权限。",
          success: "",
        }));
        return;
      }

      await saveAttachmentDirectoryHandle(directoryHandle);
      setAttachmentDirectoryState({
        supported: true,
        directoryHandle,
        permissionState,
        error: "",
        success: "本地附件目录已授权。后续新选择的大文件会保存完整副本。",
      });
    } catch (error) {
      setAttachmentDirectoryState((current) => ({
        ...current,
        error: error.message,
        success: "",
      }));
    }
  };

  const reauthorizeAttachmentDirectory = async () => {
    setPendingDirectoryClear(false);
    if (!attachmentDirectoryState.directoryHandle) {
      await chooseAttachmentDirectory();
      return;
    }

    try {
      const permissionState = await requestAttachmentDirectoryPermission(
        attachmentDirectoryState.directoryHandle,
      );

      setAttachmentDirectoryState((current) => ({
        ...current,
        permissionState,
        error: permissionState === "granted" ? "" : "未获得本地附件目录写入权限。",
        success: permissionState === "granted" ? "本地附件目录已重新授权。" : "",
      }));
    } catch (error) {
      setAttachmentDirectoryState((current) => ({
        ...current,
        error: error.message,
        success: "",
      }));
    }
  };

  const clearAttachmentDirectory = async () => {
    try {
      setPendingDirectoryClear(false);
      await clearAttachmentDirectoryHandle();
      setAttachmentDirectoryState((current) => ({
        ...current,
        directoryHandle: null,
        permissionState: current.supported ? "not-configured" : "unsupported",
        error: "",
        success: "本地附件目录授权已清除；不会删除已经写入的本机文件。",
      }));
    } catch (error) {
      setAttachmentDirectoryState((current) => ({
        ...current,
        error: error.message,
        success: "",
      }));
    }
  };

  const cancelClearAttachmentDirectory = () => {
    setPendingDirectoryClear(false);
    setAttachmentDirectoryState((current) => ({
      ...current,
      error: "",
      success: "已取消清除本地附件目录授权，当前配置未更改。",
    }));
  };

  const updateRemoteAttachmentField = (field, value) => {
    setPendingRemoteConfigClear(false);
    setRemoteAttachmentState((current) => ({
      ...current,
      [field]: value,
      error: "",
      success: "",
    }));
  };

  const saveRemoteAttachmentConfig = () => {
    setPendingRemoteConfigClear(false);
    const nextState = {
      ...remoteAttachmentState,
      endpoint: remoteAttachmentState.endpoint.trim(),
      token: remoteAttachmentState.token.trim(),
      lastStatus: remoteAttachmentState.endpoint.trim() ? "configured" : "idle",
      error: "",
      success: remoteAttachmentState.endpoint.trim()
        ? "后端附件上传配置已保存；当前仅保存客户端 endpoint。"
        : "未填写后端 endpoint，配置保持未启用。",
    };

    persistRemoteAttachmentConfig(nextState);
    setRemoteAttachmentState(nextState);
  };

  const clearRemoteAttachmentConfig = () => {
    setPendingRemoteConfigClear(false);
    const nextState = {
      endpoint: "",
      token: "",
      lastStatus: "idle",
      error: "",
      success: "后端附件上传配置已清除。",
    };

    persistRemoteAttachmentConfig(nextState);
    setRemoteAttachmentState(nextState);
  };

  const cancelClearRemoteAttachmentConfig = () => {
    setPendingRemoteConfigClear(false);
    setRemoteAttachmentState((current) => ({
      ...current,
      error: "",
      success: "已取消清除后端附件上传配置，当前配置未更改。",
    }));
  };

  const updateCloudSyncField = (field, value) => {
    setPendingCloudSyncClear(false);
    setPendingCloudSnapshotPush(false);
    setCloudSyncState((current) => ({
      ...current,
      [field]: value,
      error: "",
      success: "",
    }));
  };

  const saveCloudSyncSettings = () => {
    setPendingCloudSyncClear(false);
    setPendingCloudSnapshotPush(false);
    const nextConfig = saveCloudSyncConfig({
      ...cloudSyncState,
      endpoint: cloudSyncState.endpoint,
      token: cloudSyncState.token,
      lastStatus: cloudSyncState.endpoint.trim() ? "configured" : "idle",
    });

    setCloudSyncState({
      ...nextConfig,
      latestSnapshot: null,
      error: "",
      success: nextConfig.endpoint
        ? "云同步配置已保存；当前只启用手动快照操作。"
        : "未填写云同步 endpoint，配置保持未启用。",
    });
  };

  const testCloudSyncConnection = async () => {
    setPendingCloudSyncClear(false);
    setPendingCloudSnapshotPush(false);

    try {
      const adapter = createHttpCloudSyncAdapter({
        endpoint: cloudSyncState.endpoint,
        token: cloudSyncState.token,
      });
      const result = await adapter.testConnection();
      const nextConfig = saveCloudSyncConfig({
        ...cloudSyncState,
        endpoint: cloudSyncState.endpoint,
        token: cloudSyncState.token,
        lastStatus: "connected",
      });

      setCloudSyncState({
        ...nextConfig,
        latestSnapshot: null,
        error: "",
        success: `云同步连接成功：${result.serviceLabel}。`,
      });
    } catch (error) {
      const nextConfig = saveCloudSyncConfig({
        ...cloudSyncState,
        endpoint: cloudSyncState.endpoint,
        token: cloudSyncState.token,
        lastStatus: cloudSyncState.endpoint.trim() ? "error" : "idle",
      });

      setCloudSyncState({
        ...nextConfig,
        latestSnapshot: cloudSyncState.latestSnapshot,
        error: error.message,
        success: "",
      });
    }
  };

  const pushCloudSnapshot = async () => {
    setPendingCloudSnapshotPush(false);
    setPendingCloudSyncClear(false);

    try {
      const adapter = createHttpCloudSyncAdapter({
        endpoint: cloudSyncState.endpoint,
        token: cloudSyncState.token,
      });
      const result = await adapter.pushSnapshot(store);
      const nextConfig = saveCloudSyncConfig({
        ...cloudSyncState,
        endpoint: cloudSyncState.endpoint,
        token: cloudSyncState.token,
        lastStatus: "success",
        lastSnapshotId: result.snapshotId,
        lastSyncedAt: result.updatedAt,
      });

      setCloudSyncState({
        ...nextConfig,
        latestSnapshot: null,
        error: "",
        success: `当前资料库快照已推送：${result.snapshotId}。`,
      });
    } catch (error) {
      const nextConfig = saveCloudSyncConfig({
        ...cloudSyncState,
        endpoint: cloudSyncState.endpoint,
        token: cloudSyncState.token,
        lastStatus: cloudSyncState.endpoint.trim() ? "error" : "idle",
      });

      setCloudSyncState({
        ...nextConfig,
        latestSnapshot: cloudSyncState.latestSnapshot,
        error: error.message,
        success: "",
      });
    }
  };

  const pullCloudSnapshotPreview = async () => {
    setPendingCloudSnapshotPush(false);
    setPendingCloudSyncClear(false);

    try {
      const adapter = createHttpCloudSyncAdapter({
        endpoint: cloudSyncState.endpoint,
        token: cloudSyncState.token,
      });
      const snapshot = await adapter.pullSnapshot();
      const diff = summarizeCloudSnapshotDiff(store, snapshot);
      const nextConfig = saveCloudSyncConfig({
        ...cloudSyncState,
        endpoint: cloudSyncState.endpoint,
        token: cloudSyncState.token,
        lastStatus: diff.mode === "incompatible" ? "error" : "preview",
        lastSnapshotId: snapshot.snapshotId,
        lastSyncedAt: snapshot.updatedAt,
      });

      setCloudSyncState({
        ...nextConfig,
        latestSnapshot: {
          ...snapshot,
          diff,
        },
        error: "",
        success: diff.mode === "incompatible"
          ? "远端快照需检查，当前不会覆盖本地资料库。"
          : "远端快照已读取为预览，不会自动覆盖本地资料库。",
      });
    } catch (error) {
      const nextConfig = saveCloudSyncConfig({
        ...cloudSyncState,
        endpoint: cloudSyncState.endpoint,
        token: cloudSyncState.token,
        lastStatus: cloudSyncState.endpoint.trim() ? "error" : "idle",
      });

      setCloudSyncState({
        ...nextConfig,
        latestSnapshot: cloudSyncState.latestSnapshot,
        error: error.message,
        success: "",
      });
    }
  };

  const clearCloudSyncSettings = () => {
    setPendingCloudSyncClear(false);
    setPendingCloudSnapshotPush(false);
    clearCloudSyncConfig();
    setCloudSyncState({
      ...loadCloudSyncConfig(),
      latestSnapshot: null,
      error: "",
      success: "云同步配置已清除。",
    });
  };

  const cancelClearCloudSyncSettings = () => {
    setPendingCloudSyncClear(false);
    setCloudSyncState((current) => ({
      ...current,
      error: "",
      success: "已取消清除云同步配置，当前配置未更改。",
    }));
  };

  const cancelCloudSnapshotPush = () => {
    setPendingCloudSnapshotPush(false);
    setCloudSyncState((current) => ({
      ...current,
      error: "",
      success: "已取消推送云同步快照，当前资料库未上传。",
    }));
  };

  const saveRelationshipTemplate = () => {
    try {
      const template = validateRelationshipTemplate(relationshipTemplateDraft);
      if (relationshipTemplates.includes(template)) {
        setRelationshipTemplateError("这个关系模板已存在。");
        setRelationshipTemplateSuccess("");
        return;
      }

      const nextTemplates = [...relationshipTemplates, template];
      saveRelationshipTemplates(nextTemplates);
      setRelationshipTemplates(nextTemplates);
      setRelationshipTemplateDraft("");
      setRelationshipTemplateError("");
      setRelationshipTemplateSuccess(`关系模板已新增：${template}。`);
    } catch (error) {
      setRelationshipTemplateError(error.message);
      setRelationshipTemplateSuccess("");
    }
  };

  const removeRelationshipTemplate = (template) => {
    const nextTemplates = relationshipTemplates.filter((item) => item !== template);
    saveRelationshipTemplates(nextTemplates);
    setRelationshipTemplates(nextTemplates);
    setRelationshipTemplateError("");
    setRelationshipTemplateSuccess(`关系模板已移除：${template}。`);
  };

  const restoreRelationshipTemplates = () => {
    saveRelationshipTemplates(defaultRelationshipTemplateTypes);
    setRelationshipTemplates(defaultRelationshipTemplateTypes);
    setRelationshipTemplateDraft("");
    setRelationshipTemplateError("");
    setRelationshipTemplateSuccess("默认关系模板已恢复。");
  };

  const backfillHistoricalLargeFiles = async (files) => {
    if (!files || files.length === 0) return;

    try {
      const result = await backfillLargeFileCopies(store, files, attachmentStorageAdapter);

      setStore(result.store);
      setBackfillState({
        error: "",
        success:
          result.updatedCount > 0
            ? `已补拷贝 ${result.updatedCount} 个历史大文件完整副本：${formatFeedbackList(result.updatedAttachmentNames)}。`
            : "当前没有历史大文件需要补拷贝。",
      });
    } catch (error) {
      setBackfillState({
        error: error.message,
        success: "",
      });
    }
  };

  return (
    <main className="app-shell">
      <aside className="vault-sidebar">
        <div className="vault-header">
          <div className="vault-mark">GA</div>
          <div>
            <div className="vault-title">Graph Atlas</div>
            <div className="vault-status">本地 Vault 已连接</div>
          </div>
        </div>

        <button
          className={activeView === "graph" ? "nav-item active" : "nav-item"}
          type="button"
          onClick={() => setActiveView("graph")}
        >
          <span className="nav-glyph">MAP</span>
          图谱
        </button>
        <button
          className={activeView === "inbox" ? "nav-item active" : "nav-item"}
          type="button"
          onClick={() => setActiveView("inbox")}
        >
          <span className="nav-glyph">BOX</span>
          收集箱
          <span className="count">{inboxViewModel.pendingCount}</span>
        </button>

        <SectionTitle
          label="知识库"
          detail={vaultTreeSummary.label}
          detailTone={vaultTreeSummary.status}
          actionLabel="+"
          actionAriaLabel="新增资料"
          onAction={openAddForm}
        />
        <div className="tree">
          {vaultTreeViewModel.map((group) => (
            <div className="tree-group" key={group.label}>
              <div className="tree-label">⌄ {group.label}</div>
              {group.children.map((child) => (
                <button
                  className={[
                    "tree-child",
                    child.available ? "" : "missing",
                    child.entityId === activeNode.id ? "active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  key={child.title}
                  title={child.statusDescription}
                  aria-label={
                    child.available
                      ? `打开${child.title}`
                      : `创建${child.title}资料`
                  }
                  onClick={() => {
                    if (child.available) {
                      navigateToEntity(child.entityId);
                      setActiveView("graph");
                      return;
                    }

                    startInboxDraftFromTree(child.title);
                  }}
                >
                  <span className={child.available ? "doc-dot" : "doc-dot pending"} />
                  <span className="tree-child-title">{child.title}</span>
                  {!child.available && <small>{child.statusLabel}</small>}
                </button>
              ))}
            </div>
          ))}
        </div>

        <SectionTitle label="标签" />
        <div className="tags">
          {primarySidebarTags.map((tag) => (
            <button
              className={tagFilter === tag ? "tag active" : "tag"}
              type="button"
              key={tag}
              onClick={() => setTagFilter(tag)}
            >
              #{tag}
              <span>{nodes.filter((node) => node.tags.includes(tag)).length}</span>
            </button>
          ))}
          {secondarySidebarTags.length > 0 && (
            <details className="more-tags">
              <summary>更多标签 {secondarySidebarTags.length}</summary>
              <div>
                {secondarySidebarTags.map((tag) => (
                  <button
                    className={tagFilter === tag ? "tag active" : "tag"}
                    type="button"
                    key={tag}
                    onClick={() => setTagFilter(tag)}
                  >
                    #{tag}
                    <span>{nodes.filter((node) => node.tags.includes(tag)).length}</span>
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            onClick={() => {
              setActiveView("settings");
              setMobileDetailOpen(false);
              setMobileSection("settings");
            }}
          >
            设置
          </button>
          {resetActionState.pending ? (
            <div className="reset-confirmation" aria-live="polite">
              <span>确认重置资料库？</span>
              <div>
                <button type="button" onClick={cancelSidebarReset}>
                  取消
                </button>
                <button type="button" onClick={resetKnowledgeStore}>
                  确认重置
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setResetSuccess("");
                setResetActionState(requestReset());
              }}
            >
              重置
            </button>
          )}
          {resetSuccess && (
            <span className="reset-success" role="status">
              {resetSuccess}
            </span>
          )}
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="history-controls">
            <button
              type="button"
              disabled={!navigationState.canGoBack}
              aria-label="后退到上一个资料"
              onClick={() => setEntityHistory(goBackInEntityHistory)}
            >
              ‹
            </button>
            <button
              type="button"
              disabled={!navigationState.canGoForward}
              aria-label="前进到下一个资料"
              onClick={() => setEntityHistory(goForwardInEntityHistory)}
            >
              ›
            </button>
          </div>
          <label className="command-bar">
            <span>⌘K</span>
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="全局搜索"
              placeholder="搜索护照、签证、附件、联系人"
            />
          </label>
          <div className="top-actions">
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              {allTags.map((tag) => (
                <option value={tag} key={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <select
              value={privacyFilter}
              onChange={(event) => setPrivacyFilter(event.target.value)}
            >
              <option>全部隐私</option>
              <option value="high">高隐私</option>
              <option value="medium">中隐私</option>
              <option value="low">低隐私</option>
            </select>
            <button type="button" onClick={openAddForm}>
              新增资料
            </button>
          </div>
        </header>

        {activeView === "settings" ? (
          <SettingsView
            viewModel={settingsViewModel}
            backupState={backupState}
            onOpenInbox={() => {
              setActiveView("inbox");
              setMobileDetailOpen(false);
              setMobileSection("inbox");
            }}
            onRequestResetLayout={requestResetGraphLayout}
            onCancelResetLayout={cancelResetGraphLayout}
            onConfirmResetLayout={resetCurrentGraphLayout}
            layoutResetPending={layoutResetPending}
            layoutSaveStatus={layoutSaveStatus}
            onResetStore={() => {
              setResetSuccess("");
              setSettingsResetPending(true);
            }}
            settingsResetPending={settingsResetPending}
            resetSuccess={resetSuccess}
            onCancelSettingsReset={cancelSettingsReset}
            onConfirmSettingsReset={() =>
              resetKnowledgeStore({
                nextView: "settings",
                nextMobileSection: "settings",
              })
            }
            onExportBackup={exportBackupPackage}
            onPreviewBackupImport={previewBackupImport}
            onPreviewEncryptedBackupImport={previewEncryptedBackupImport}
            onCancelBackupRestore={cancelBackupRestore}
            onConfirmBackupRestore={confirmBackupRestore}
            backupEncryptionState={backupEncryptionState}
            onUpdateBackupEncryptionState={(patch) =>
              setBackupEncryptionState((current) => ({ ...current, ...patch }))
            }
            backfillState={backfillState}
            attachmentDirectoryState={attachmentDirectoryState}
            remoteAttachmentState={remoteAttachmentState}
            cloudSyncState={cloudSyncState}
            relationshipTemplates={relationshipTemplates}
            relationshipTemplateDraft={relationshipTemplateDraft}
            relationshipTemplateError={relationshipTemplateError}
            relationshipTemplateSuccess={relationshipTemplateSuccess}
            pendingDirectoryClear={pendingDirectoryClear}
            pendingRemoteConfigClear={pendingRemoteConfigClear}
            pendingCloudSyncClear={pendingCloudSyncClear}
            pendingCloudSnapshotPush={pendingCloudSnapshotPush}
            onChooseAttachmentDirectory={chooseAttachmentDirectory}
            onReauthorizeAttachmentDirectory={reauthorizeAttachmentDirectory}
            onRequestClearAttachmentDirectory={() => setPendingDirectoryClear(true)}
            onCancelClearAttachmentDirectory={cancelClearAttachmentDirectory}
            onConfirmClearAttachmentDirectory={clearAttachmentDirectory}
            onUpdateRemoteAttachmentField={updateRemoteAttachmentField}
            onSaveRemoteAttachmentConfig={saveRemoteAttachmentConfig}
            onRequestClearRemoteAttachmentConfig={() => setPendingRemoteConfigClear(true)}
            onCancelClearRemoteAttachmentConfig={cancelClearRemoteAttachmentConfig}
            onConfirmClearRemoteAttachmentConfig={clearRemoteAttachmentConfig}
            onBackfillHistoricalLargeFiles={backfillHistoricalLargeFiles}
            onUpdateCloudSyncField={updateCloudSyncField}
            onSaveCloudSyncSettings={saveCloudSyncSettings}
            onTestCloudSyncConnection={testCloudSyncConnection}
            onRequestCloudSnapshotPush={() => setPendingCloudSnapshotPush(true)}
            onCancelCloudSnapshotPush={cancelCloudSnapshotPush}
            onConfirmCloudSnapshotPush={pushCloudSnapshot}
            onPullCloudSnapshotPreview={pullCloudSnapshotPreview}
            onRequestClearCloudSync={() => setPendingCloudSyncClear(true)}
            onCancelClearCloudSync={cancelClearCloudSyncSettings}
            onConfirmClearCloudSync={clearCloudSyncSettings}
            onUpdateRelationshipTemplateDraft={(value) => {
              setRelationshipTemplateDraft(value);
              setRelationshipTemplateError("");
              setRelationshipTemplateSuccess("");
            }}
            onSaveRelationshipTemplate={saveRelationshipTemplate}
            onRemoveRelationshipTemplate={removeRelationshipTemplate}
            onRestoreRelationshipTemplates={restoreRelationshipTemplates}
          />
        ) : activeView === "inbox" ? (
          <section className="inbox-view">
            <div className="inbox-header">
              <div>
                <h1>收集箱</h1>
                <span>
                  {inboxViewModel.pendingCount} 条资料待整理 · {inboxViewModel.rejectedCount} 条已拒绝
                </span>
              </div>
            </div>

            <form className="inbox-form" onSubmit={submitInboxForm}>
              <label>
                <span>标题</span>
                <input
                  value={inboxForm.title}
                  onChange={(event) => updateInboxForm({ title: event.target.value })}
                  placeholder="例如：新酒店订单"
                  required
                />
              </label>
              <label>
                <span>类型</span>
                <select
                  value={inboxForm.type}
                  onChange={(event) => updateInboxForm({ type: event.target.value })}
                  required
                >
                  <option>笔记</option>
                  <option>证件</option>
                  <option>文件</option>
                  <option>联系人</option>
                  <option>生活</option>
                </select>
              </label>
              <label>
                <span>隐私级别</span>
                <select
                  value={inboxForm.privacy}
                  onChange={(event) => updateInboxForm({ privacy: event.target.value })}
                  required
                >
                  <option>高（仅自己可见）</option>
                  <option>中（本地保存）</option>
                  <option>低（可导出）</option>
                </select>
              </label>
              <label className="inbox-summary">
                <span>摘要</span>
                <input
                  value={inboxForm.summary}
                  onChange={(event) => updateInboxForm({ summary: event.target.value })}
                  placeholder="可选，先放入待整理"
                />
              </label>
              <label className="inbox-attachments">
                <span>附件索引</span>
                <input
                  value={inboxForm.attachments}
                  onChange={(event) => updateInboxForm({ attachments: event.target.value })}
                  placeholder="例如：订单.pdf, 凭证.jpg"
                />
              </label>
              {inboxError && <div className="form-error">{inboxError}</div>}
              {inboxSuccess && (
                <div className="form-success" role="status">
                  {inboxSuccess}
                </div>
              )}
              <div className="add-actions">
                <button type="submit">加入收集箱</button>
              </div>
            </form>

            <div className="inbox-list">
              {inboxViewModel.pendingEntries.length === 0 ? (
                <div className="inbox-empty">暂无待整理资料。</div>
              ) : (
                inboxViewModel.pendingEntries.map((entry) => {
                  const attachmentRows = getInboxAttachmentDraftRows(entry);

                  return (
                  <form
                    className="inbox-item"
                    key={entry.id}
                    onSubmit={(event) => confirmInboxEntry(event, entry.id)}
                  >
                    <div>
                      <label>
                        <span>标题</span>
                        <input name="title" defaultValue={entry.title} required />
                      </label>
                      <label>
                        <span>类型</span>
                        <select name="type" defaultValue={entry.type} required>
                          <option>笔记</option>
                          <option>证件</option>
                          <option>文件</option>
                          <option>联系人</option>
                          <option>生活</option>
                        </select>
                      </label>
                      <label>
                        <span>隐私级别</span>
                        <select name="privacy" defaultValue={entry.privacy} required>
                          <option>高（仅自己可见）</option>
                          <option>中（本地保存）</option>
                          <option>低（可导出）</option>
                        </select>
                      </label>
                      <label>
                        <span>摘要</span>
                        <input name="summary" defaultValue={entry.summary === "暂无摘要" ? "" : entry.summary} />
                      </label>
                      <div className="inbox-attachment-editor">
                        <span>附件索引</span>
                        <div
                          className="inbox-attachment-grid"
                          aria-label={`${entry.title} 附件元数据`}
                        >
                          <span>名称</span>
                          <span>大小/类型</span>
                          <span>日期</span>
                          <span>本地引用</span>
                          <span>操作</span>
                          {attachmentRows.map((attachment, index) => (
                            <Fragment key={`${entry.id}-${attachment.id}`}>
                              <input
                                name="attachmentName"
                                value={attachment.name}
                                onChange={(event) =>
                                  updateInboxAttachmentDraft(
                                    entry,
                                    attachment.id,
                                    "name",
                                    event.target.value,
                                  )
                                }
                                placeholder="订单.pdf"
                                aria-label={`附件 ${index + 1} 名称`}
                              />
                              <input
                                name="attachmentSize"
                                value={attachment.size}
                                onChange={(event) =>
                                  updateInboxAttachmentDraft(
                                    entry,
                                    attachment.id,
                                    "size",
                                    event.target.value,
                                  )
                                }
                                placeholder="索引"
                                aria-label={`附件 ${index + 1} 大小或类型`}
                              />
                              <input
                                name="attachmentDate"
                                value={attachment.date}
                                onChange={(event) =>
                                  updateInboxAttachmentDraft(
                                    entry,
                                    attachment.id,
                                    "date",
                                    event.target.value,
                                  )
                                }
                                placeholder="今天"
                                aria-label={`附件 ${index + 1} 日期`}
                              />
                              <input
                                name="attachmentReference"
                                value={attachment.reference}
                                onChange={(event) =>
                                  updateInboxAttachmentDraft(
                                    entry,
                                    attachment.id,
                                    "reference",
                                    event.target.value,
                                  )
                                }
                                placeholder="/Documents/订单.pdf"
                                aria-label={`附件 ${index + 1} 本地引用`}
                              />
                              <input
                                type="hidden"
                                name="attachmentLocalCopy"
                                value={serializeAttachmentLocalCopy(attachment.localCopy)}
                              />
                              {pendingInboxAttachmentRemoveId === `${entry.id}:${attachment.id}` ? (
                                <div className="inbox-attachment-remove-confirmation">
                                  <span>确认移除？</span>
                                  <button
                                    type="button"
                                    onClick={() => cancelInboxAttachmentDraftRowRemoval(entry, attachment)}
                                  >
                                    取消
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeInboxAttachmentDraftRow(entry, attachment.id)}
                                  >
                                    确认移除
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  aria-label={`移除附件 ${index + 1}`}
                                  onClick={() =>
                                    setPendingInboxAttachmentRemoveId(`${entry.id}:${attachment.id}`)
                                  }
                                >
                                  移除
                                </button>
                              )}
                              {attachment.localCopy?.copyStatus === "skipped-too-large" && (
                                <div className="large-file-hint" role="status">
                                  文件超过当前本地副本上限，已保留索引但未保存完整副本。可先入库，后续等待文件系统或后端存储 adapter。
                                </div>
                              )}
                              {attachment.localCopy?.copyStatus === "stored-file-system" && (
                                <div className="large-file-hint saved" role="status">
                                  完整副本将保存到本地附件目录；这不是云同步，清除目录授权不会删除本机文件。
                                </div>
                              )}
                            </Fragment>
                          ))}
                        </div>
                        <button
                          className="inbox-attachment-add"
                          type="button"
                          onClick={() => addInboxAttachmentDraftRow(entry)}
                        >
                          新增附件行
                        </button>
                        <label className="inbox-file-picker">
                          <input
                            type="file"
                            multiple
                            onChange={(event) => {
                              void addInboxAttachmentDraftFiles(entry, event.target.files || []);
                              event.target.value = "";
                            }}
                          />
                          选择本地文件
                        </label>
                      </div>
                      <p>
                        将创建：{entry.confirmationPreview.entityTitle}、{entry.confirmationPreview.documentTitle}、
                        {entry.confirmationPreview.sourceLabel}
                        {entry.attachmentCount > 0 ? `、${entry.attachmentCount} 个附件索引` : ""}
                      </p>
                    </div>
                    <span className="inbox-state">{entry.statusLabel}</span>
                    <div className="inbox-item-actions">
                      {pendingInboxRejectId === entry.id ? (
                        <div className="inbox-reject-confirmation" aria-live="polite">
                          <span>确认拒绝这条待整理资料？</span>
                          <button type="button" onClick={() => cancelRejectInboxEntry(entry)}>
                            取消
                          </button>
                          <button type="button" onClick={() => rejectInboxEntry(entry.id)}>
                            确认拒绝
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setPendingInboxRejectId(entry.id)}>
                          拒绝
                        </button>
                      )}
                      <button type="submit">确认入库</button>
                    </div>
                  </form>
                  );
                })
              )}
            </div>
          </section>
        ) : (
          <div className="atlas">
          <section className="graph-panel">
            <section className="home-summary" aria-label="首页任务摘要" ref={homeSummaryRef}>
              <div className="home-hero">
                <div className="home-copy">
                  <span className="home-kicker">资料工作台</span>
                  <h1>{homeSummary.headline}</h1>
                  <p>你的重要资料，一眼找到，关系清楚，AI 看不到不该看的。</p>
                </div>
              </div>
              <div className="task-entry-list" aria-label="任务入口">
                {homeSummary.taskEntries.map((entry) => (
                  <button
                    type="button"
                    className="task-entry"
                    key={entry.id}
                    onClick={() => handleTaskEntry(entry.action)}
                  >
                    <strong>{entry.label}</strong>
                    <span>{entry.description}</span>
                  </button>
                ))}
              </div>
              <div className="status-summary" aria-label="资料状态摘要">
                {homeSummary.statusSummary.map((status) => (
                  <button
                    type="button"
                    className="status-card"
                    key={status.label}
                    onClick={() => handleStatusSummary(status.label)}
                  >
                    <strong>{status.count}</strong>
                    <span>{status.label}</span>
                  </button>
                ))}
              </div>
              <div className="travel-check-card" aria-label="出行检查目标">
                <div>
                  <span>出行检查</span>
                  <strong>出发前 5 项关键资料</strong>
                </div>
                <div className="travel-check-list">
                  {homeSummary.travelCheckItems.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => focusTravelCheckItem(item)}
                    >
                      <span>{item.label}</span>
                      <small>{item.kind === "attachment" ? "附件线索" : "已保存"}</small>
                    </button>
                  ))}
                </div>
              </div>
              {showAddForm && (
                <form className="add-material-form" onSubmit={submitAddForm}>
                  <label>
                    <span>标题</span>
                    <input
                      value={addForm.title}
                      onChange={(event) => updateAddForm({ title: event.target.value })}
                      placeholder="例如：新签证材料"
                      required
                    />
                  </label>
                  <label>
                    <span>类型</span>
                    <select
                      value={addForm.type}
                      onChange={(event) => updateAddForm({ type: event.target.value })}
                      required
                    >
                      <option>笔记</option>
                      <option>证件</option>
                      <option>文件</option>
                      <option>联系人</option>
                      <option>生活</option>
                    </select>
                  </label>
                  <label>
                    <span>隐私级别</span>
                    <select
                      value={addForm.privacy}
                      onChange={(event) => updateAddForm({ privacy: event.target.value })}
                      required
                    >
                      <option>高（仅自己可见）</option>
                      <option>中（本地保存）</option>
                      <option>低（可导出）</option>
                    </select>
                  </label>
                  <label className="add-summary">
                    <span>摘要</span>
                    <input
                      value={addForm.summary}
                      onChange={(event) => updateAddForm({ summary: event.target.value })}
                      placeholder="可选，先记录一句线索"
                    />
                  </label>
                  <label className="add-checkbox">
                    <input
                      type="checkbox"
                      checked={addForm.linkToActive}
                      onChange={(event) => updateAddForm({ linkToActive: event.target.checked })}
                    />
                    关联当前资料
                  </label>
                  {addError && <div className="form-error">{addError}</div>}
                  <div className="add-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setAddForm(defaultAddForm);
                        setAddError("");
                      }}
                    >
                      取消
                    </button>
                    <button type="submit">保存资料</button>
                  </div>
                </form>
              )}
            </section>

            {searchViewModel.hasActiveQuery && (
              <SearchResults
                viewModel={searchViewModel}
                onAdd={openAddForm}
                onOpenEntity={(entityId) => {
                  openEntity(entityId, { revealDetailOnMobile: true });
                  setActiveTab("概览");
                  setActiveView("graph");
                }}
              />
            )}

            <AiContextPreview viewModel={aiContextPreview} scoped={searchViewModel.hasActiveQuery} />

            <CitedAnswerPanel
              draft={citedAnswerDraft}
              question={aiQuestion}
              scoped={searchViewModel.hasActiveQuery}
              onQuestionChange={setAiQuestion}
              onSubmit={submitAiQuestion}
            />

            <div className="graph-header">
              <div>
                <h1>我的知识图谱</h1>
                <span>{graphFocus.summary}</span>
              </div>
              <div className="graph-tools">
                <form className="layout-save-form" onSubmit={saveCurrentLayout}>
                  <input
                    value={layoutTitle}
                    onChange={(event) => {
                      setLayoutTitle(event.target.value);
                      setLayoutSaveStatus("");
                    }}
                    aria-label="布局版本名称"
                    placeholder={layoutVersionViewModel.nextTitle}
                  />
                  <input
                    value={layoutNote}
                    onChange={(event) => {
                      setLayoutNote(event.target.value);
                      setLayoutSaveStatus("");
                    }}
                    aria-label="布局版本备注"
                    placeholder="版本备注"
                  />
                  <button type="submit">保存布局</button>
                </form>
                {layoutSaveStatus && (
                  <span className="layout-save-status" role="status">
                    {layoutSaveStatus}
                  </span>
                )}
                <button
                  type="button"
                  disabled={!query.trim()}
                  aria-label="清除当前搜索"
                  onClick={() => setQuery("")}
                >
                  清除搜索
                </button>
                {layoutResetPending ? (
                  <div className="layout-reset-confirmation" aria-live="polite">
                    <span>确认恢复默认布局？</span>
                    <button type="button" onClick={cancelResetGraphLayout}>
                      取消
                    </button>
                    <button type="button" onClick={resetCurrentGraphLayout}>
                      确认恢复
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={requestResetGraphLayout}>
                    恢复布局
                  </button>
                )}
                <button type="button" onClick={() => setZoom((value) => Math.min(value + 10, 140))}>
                  放大
                </button>
              </div>
            </div>

            <details className="layout-version-panel">
              <summary>
                <span>布局版本</span>
                <small>{layoutVersionViewModel.summary}</small>
              </summary>
              <div className="layout-version-list">
                {layoutApplyState.undo && (
                  <div className="layout-version-undo" role="status">
                    <span>已应用“{layoutApplyState.undo.title}”，可恢复到应用前布局</span>
                    <button type="button" onClick={undoApplySavedLayout}>
                      撤销应用
                    </button>
                  </div>
                )}
                {layoutVersionViewModel.hasSnapshots ? (
                  layoutVersionViewModel.snapshots.map((snapshot) => (
                    <div className="layout-version-row" key={snapshot.id}>
                      <form
                        className="layout-version-edit"
                        onSubmit={(event) => updateSavedLayout(event, snapshot.id)}
                      >
                        <label>
                          <span>名称</span>
                          <input name="title" defaultValue={snapshot.title} required />
                        </label>
                        <label>
                          <span>备注</span>
                          <input name="note" defaultValue={snapshot.note} placeholder="版本备注" />
                        </label>
                        <button type="submit">保存</button>
                      </form>
                      <div className="layout-version-actions">
                        <button type="button" onClick={() => requestApplySavedLayout(snapshot.id)}>
                          应用
                        </button>
                        <button type="button" onClick={() => copySavedLayout(snapshot)}>
                          复制
                        </button>
                        {pendingLayoutDeleteId === snapshot.id ? (
                          <div className="layout-version-delete-confirm" role="status">
                            <span>确认删除这个布局版本？</span>
                            <button
                              type="button"
                              onClick={() => {
                                setPendingLayoutDeleteId("");
                                setLayoutSaveStatus(`布局版本删除已取消：${snapshot.title}`);
                              }}
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSavedLayout(snapshot)}
                            >
                              确认删除
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            aria-label={`删除${snapshot.title}`}
                            onClick={() => {
                              setLayoutApplyState(clearLayoutApplyState());
                              setPendingLayoutDeleteId(snapshot.id);
                              setLayoutSaveStatus("");
                            }}
                          >
                            删除
                          </button>
                        )}
                      </div>
                      <span className="layout-version-meta">
                        {snapshot.summary} · {snapshot.differenceLabel} · {snapshot.createdAt}
                      </span>
                      {snapshot.differences.length > 0 && (
                        <div className="layout-version-diff">
                          {snapshot.differences.map((difference) => (
                            <span key={`${snapshot.id}-${difference.entityId}`}>
                              {difference.title}: 当前 {difference.current} / 保存 {difference.saved}
                            </span>
                          ))}
                        </div>
                      )}
                      {layoutApplyState.pendingSnapshotId === snapshot.id && (
                        <div className="layout-version-confirmation" role="status">
                          <span>{snapshot.applyConfirmationLabel}</span>
                          <div>
                            <button type="button" onClick={() => applySavedLayout(snapshot)}>
                              确认应用
                            </button>
                            <button type="button" onClick={() => cancelApplySavedLayout(snapshot)}>
                              取消
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <span className="layout-version-empty">暂无保存布局</span>
                )}
              </div>
            </details>

            <div
              className="graph-canvas"
              aria-label="个人资料关系图谱"
              ref={graphCanvasRef}
              onPointerDown={beginGraphGesture}
              onPointerMove={moveGraphGesture}
              onPointerUp={finishGraphGesture}
              onPointerCancel={finishGraphGesture}
            >
              <div className="mobile-graph-guide" role="group" aria-label="移动端图谱操作">
                <span>拖动画布看全图，松手可惯性滑动，拖动节点整理位置，双指缩放</span>
                <span className="mobile-graph-status" role="status" aria-live="polite">
                  {graphZoomStatusLabel}
                </span>
                <div className="mobile-graph-actions">
                  <button
                    type="button"
                    onClick={() => setZoom((value) => Math.max(value - 10, 70))}
                  >
                    缩小
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((value) => Math.min(value + 10, 140))}
                  >
                    放大
                  </button>
                  <button type="button" onClick={resetMobileGraphView}>
                    复位
                  </button>
                  <button type="button" onClick={openCurrentDetailOnMobile}>
                    当前资料
                  </button>
                </div>
              </div>
              <canvas ref={canvasRef} aria-hidden="true" />
              {visibleNodes.map((node) => {
                const dragging = dragPreview?.entityId === node.id;
                const className = [
                  "graph-node",
                  node.id === activeId ? "active" : "",
                  graphFocus.relatedIds.has(node.id) ? "focus-related" : "focus-dimmed",
                  dragging ? "dragging" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                <button
                  key={node.id}
                  type="button"
                  className={className}
                  style={{
                    "--x": `${node.x}%`,
                    "--y": `${node.y}%`,
                    "--pan-x": `${graphPan.x}px`,
                    "--pan-y": `${graphPan.y}px`,
                    "--node-color": node.color,
                    transform: `translate(-50%, -50%) scale(${zoom / 100})`,
                  }}
                  title="拖拽可调整图谱位置"
                  aria-label={`${node.title}，拖拽可调整图谱位置`}
                  onPointerDown={(event) => beginNodeDrag(event, node)}
                  onPointerMove={moveNodeDrag}
                  onPointerUp={finishNodeDrag}
                  onPointerCancel={cancelNodeDrag}
                  onDragStart={(event) => event.preventDefault()}
                  onClick={() => openEntity(node.id, { revealDetailOnMobile: true })}
                >
                  <span>{node.icon}</span>
                  <strong>{node.title}</strong>
                </button>
                );
              })}

              <div className="zoom-control">
                <button
                  type="button"
                  aria-label="缩小图谱"
                  onClick={() => setZoom((value) => Math.max(value - 10, 70))}
                >
                  -
                </button>
                <span aria-label="当前图谱缩放" aria-live="polite">{zoom}%</span>
                <button
                  type="button"
                  aria-label="放大图谱"
                  onClick={() => setZoom((value) => Math.min(value + 10, 140))}
                >
                  +
                </button>
              </div>
            </div>

            <section className="recent-panel">
              <div className="recent-head">
                <div>
                  <h2>最近更新</h2>
                  <span>{recentViewModel.summary}</span>
                </div>
                <button type="button" onClick={() => setRecentExpanded((value) => !value)}>
                  {recentViewModel.toggleLabel}
                </button>
              </div>
              <div className="recent-table">
                <div className="recent-row header">
                  <span>标题</span>
                  <span>所在位置</span>
                  <span>更新时间</span>
                </div>
                {recentViewModel.rows.map((node) => (
                  <button
                    className={node.id === activeId ? "recent-row active" : "recent-row"}
                    type="button"
                    key={node.id}
                    onClick={() => openEntity(node.id, { revealDetailOnMobile: true })}
                  >
                    <span>
                      <b style={{ color: node.color }}>{node.icon}</b>
                      {node.title}
                    </span>
                    <span>{node.type} / {node.tags[0]}</span>
                    <span>{node.updated}</span>
                  </button>
                ))}
              </div>
            </section>
          </section>

          <aside
            className={mobileDetailOpen ? "detail-panel mobile-open" : "detail-panel"}
            aria-label="资料详情"
          >
            <div className="detail-title">
              <div className="node-badge" style={{ "--node-color": activeNode.color }}>
                {activeNode.icon}
              </div>
              <div>
                <h2>{activeNode.title}</h2>
                <span>{activeNode.type}</span>
                {favoriteSaveStatus && (
                  <em className="favorite-save-status" role="status">
                    {favoriteSaveStatus}
                  </em>
                )}
                {inboxConfirmSuccess?.entityId === activeId && (
                  <em className="inbox-confirm-success" role="status">
                    {inboxConfirmSuccess.message}
                  </em>
                )}
              </div>
              <button
                className={activeNode.favorite ? "star active" : "star"}
                type="button"
                aria-label={activeNode.favorite ? "从收藏中移除当前资料" : "收藏当前资料"}
                aria-pressed={activeNode.favorite}
                onClick={toggleFavorite}
              >
                ★
              </button>
              <button
                className="mobile-detail-close"
                type="button"
                aria-label="关闭资料详情"
                onClick={() => {
                  setMobileDetailOpen(false);
                  setMobileSection("graph");
                }}
              >
                关闭
              </button>
            </div>

            <div className="mobile-detail-summary" aria-label="移动端详情摘要">
              <div>
                <strong>{activeNode.title}</strong>
                <span>{activeNode.type}</span>
              </div>
              <div className="mobile-detail-facts">
                <span>
                  状态：{detailViewModel.materialStatuses.map((status) => status.label).join(" · ") ||
                    "已保存"}
                </span>
                <span>隐私：{detailViewModel.privacy.label}</span>
                <span>AI：{detailViewModel.aiVisibility.label}</span>
                <span>附件：{detailViewModel.attachments.length}</span>
                <span>关系：{detailViewModel.relationships.length}</span>
                <span>来源：{detailViewModel.sources.length}</span>
              </div>
            </div>

            <div className="mobile-detail-shortcuts" aria-label="移动端详情快捷编辑">
              <button type="button" onClick={() => activateMobileDetailShortcut("tags")}>
                标签
              </button>
              <button type="button" onClick={() => activateMobileDetailShortcut("relationships")}>
                关系
              </button>
              <button type="button" onClick={() => activateMobileDetailShortcut("attachments")}>
                附件
              </button>
              <button type="button" onClick={() => activateMobileDetailShortcut("sources")}>
                来源
              </button>
              <button type="button" onClick={() => activateMobileDetailShortcut("body")}>
                正文
              </button>
            </div>

            <div className="detail-priority-strip" aria-label="资料关键状态">
              <div>
                <span>资料状态</span>
                <strong>
                  {detailViewModel.materialStatuses.map((status) => status.label).join(" · ") ||
                    "已保存"}
                </strong>
              </div>
              <div>
                <span>隐私</span>
                <strong>{detailViewModel.privacy.label}</strong>
              </div>
              <div>
                <span>AI</span>
                <strong>{detailViewModel.aiVisibility.label}</strong>
              </div>
              <div>
                <span>来源</span>
                <strong>{detailViewModel.sources.length} 个</strong>
              </div>
            </div>

            <div className="detail-tabs">
              {tabs.map((tab) => (
                <button
                  className={activeTab === tab ? "active" : ""}
                  type="button"
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "概览" && (
              <>
                <InfoBlock title="基本信息">
                  <form className="entity-info-form" onSubmit={submitEntityInfoForm}>
                    <label>
                      <span>资料标题</span>
                      <input
                        value={entityInfoForm.title}
                        onChange={(event) =>
                          updateEntityInfoForm({ title: event.target.value })
                        }
                        aria-label="资料标题"
                        required
                      />
                    </label>
                    <label>
                      <span>资料类型</span>
                      <input
                        value={entityInfoForm.type}
                        onChange={(event) =>
                          updateEntityInfoForm({ type: event.target.value })
                        }
                        aria-label="资料类型"
                        required
                      />
                    </label>
                    <button type="submit">保存基本信息</button>
                    {entityInfoError && <span className="entity-info-error">{entityInfoError}</span>}
                    {entityInfoSuccess && (
                      <span className="entity-info-success" role="status">
                        {entityInfoSuccess}
                      </span>
                    )}
                  </form>
                  <div className="field-row">
                    <span>资料状态</span>
                    <div className="tag-chips">
                      {detailViewModel.materialStatuses.map((status) => (
                        <span key={status.id} title={status.description}>
                          {status.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <label className="field-row">
                    <span>隐私级别</span>
                    <select
                      value={detailViewModel.privacy.label}
                      onChange={(event) => updatePrivacyLevel(event.target.value)}
                      aria-label="隐私级别"
                    >
                      <option>高（仅自己可见）</option>
                      <option>中（本地保存）</option>
                      <option>低（可导出）</option>
                    </select>
                  </label>
                  {privacySaveStatus && (
                    <span className="privacy-save-status" role="status">
                      {privacySaveStatus}
                    </span>
                  )}
                  <Field
                    label="AI 状态"
                    value={`${detailViewModel.aiVisibility.label} · ${detailViewModel.aiVisibility.description}`}
                  />
                  <Field label="缺失关系" value={`${detailViewModel.missingRelationshipCount} 条`} />
                  <Field label="来源数量" value={`${detailViewModel.sources.length} 个`} />
                  <Field label="创建时间" value={activeNode.created} />
                  <Field label="更新时间" value={activeNode.updated} />
                </InfoBlock>

                <InfoBlock title="标签" blockRef={detailTagsRef}>
                  <div className="tag-chips">
                    {activeNode.tags.map((tag) => (
                      <span className="tag-chip editable" key={tag}>
                        {tag}
                        <button type="button" onClick={() => startTagEdit(tag)}>
                          编辑
                        </button>
                        {pendingTagDelete === tag ? (
                          <>
                            <button type="button" onClick={() => deleteTag(tag)}>
                              确认移除
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPendingTagDelete("");
                                setTagSuccess(`已取消移除标签：${tag}。`);
                              }}
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setPendingTagDelete(tag);
                              setEditingTag("");
                              setEditingTagDraft("");
                              setTagError("");
                              setTagSuccess("");
                            }}
                          >
                            移除
                          </button>
                        )}
                      </span>
                    ))}
                    <button
                      type="button"
                      className="tag-add-button"
                      aria-label="新增标签"
                      onClick={() => {
                        setShowTagForm(true);
                        setEditingTag("");
                        setEditingTagDraft("");
                        setPendingTagDelete("");
                        setTagError("");
                        setTagSuccess("");
                      }}
                    >
                      +
                    </button>
                  </div>
                  {editingTag && (
                    <form className="tag-form" onSubmit={submitTagEdit}>
                      <input
                        value={editingTagDraft}
                        onChange={(event) => {
                          setEditingTagDraft(event.target.value);
                          setTagError("");
                          setTagSuccess("");
                        }}
                        aria-label="编辑标签"
                        autoFocus
                      />
                      <button type="submit">保存修改</button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTag("");
                          setEditingTagDraft("");
                          setTagError("");
                          setTagSuccess("");
                        }}
                      >
                        取消
                      </button>
                        {tagError && <span className="tag-form-error">{tagError}</span>}
                      </form>
                    )}
                  {showTagForm && (
                    <form className="tag-form" onSubmit={submitTagForm}>
                      <input
                        value={tagDraft}
                        onChange={(event) => {
                          setTagDraft(event.target.value);
                          setTagError("");
                          setTagSuccess("");
                        }}
                        aria-label="新增标签"
                        placeholder="新增标签"
                        autoFocus
                      />
                      <button type="submit">保存</button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTagForm(false);
                          setTagDraft("");
                          setTagError("");
                          setTagSuccess("");
                        }}
                      >
                        取消
                      </button>
                      {tagError && <span className="tag-form-error">{tagError}</span>}
                    </form>
                  )}
                  {tagError && !showTagForm && !editingTag && (
                    <span className="tag-form-error">{tagError}</span>
                  )}
                  {tagSuccess && (
                    <span className="tag-form-success" role="status">
                      {tagSuccess}
                    </span>
                  )}
                  <div className="suggestion-list">
                    {tagSuggestionSuccess && (
                      <span className="suggestion-success" role="status">
                        {tagSuggestionSuccess}
                      </span>
                    )}
                    {tagSuggestions.length === 0 ? (
                      <p>暂无标签建议。</p>
                    ) : (
                      tagSuggestions.map((suggestion) => {
                        const isEditingSuggestion = editingTagSuggestionId === suggestion.id;

                        return (
                          <article key={suggestion.id}>
                            <div>
                              <strong>{suggestion.tag}</strong>
                              <span>{suggestion.reason} · {suggestion.privacyImpact}</span>
                              <p>{suggestion.evidence}</p>
                            </div>
                            {isEditingSuggestion ? (
                              <form
                                className="suggestion-edit-form"
                                onSubmit={(event) => submitTagSuggestionEdit(event, suggestion.id)}
                              >
                                <label className="suggestion-edit-evidence">
                                  <span>标签名称</span>
                                  <input
                                    value={tagSuggestionForm.tag}
                                    onChange={(event) =>
                                      updateTagSuggestionForm({ tag: event.target.value })
                                    }
                                    aria-label="标签名称"
                                    required
                                  />
                                </label>
                                {tagSuggestionError && (
                                  <span className="suggestion-edit-error">{tagSuggestionError}</span>
                                )}
                                <div className="suggestion-actions">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTagSuggestionId("");
                                      setTagSuggestionForm(defaultTagSuggestionForm);
                                      setTagSuggestionError("");
                                    }}
                                  >
                                    取消修改
                                  </button>
                                  <button type="submit">确认修改</button>
                                </div>
                              </form>
                            ) : (
                              <div className="suggestion-actions">
                                <button
                                  type="button"
                                  onClick={() => startTagSuggestionEdit(suggestion)}
                                >
                                  修改
                                </button>
                                <button
                                  type="button"
                                  onClick={() => rejectTagSuggestion(suggestion.id)}
                                >
                                  拒绝
                                </button>
                                <button
                                  type="button"
                                  onClick={() => confirmTagSuggestion(suggestion.id)}
                                >
                                  确认
                                </button>
                              </div>
                            )}
                          </article>
                        );
                      })
                    )}
                  </div>
                </InfoBlock>

                <InfoBlock
                  title={`关联笔记（${detailViewModel.relationships.length}）`}
                  blockRef={detailRelationshipsRef}
                >
                  <div className="relationship-toolbar">
                    <span>可点击跳转，手动关系可编辑。</span>
                    <button
                      type="button"
                      onClick={startRelationshipCreate}
                    >
                      新增关系
                    </button>
                  </div>
                  {showRelationshipForm && (
                    <form className="relationship-form" onSubmit={submitRelationshipForm}>
                      <label>
                        <span>目标资料</span>
                        <select
                          value={relationshipForm.targetId}
                          onChange={(event) => updateRelationshipForm({ targetId: event.target.value })}
                          required
                        >
                          <option value="">选择资料</option>
                          {relationshipTargetOptions.map((node) => (
                            <option value={node.id} key={node.id}>
                              {node.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>关系类型</span>
                        <input
                          list="relationship-type-options"
                          value={relationshipForm.relationType}
                          onChange={(event) =>
                            updateRelationshipForm({ relationType: event.target.value })
                          }
                          placeholder="选择或输入关系类型"
                          required
                        />
                        <datalist id="relationship-type-options">
                          {relationshipFormTypeOptions.map((type) => (
                            <option value={type} key={type} />
                          ))}
                        </datalist>
                        <em className="relationship-type-hint">
                          可输入新关系词，也可用模板或当前资料库已有关系词。
                        </em>
                      </label>
                      <label className="relationship-evidence">
                        <span>来源说明</span>
                        <input
                          value={relationshipForm.evidence}
                          onChange={(event) =>
                            updateRelationshipForm({ evidence: event.target.value })
                          }
                          placeholder="例如：手动整理出行资料时确认"
                        />
                      </label>
                      {!editingRelationshipId && (
                        <label className="relationship-reciprocal">
                          <input
                            type="checkbox"
                            checked={relationshipForm.reciprocal}
                            onChange={(event) =>
                              updateRelationshipForm({ reciprocal: event.target.checked })
                            }
                          />
                          <span>
                            同时创建反向关系
                            {relationshipForm.reciprocal && selectedRelationshipTarget && (
                              <em>
                                将创建：{selectedRelationshipTarget.title} → {activeNode.title} · {reverseRelationshipType}
                              </em>
                            )}
                          </span>
                        </label>
                      )}
                      <div className="relationship-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setShowRelationshipForm(false);
                            setRelationshipForm(defaultRelationshipForm);
                            setRelationshipError("");
                            setRelationshipSuccess("");
                            setEditingRelationshipId("");
                          }}
                        >
                          取消
                        </button>
                        <button type="submit">{editingRelationshipId ? "保存修改" : "保存关系"}</button>
                      </div>
                    </form>
                  )}
                  {relationshipError && <span className="relationship-form-error">{relationshipError}</span>}
                  {relationshipSuccess && (
                    <span className="relationship-form-success" role="status">
                      {relationshipSuccess}
                    </span>
                  )}
                  {detailViewModel.relationships.length === 0 ? (
                    <div className="relationship-empty">
                      <span>暂无关系，可建立与其他资料的联系。</span>
                      <button type="button" onClick={startRelationshipCreate}>
                        建立关系
                      </button>
                    </div>
                  ) : (
                    <div className="link-list">
                      {detailViewModel.relationships.map((relationship) => (
                      <div
                        key={relationship.id}
                        className={`relationship-row${relationship.targetMissing ? " missing" : ""}`}
                      >
                        <button
                          type="button"
                          className="relationship-open"
                          disabled={relationship.targetMissing}
                          title={relationship.statusDescription}
                          onClick={() => {
                            navigateToEntity(relationship.targetId);
                          }}
                        >
                          <span>
                            {relationship.targetTitle}
                            {relationship.targetMissing && <em>{relationship.statusDescription}</em>}
                            <span className="relationship-audit-rows">
                              {relationship.sourceAuditRows.map((row) => (
                                <em
                                  className={[
                                    "relationship-audit-row",
                                    row.id === "permission" ? relationship.sourcePermissionLevel : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  key={`${relationship.id}-${row.id}`}
                                >
                                  <strong>{row.label}</strong>
                                  {row.value}
                                </em>
                              ))}
                            </span>
                            <em className="relationship-permission-reason">
                              {relationship.sourcePermissionReason}
                            </em>
                          </span>
                          <small>{relationship.targetMissing ? relationship.statusLabel : relationship.relation}</small>
                        </button>
                        {(relationship.canEdit || relationship.canDelete) && (
                          <div className="relationship-row-actions">
                            {relationship.canEdit && pendingRelationshipDeleteId !== relationship.id && (
                              <button
                                type="button"
                                className="relationship-edit"
                                aria-label={`编辑关系 ${relationship.targetTitle} ${relationship.relation}`}
                                onClick={() => startRelationshipEdit(relationship)}
                              >
                                编辑
                              </button>
                            )}
                            {relationship.canDelete && (
                              pendingRelationshipDeleteId === relationship.id ? (
                                <div className="relationship-delete-confirm">
                                  <button
                                    type="button"
                                    onClick={() => deleteRelationship(relationship.id)}
                                  >
                                    确认移除
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPendingRelationshipDeleteId("");
                                      setRelationshipSuccess(
                                        `已取消移除关系：${activeNode.title} → ${relationship.targetTitle} · ${relationship.relation}。`,
                                      );
                                    }}
                                  >
                                    取消
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="relationship-delete"
                                  aria-label={`移除关系 ${relationship.targetTitle} ${relationship.relation}`}
                                  onClick={() => {
                                    setPendingRelationshipDeleteId(relationship.id);
                                    setEditingRelationshipId("");
                                    setShowRelationshipForm(false);
                                    setRelationshipForm(defaultRelationshipForm);
                                    setRelationshipError("");
                                    setRelationshipSuccess("");
                                  }}
                                >
                                  移除
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                      ))}
                    </div>
                  )}
                </InfoBlock>

                <InfoBlock title={`关系建议（${relationshipSuggestions.length}）`}>
                  <div className="suggestion-list">
                    {relationshipSuggestionSuccess && (
                      <span className="suggestion-success" role="status">
                        {relationshipSuggestionSuccess}
                      </span>
                    )}
                    {relationshipSuggestions.length === 0 ? (
                      <p>暂无关系建议。</p>
                    ) : (
                      relationshipSuggestions.map((suggestion) => {
                        const isEditingSuggestion = editingRelationshipSuggestionId === suggestion.id;
                        const suggestionRelationTypes = Array.from(
                          new Set([suggestion.relationType, ...relationshipTypeOptions]),
                        );

                        return (
                          <article key={suggestion.id}>
                            <div>
                              <strong>{suggestion.toTitle}</strong>
                              <span>{suggestion.relationType} · {suggestion.privacyImpact}</span>
                              <p>{suggestion.evidence}</p>
                            </div>
                            {isEditingSuggestion ? (
                              <form
                                className="suggestion-edit-form"
                                onSubmit={(event) => submitRelationshipSuggestionEdit(event, suggestion.id)}
                              >
                                <label>
                                  <span>目标资料</span>
                                  <select
                                    value={relationshipSuggestionForm.targetId}
                                    onChange={(event) =>
                                      updateRelationshipSuggestionForm({ targetId: event.target.value })
                                    }
                                    required
                                  >
                                    {relationshipTargetOptions.map((node) => (
                                      <option value={node.id} key={node.id}>
                                        {node.title}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label>
                                  <span>关系类型</span>
                                  <select
                                    value={relationshipSuggestionForm.relationType}
                                    onChange={(event) =>
                                      updateRelationshipSuggestionForm({
                                        relationType: event.target.value,
                                      })
                                    }
                                    required
                                  >
                                    {suggestionRelationTypes.map((type) => (
                                      <option value={type} key={type}>
                                        {type}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="suggestion-edit-evidence">
                                  <span>来源说明</span>
                                  <input
                                    value={relationshipSuggestionForm.evidence}
                                    onChange={(event) =>
                                      updateRelationshipSuggestionForm({ evidence: event.target.value })
                                    }
                                  />
                                </label>
                                {relationshipSuggestionError && (
                                  <span className="suggestion-edit-error">
                                    {relationshipSuggestionError}
                                  </span>
                                )}
                                <div className="suggestion-actions">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingRelationshipSuggestionId("");
                                      setRelationshipSuggestionForm(defaultRelationshipSuggestionForm);
                                      setRelationshipSuggestionError("");
                                    }}
                                  >
                                    取消修改
                                  </button>
                                  <button type="submit">确认修改</button>
                                </div>
                              </form>
                            ) : (
                              <div className="suggestion-actions">
                                <button
                                  type="button"
                                  onClick={() => startRelationshipSuggestionEdit(suggestion)}
                                >
                                  修改
                                </button>
                                <button
                                  type="button"
                                  onClick={() => rejectRelationshipSuggestion(suggestion.id)}
                                >
                                  拒绝
                                </button>
                                <button
                                  type="button"
                                  onClick={() => confirmRelationshipSuggestion(suggestion.id)}
                                >
                                  确认
                                </button>
                              </div>
                            )}
                          </article>
                        );
                      })
                    )}
                  </div>
                </InfoBlock>

                <InfoBlock
                  title={`附件（${detailViewModel.attachments.length}）`}
                  blockRef={detailAttachmentsRef}
                >
                  <div className="attachments">
                    {detailViewModel.attachments.length === 0 ? (
                      <div className="attachment-empty">
                        <span>暂无附件，可添加文件索引。</span>
                        <button type="button" onClick={startAttachmentCreate}>
                          添加文件索引
                        </button>
                      </div>
                    ) : (
                      detailViewModel.attachments.map((file) => (
                        <div className="attachment" key={file.id}>
                          <span>FILE</span>
                          <div>
                            <strong>{file.name}</strong>
                            <small>{file.size} · {file.date}</small>
                            {file.reference && <small>{file.reference}</small>}
                            {file.localCopyLabel && <small>{file.localCopyLabel}</small>}
                            {file.localCopyStatusLabel && <small>{file.localCopyStatusLabel}</small>}
                            {file.localCopyActionLabel && (
                              <small className="attachment-action">{file.localCopyActionLabel}</small>
                            )}
                          </div>
                          <div className="attachment-actions">
                            {pendingAttachmentDeleteId === file.id ? (
                              <>
                                <button type="button" onClick={() => deleteAttachment(file.id)}>
                                  确认移除
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPendingAttachmentDeleteId("");
                                    setAttachmentSuccess(`已取消移除附件索引：${file.name}。`);
                                  }}
                                >
                                  取消
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => startAttachmentEdit(file)}>
                                  编辑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPendingAttachmentDeleteId(file.id);
                                    setAttachmentError("");
                                    setAttachmentSuccess("");
                                  }}
                                >
                                  移除
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {showAttachmentForm && (
                      <form className="attachment-form" onSubmit={submitAttachmentForm}>
                        <label>
                          <span>附件名称</span>
                          <input
                            value={attachmentForm.name}
                            onChange={(event) =>
                              updateAttachmentForm({ name: event.target.value })
                            }
                            placeholder="例如：身份证扫描件.pdf"
                            aria-label="附件名称"
                            required
                          />
                        </label>
                        <label>
                          <span>大小或类型</span>
                          <input
                            value={attachmentForm.size}
                            onChange={(event) =>
                              updateAttachmentForm({ size: event.target.value })
                            }
                            placeholder="例如：索引 / 480 KB"
                            aria-label="大小或类型"
                          />
                        </label>
                        <label>
                          <span>日期</span>
                          <input
                            value={attachmentForm.date}
                            onChange={(event) =>
                              updateAttachmentForm({ date: event.target.value })
                            }
                            placeholder="例如：今天"
                            aria-label="附件日期"
                          />
                        </label>
                        <label className="attachment-reference">
                          <span>本地引用</span>
                          <input
                            value={attachmentForm.reference}
                            onChange={(event) =>
                              updateAttachmentForm({ reference: event.target.value })
                            }
                            placeholder="例如：/Users/me/Documents/id-card.pdf"
                            aria-label="附件本地引用"
                          />
                        </label>
                        <div className="attachment-form-actions">
                          <button type="submit">
                            {editingAttachmentId ? "保存修改" : "保存附件索引"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAttachmentForm(false);
                              setEditingAttachmentId("");
                              setAttachmentForm(defaultAttachmentForm);
                              setAttachmentError("");
                              setAttachmentSuccess("");
                            }}
                          >
                            取消
                          </button>
                        </div>
                        {attachmentError && (
                          <span className="attachment-form-error">{attachmentError}</span>
                        )}
                      </form>
                    )}
                    {attachmentSuccess && (
                      <span className="attachment-form-success" role="status">
                        {attachmentSuccess}
                      </span>
                    )}
                  </div>
                </InfoBlock>

                <InfoBlock title="来自哪里" blockRef={detailSourcesRef}>
                  <div className="source-list">
                    {detailViewModel.sources.map((source) => (
                      <div className="source-item" key={source.id}>
                        <span>{source.kind === "empty" ? "NONE" : "SRC"}</span>
                        {editingSourceId === source.id ? (
                          <form className="source-edit-form" onSubmit={(event) => submitSourceEdit(event, source.id)}>
                            <input
                              value={editingSourceDraft}
                              onChange={(event) => {
                                setEditingSourceDraft(event.target.value);
                                setSourceError("");
                                setSourceSuccess("");
                              }}
                              aria-label="编辑来源说明"
                              autoFocus
                            />
                            <button type="submit">保存</button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSourceId("");
                                setEditingSourceDraft("");
                                setSourceError("");
                                setSourceSuccess("");
                              }}
                            >
                              取消
                            </button>
                          </form>
                        ) : (
                          <>
                            <strong>{source.label}</strong>
                            {(source.canEdit || source.canDelete) && (
                              <div className="source-actions">
                                {source.canEdit && pendingSourceDeleteId !== source.id && (
                                  <button type="button" onClick={() => startSourceEdit(source)}>
                                    编辑
                                  </button>
                                )}
                                {source.canDelete && (
                                  pendingSourceDeleteId === source.id ? (
                                    <>
                                      <button type="button" onClick={() => deleteSource(source.id)}>
                                        确认移除
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPendingSourceDeleteId("");
                                          setSourceSuccess(
                                            `已取消移除来源说明：${formatFeedbackSnippet(source.label)}。`,
                                          );
                                        }}
                                      >
                                        取消
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPendingSourceDeleteId(source.id);
                                        setEditingSourceId("");
                                        setEditingSourceDraft("");
                                        setSourceError("");
                                        setSourceSuccess("");
                                      }}
                                    >
                                      移除
                                    </button>
                                  )
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <form className="source-form" onSubmit={submitSourceForm}>
                    <input
                      ref={sourceInputRef}
                      value={sourceDraft}
                      onChange={(event) => {
                        setSourceDraft(event.target.value);
                        setSourceError("");
                        setSourceSuccess("");
                      }}
                      aria-label="来源说明"
                      placeholder="补充来源说明，例如：来自护照扫描件或旅行资料夹"
                    />
                    <button type="submit">补充来源</button>
                    {sourceError && <span>{sourceError}</span>}
                    {sourceSuccess && (
                      <span className="source-form-success" role="status">
                        {sourceSuccess}
                      </span>
                    )}
                  </form>
                </InfoBlock>
              </>
            )}

            {activeTab === "属性" && (
              <>
                <InfoBlock title={`摘要建议（${summarySuggestions.length}）`}>
                  <div className="suggestion-list">
                    {summarySuggestionSuccess && (
                      <span className="suggestion-success" role="status">
                        {summarySuggestionSuccess}
                      </span>
                    )}
                    {summarySuggestions.length === 0 ? (
                      <p>暂无摘要建议。</p>
                    ) : (
                      summarySuggestions.map((suggestion) => {
                        const isEditingSuggestion = editingSummarySuggestionId === suggestion.id;

                        return (
                          <article key={suggestion.id}>
                            <div>
                              <strong>{suggestion.summary}</strong>
                              <span>{suggestion.reason} · {suggestion.privacyImpact}</span>
                              <p>{suggestion.evidence}</p>
                            </div>
                            {isEditingSuggestion ? (
                              <form
                                className="suggestion-edit-form"
                                onSubmit={(event) => submitSummarySuggestionEdit(event, suggestion.id)}
                              >
                                <label className="suggestion-edit-evidence">
                                  <span>摘要内容</span>
                                  <textarea
                                    value={summarySuggestionForm.summary}
                                    onChange={(event) =>
                                      updateSummarySuggestionForm({ summary: event.target.value })
                                    }
                                    aria-label="摘要内容"
                                    rows={3}
                                    required
                                  />
                                </label>
                                {summarySuggestionError && (
                                  <span className="suggestion-edit-error">{summarySuggestionError}</span>
                                )}
                                <div className="suggestion-actions">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSummarySuggestionId("");
                                      setSummarySuggestionForm(defaultSummarySuggestionForm);
                                      setSummarySuggestionError("");
                                    }}
                                  >
                                    取消修改
                                  </button>
                                  <button type="submit">确认修改</button>
                                </div>
                              </form>
                            ) : (
                              <div className="suggestion-actions">
                                <button
                                  type="button"
                                  onClick={() => startSummarySuggestionEdit(suggestion)}
                                >
                                  修改
                                </button>
                                <button
                                  type="button"
                                  onClick={() => rejectSummarySuggestion(suggestion.id)}
                                >
                                  拒绝
                                </button>
                                <button
                                  type="button"
                                  onClick={() => confirmSummarySuggestion(suggestion.id)}
                                >
                                  确认
                                </button>
                              </div>
                            )}
                          </article>
                        );
                      })
                    )}
                  </div>
                </InfoBlock>
                <InfoBlock title="Markdown 内容">
                  <textarea
                    ref={markdownEditorRef}
                    value={activeNode.preview}
                    onChange={(event) => {
                      updateActive({ preview: event.target.value });
                      setMarkdownSaveStatus("Markdown 已自动保存到本地。");
                    }}
                    aria-label="Markdown 内容"
                    rows={14}
                  />
                  {markdownSaveStatus && (
                    <span className="markdown-save-status" role="status">
                      {markdownSaveStatus}
                    </span>
                  )}
                </InfoBlock>
              </>
            )}

            {activeTab === "关系" && (
              <InfoBlock title="关系说明">
                {detailViewModel.relationships.length === 0 ? (
                  <div className="relationship-empty">
                    <span>暂无关系，可建立与其他资料的联系。</span>
                    <button type="button" onClick={startRelationshipCreate}>
                      建立关系
                    </button>
                  </div>
                ) : (
                  <div className="relationship-list">
                    {detailViewModel.relationships.map((relationship) => (
                    <div
                      key={relationship.id}
                      className={relationship.targetMissing ? "missing" : ""}
                      title={relationship.statusDescription}
                    >
                      <strong>{relationship.targetTitle}</strong>
                      <span>
                        {relationship.relation}
                        {relationship.targetMissing ? ` · ${relationship.statusLabel}` : ""}
                        {` · ${relationship.sourceAuditLabel}`}
                      </span>
                      <em>{relationship.sourceAuditDescription}</em>
                      <em>{relationship.sourcePermissionSummary} · {relationship.sourcePermissionReason}</em>
                    </div>
                    ))}
                  </div>
                )}
              </InfoBlock>
            )}

            {activeTab === "历史" && (
              <InfoBlock title="变更历史">
                {detailViewModel.historyItems.map((item) => (
                  <div className="history-item" key={item.id}>
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                    <em>{item.description}</em>
                  </div>
                ))}
              </InfoBlock>
            )}

            <InfoBlock title="内容预览">
              <pre>{activeNode.preview}</pre>
            </InfoBlock>
          </aside>
        </div>
        )}
        <nav className="mobile-bottom-nav" aria-label="移动端主导航">
          <button
            type="button"
            className={mobileSection === "home" ? "active" : ""}
            aria-current={mobileSection === "home" ? "page" : undefined}
            onClick={() => activateMobileSection("home")}
          >
            首页
          </button>
          <button
            type="button"
            className={mobileSection === "graph" ? "active" : ""}
            aria-current={mobileSection === "graph" ? "page" : undefined}
            onClick={() => activateMobileSection("graph")}
          >
            关系图
          </button>
          <button
            type="button"
            className={mobileSection === "detail" ? "active" : ""}
            aria-current={mobileSection === "detail" ? "page" : undefined}
            onClick={() => activateMobileSection("detail")}
          >
            详情
          </button>
          <button
            type="button"
            className={mobileSection === "inbox" ? "active" : ""}
            aria-current={mobileSection === "inbox" ? "page" : undefined}
            onClick={() => activateMobileSection("inbox")}
          >
            收集箱
            {inboxViewModel.pendingCount > 0 && <span>{inboxViewModel.pendingCount}</span>}
          </button>
          <button
            type="button"
            className={mobileSection === "settings" ? "active" : ""}
            aria-current={mobileSection === "settings" ? "page" : undefined}
            onClick={() => activateMobileSection("settings")}
          >
            设置
          </button>
        </nav>
      </section>
    </main>
  );
}

function SectionTitle({
  label,
  detail = "",
  detailTone = "",
  actionLabel,
  actionAriaLabel,
  onAction,
}) {
  return (
    <div className="section-title">
      <span>{label}</span>
      {detail && (
        <small className={["section-title-detail", detailTone].filter(Boolean).join(" ")}>
          {detail}
        </small>
      )}
      {onAction && (
        <button type="button" aria-label={actionAriaLabel} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function InfoBlock({ title, children, blockRef }) {
  return (
    <section className="info-block" ref={blockRef}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }) {
  return (
    <div className="field-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SettingsView({
  viewModel,
  backupState,
  backfillState,
  attachmentDirectoryState,
  remoteAttachmentState,
  cloudSyncState,
  relationshipTemplates,
  relationshipTemplateDraft,
  relationshipTemplateError,
  relationshipTemplateSuccess,
  pendingDirectoryClear,
  pendingRemoteConfigClear,
  pendingCloudSyncClear,
  pendingCloudSnapshotPush,
  onOpenInbox,
  onRequestResetLayout,
  onCancelResetLayout,
  onConfirmResetLayout,
  layoutResetPending,
  layoutSaveStatus,
  onResetStore,
  settingsResetPending,
  resetSuccess,
  onCancelSettingsReset,
  onConfirmSettingsReset,
  onExportBackup,
  onPreviewBackupImport,
  onPreviewEncryptedBackupImport,
  onCancelBackupRestore,
  onConfirmBackupRestore,
  backupEncryptionState,
  onUpdateBackupEncryptionState,
  onChooseAttachmentDirectory,
  onReauthorizeAttachmentDirectory,
  onRequestClearAttachmentDirectory,
  onCancelClearAttachmentDirectory,
  onConfirmClearAttachmentDirectory,
  onUpdateRemoteAttachmentField,
  onSaveRemoteAttachmentConfig,
  onRequestClearRemoteAttachmentConfig,
  onCancelClearRemoteAttachmentConfig,
  onConfirmClearRemoteAttachmentConfig,
  onBackfillHistoricalLargeFiles,
  onUpdateCloudSyncField,
  onSaveCloudSyncSettings,
  onTestCloudSyncConnection,
  onRequestCloudSnapshotPush,
  onCancelCloudSnapshotPush,
  onConfirmCloudSnapshotPush,
  onPullCloudSnapshotPreview,
  onRequestClearCloudSync,
  onCancelClearCloudSync,
  onConfirmClearCloudSync,
  onUpdateRelationshipTemplateDraft,
  onSaveRelationshipTemplate,
  onRemoveRelationshipTemplate,
  onRestoreRelationshipTemplates,
}) {
  const fileSystemCapability = viewModel.storageCapabilities.find(
    (capability) => capability.id === "file-system",
  );
  const backendCapability = viewModel.storageCapabilities.find(
    (capability) => capability.id === "backend-sync",
  );

  return (
    <section className="settings-view">
      <div className="settings-header">
        <div>
          <h1>设置</h1>
          <span>{viewModel.storageAdapter} · schema {viewModel.schemaVersion}</span>
        </div>
        <div className="settings-actions">
          <button type="button" onClick={onOpenInbox}>收集箱</button>
          {layoutResetPending ? (
            <div className="settings-clear-confirmation" aria-live="polite">
              <span>确认恢复默认布局？</span>
              <button type="button" onClick={onCancelResetLayout}>取消</button>
              <button type="button" onClick={onConfirmResetLayout}>确认恢复</button>
            </div>
          ) : (
            <button type="button" onClick={onRequestResetLayout}>恢复布局</button>
          )}
          {layoutSaveStatus && (
            <span className="settings-layout-status" role="status">
              {layoutSaveStatus}
            </span>
          )}
          {settingsResetPending ? (
            <div className="settings-reset-confirmation" aria-live="polite">
              <span>确认重置资料库？</span>
              <button type="button" onClick={onCancelSettingsReset}>取消</button>
              <button type="button" onClick={onConfirmSettingsReset}>确认重置</button>
            </div>
          ) : (
            <button type="button" onClick={onResetStore}>重置资料</button>
          )}
          {resetSuccess && (
            <span className="settings-reset-success" role="status">
              {resetSuccess}
            </span>
          )}
        </div>
      </div>

      <section className="settings-section">
        <h2>本地数据</h2>
        <div className="settings-metrics">
          {viewModel.localData.map((item) => (
            <div key={item.id}>
              <strong>{item.count}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2>隐私分布</h2>
        <div className="privacy-summary">
          {viewModel.privacySummary.map((item) => (
            <div key={item.privacyLevel}>
              <strong>{item.label}</strong>
              <span>{item.count} 份资料 · {item.aiDefault}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2>发布准备度</h2>
        <div className="release-readiness">
          <strong>{viewModel.releaseReadiness.summary}</strong>
          <div className="release-info" aria-label="发布信息">
            <span>版本 {viewModel.releaseInfo.version}</span>
            <span>{viewModel.releaseInfo.buildType}</span>
            <span>{viewModel.releaseInfo.dataMode}</span>
          </div>
          <div>
            {viewModel.releaseReadiness.checks.map((check) => (
              <span className={check.passed ? "passed" : "pending"} key={check.id}>
                {check.statusLabel} · {check.group} · {check.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>关系模板</h2>
        <div className="relationship-template-panel">
          <div>
            <strong>{relationshipTemplates.length} 个模板词</strong>
            <span>只作为新增/编辑关系时的输入提示，不会修改已有关系。</span>
          </div>
          <div className="relationship-template-chips" aria-label="关系模板词">
            {relationshipTemplates.map((template) => (
              <span className="relationship-template-chip" key={template}>
                {template}
                <button
                  type="button"
                  aria-label={`移除关系模板 ${template}`}
                  onClick={() => onRemoveRelationshipTemplate(template)}
                >
                  移除
                </button>
              </span>
            ))}
          </div>
          <div className="relationship-template-form">
            <label>
              <span>新增模板词</span>
              <input
                value={relationshipTemplateDraft}
                onChange={(event) => onUpdateRelationshipTemplateDraft(event.target.value)}
                placeholder="例如：复诊资料"
                aria-label="新增关系模板"
              />
            </label>
            <button type="button" onClick={onSaveRelationshipTemplate}>保存模板</button>
            <button type="button" onClick={onRestoreRelationshipTemplates}>恢复默认模板</button>
          </div>
          {relationshipTemplateError && (
            <p className="backup-message error">{relationshipTemplateError}</p>
          )}
          {relationshipTemplateSuccess && (
            <p className="backup-message success">{relationshipTemplateSuccess}</p>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h2>存储</h2>
        <div className="settings-facts">
          <Field label="Store" value={viewModel.storeVersion} />
          <Field label="更新时间" value={viewModel.updatedAt} />
        </div>
        <div className="storage-capabilities" aria-label="存储能力">
          {viewModel.storageCapabilities.map((capability) => (
            <article
              className={capability.configured ? "configured" : "pending"}
              key={capability.id}
            >
              <div>
                <strong>{capability.label}</strong>
                <span>{capability.statusLabel}</span>
              </div>
              <p>{capability.description}</p>
            </article>
          ))}
        </div>
        <div className="file-system-panel">
          <div>
            <strong>本地附件目录</strong>
            <span>
              {fileSystemCapability?.statusLabel || "未启用"} · 只保存到本机，不会自动云同步
            </span>
          </div>
          <div className="backup-actions">
            <button
              type="button"
              disabled={!attachmentDirectoryState.supported}
              onClick={onChooseAttachmentDirectory}
            >
              选择附件目录
            </button>
            <button
              type="button"
              disabled={!attachmentDirectoryState.directoryHandle}
              onClick={onReauthorizeAttachmentDirectory}
            >
              重新授权
            </button>
            {pendingDirectoryClear ? (
              <div className="settings-clear-confirmation" aria-live="polite">
                <span>确认清除目录授权？</span>
                <button type="button" onClick={onCancelClearAttachmentDirectory}>取消</button>
                <button type="button" onClick={onConfirmClearAttachmentDirectory}>
                  确认清除
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!attachmentDirectoryState.directoryHandle}
                onClick={onRequestClearAttachmentDirectory}
              >
                清除目录授权
              </button>
            )}
          </div>
          {attachmentDirectoryState.error && (
            <p className="backup-message error">{attachmentDirectoryState.error}</p>
          )}
          {attachmentDirectoryState.success && (
            <p className="backup-message success">{attachmentDirectoryState.success}</p>
          )}
        </div>
        <div className="remote-sync-panel">
          <div>
            <strong>后端附件上传</strong>
            <span>
              {backendCapability?.statusLabel || "未配置"} · 可选客户端 endpoint，不提供真实后端服务
            </span>
          </div>
          <div className="remote-sync-form">
            <label>
              <span>Endpoint</span>
              <input
                value={remoteAttachmentState.endpoint}
                onChange={(event) => onUpdateRemoteAttachmentField("endpoint", event.target.value)}
                placeholder="https://example.test/upload"
                aria-label="后端上传 endpoint"
              />
            </label>
            <label>
              <span>Token</span>
              <input
                value={remoteAttachmentState.token}
                onChange={(event) => onUpdateRemoteAttachmentField("token", event.target.value)}
                placeholder="可选"
                aria-label="后端上传 token"
              />
            </label>
          </div>
          <div className="backup-actions">
            <button type="button" onClick={onSaveRemoteAttachmentConfig}>保存后端配置</button>
            {pendingRemoteConfigClear ? (
              <div className="settings-clear-confirmation" aria-live="polite">
                <span>确认清除后端配置？</span>
                <button type="button" onClick={onCancelClearRemoteAttachmentConfig}>取消</button>
                <button type="button" onClick={onConfirmClearRemoteAttachmentConfig}>
                  确认清除
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!remoteAttachmentState.endpoint}
                onClick={onRequestClearRemoteAttachmentConfig}
              >
                清除后端配置
              </button>
            )}
          </div>
          {remoteAttachmentState.error && (
            <p className="backup-message error">{remoteAttachmentState.error}</p>
          )}
          {remoteAttachmentState.success && (
            <p className="backup-message success">{remoteAttachmentState.success}</p>
          )}
        </div>
        <div className="remote-sync-panel">
          <div>
            <strong>云同步</strong>
            <span>
              {viewModel.cloudSyncSummary.statusLabel} · 手动快照客户端，不自动上传或合并
            </span>
          </div>
          <p className="cloud-sync-note">{viewModel.cloudSyncSummary.description}</p>
          <div className="remote-sync-form">
            <label>
              <span>Endpoint</span>
              <input
                value={cloudSyncState.endpoint}
                onChange={(event) => onUpdateCloudSyncField("endpoint", event.target.value)}
                placeholder="https://example.test/sync"
                aria-label="云同步 endpoint"
              />
            </label>
            <label>
              <span>Access token</span>
              <input
                value={cloudSyncState.token}
                onChange={(event) => onUpdateCloudSyncField("token", event.target.value)}
                placeholder="可选"
                aria-label="云同步 token"
              />
            </label>
          </div>
          <div className="backup-actions">
            <button type="button" onClick={onSaveCloudSyncSettings}>保存云同步配置</button>
            <button
              type="button"
              disabled={!cloudSyncState.endpoint}
              onClick={onTestCloudSyncConnection}
            >
              测试连接
            </button>
            {pendingCloudSnapshotPush ? (
              <div className="settings-clear-confirmation" aria-live="polite">
                <span>确认推送当前资料库快照？</span>
                <button type="button" onClick={onCancelCloudSnapshotPush}>取消</button>
                <button type="button" onClick={onConfirmCloudSnapshotPush}>确认推送</button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!cloudSyncState.endpoint}
                onClick={onRequestCloudSnapshotPush}
              >
                推送当前资料库快照
              </button>
            )}
            <button
              type="button"
              disabled={!cloudSyncState.endpoint}
              onClick={onPullCloudSnapshotPreview}
            >
              检查远端快照
            </button>
            {pendingCloudSyncClear ? (
              <div className="settings-clear-confirmation" aria-live="polite">
                <span>确认清除云同步配置？</span>
                <button type="button" onClick={onCancelClearCloudSync}>取消</button>
                <button type="button" onClick={onConfirmClearCloudSync}>确认清除</button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!cloudSyncState.endpoint}
                onClick={onRequestClearCloudSync}
              >
                清除云同步配置
              </button>
            )}
          </div>
          {cloudSyncState.latestSnapshot && (
            <CloudSnapshotPreview snapshot={cloudSyncState.latestSnapshot} />
          )}
          {cloudSyncState.error && (
            <p className="backup-message error">{cloudSyncState.error}</p>
          )}
          {cloudSyncState.success && (
            <p className="backup-message success">{cloudSyncState.success}</p>
          )}
        </div>
        <div className="large-file-summary" aria-label="大文件长期保存">
          <strong>大文件长期保存</strong>
          <span>{viewModel.largeFileStorageSummary.label}</span>
          <p>{viewModel.largeFileStorageSummary.description}</p>
          <label className="backfill-file-picker">
            补拷贝历史大文件
            <input
              type="file"
              multiple
              aria-label="选择历史大文件补拷贝"
              onChange={(event) => {
                void onBackfillHistoricalLargeFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
          {backfillState.error && <p className="backup-message error">{backfillState.error}</p>}
          {backfillState.success && <p className="backup-message success">{backfillState.success}</p>}
        </div>
        <div className="backup-panel">
          <div>
            <strong>本地备份包</strong>
            <span>导出资料库和 IndexedDB 附件副本；可选择本地明文 JSON 或密码加密备份。</span>
          </div>
          <label className="backup-encryption-toggle">
            <input
              type="checkbox"
              checked={backupEncryptionState.exportEncrypted}
              onChange={(event) =>
                onUpdateBackupEncryptionState({
                  exportEncrypted: event.target.checked,
                  exportPassword: event.target.checked ? backupEncryptionState.exportPassword : "",
                })
              }
            />
            <span>加密导出</span>
          </label>
          {backupEncryptionState.exportEncrypted && (
            <label className="backup-password-field">
              <span>备份密码</span>
              <input
                type="password"
                value={backupEncryptionState.exportPassword}
                onChange={(event) =>
                  onUpdateBackupEncryptionState({ exportPassword: event.target.value })
                }
                placeholder="导出后请自行保存密码"
                autoComplete="new-password"
              />
            </label>
          )}
          <div className="backup-actions">
            <button type="button" onClick={onExportBackup}>导出备份</button>
            <label>
              导入备份
              <input
                type="file"
                accept=".json,application/json"
                aria-label="导入备份文件"
                onChange={(event) => {
                  void onPreviewBackupImport(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          {backupState.needsPassword && (
            <div className="backup-restore-card" aria-live="polite">
              <strong>解密这个备份？</strong>
              <span>
                {backupState.encryptedImportFileName || "加密备份"} 需要备份密码，解密成功后才会显示恢复确认。
              </span>
              <label className="backup-password-field">
                <span>备份密码</span>
                <input
                  type="password"
                  value={backupEncryptionState.importPassword}
                  onChange={(event) =>
                    onUpdateBackupEncryptionState({ importPassword: event.target.value })
                  }
                  placeholder="输入导出时设置的密码"
                  autoComplete="current-password"
                />
              </label>
              <div>
                <button type="button" onClick={onCancelBackupRestore}>取消</button>
                <button type="button" onClick={onPreviewEncryptedBackupImport}>解密并预览</button>
              </div>
              <small>这是本地文件加密，不是云同步；密码无法找回。</small>
            </div>
          )}
          {backupState.summary && (
            <div className="backup-restore-card" aria-live="polite">
              <strong>确认恢复这个备份？</strong>
              <span>
                导出时间 {backupState.summary.exportedAt} · {backupState.summary.entityCount} 份资料 ·{" "}
                {backupState.summary.relationshipCount} 条关系 ·{" "}
                {backupState.summary.attachmentCount} 个附件索引 ·{" "}
                {backupState.summary.attachmentCopyCount} 个附件副本
              </span>
              <small>确认后会覆盖当前资料库和附件副本，不会合并。</small>
              <div>
                <button type="button" onClick={onCancelBackupRestore}>取消</button>
                <button type="button" onClick={onConfirmBackupRestore}>确认恢复</button>
              </div>
            </div>
          )}
          {backupState.error && <p className="backup-message error">{backupState.error}</p>}
          {backupState.success && <p className="backup-message success">{backupState.success}</p>}
        </div>
      </section>
    </section>
  );
}

function getPositionFromPointer(event, drag) {
  const pan = drag.pan || { x: 0, y: 0 };
  return {
    x: clampGraphCoordinate(
      ((event.clientX - drag.rect.left - drag.offsetX - pan.x) / drag.rect.width) * 100,
    ),
    y: clampGraphCoordinate(
      ((event.clientY - drag.rect.top - drag.offsetY - pan.y) / drag.rect.height) * 100,
    ),
  };
}

function clampGraphCoordinate(value) {
  return Math.min(Math.max(value, 0), 100);
}

function capturePointer(target, pointerId) {
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // Synthetic pointer events used by smoke tests do not always create a capturable pointer.
  }
}

function releasePointer(target, pointerId) {
  if (!target.hasPointerCapture?.(pointerId)) return;
  target.releasePointerCapture(pointerId);
}

function createPinchState(pointers, zoom) {
  if (pointers.size < 2) return null;

  const [first, second] = Array.from(pointers.values());

  return {
    startDistance: getPointerDistance(first, second),
    startZoom: zoom,
  };
}

function createPanState(pointers, graphPan) {
  if (pointers.size !== 1) return null;
  const [pointer] = Array.from(pointers.values());

  return {
    startPointer: pointer,
    startPan: graphPan,
    currentPan: graphPan,
    samples: [{ ...pointer, time: performance.now() }],
  };
}

function addPanSample(panState, pointer, timestamp, currentPan) {
  const time = Number.isFinite(timestamp) ? timestamp : performance.now();
  const samples = [...(panState.samples || []), { ...pointer, time }].slice(-5);

  return {
    ...panState,
    currentPan,
    samples,
  };
}

function getPanVelocity(samples) {
  if (samples.length < 2) return null;

  const last = samples[samples.length - 1];
  const first = [...samples].reverse().find((sample) => last.time - sample.time >= 16) ||
    samples[0];
  const delta = Math.max(last.time - first.time, 1);
  const velocity = {
    x: (last.x - first.x) / delta,
    y: (last.y - first.y) / delta,
  };

  return Math.hypot(velocity.x, velocity.y) >= 0.35 ? velocity : null;
}

function getPanDisplacementVelocity(panState) {
  if (!panState?.currentPan || !panState?.startPan) return null;

  const dx = panState.currentPan.x - panState.startPan.x;
  const dy = panState.currentPan.y - panState.startPan.y;
  if (Math.hypot(dx, dy) < 18) return null;

  return {
    x: dx / 80,
    y: dy / 80,
  };
}

function getPointerDistance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function clampZoom(value) {
  return Math.min(Math.max(value, 70), 140);
}

function clampGraphPan(value) {
  return Math.min(Math.max(value, -160), 160);
}

function AiContextPreview({ viewModel, scoped }) {
  return (
    <section className="ai-context-preview" aria-label="AI 安全状态">
      <div className="ai-context-head">
        <div>
          <h2>AI 安全状态</h2>
          <span>
            {scoped ? "当前搜索范围" : "全库范围"} · {viewModel.includedCount} 条可见 ·{" "}
            {viewModel.excludedCount} 条已排除
          </span>
        </div>
        <div className="ai-context-metrics" aria-label="AI 上下文数量">
          <strong>{viewModel.includedCount}</strong>
          <span>可见</span>
          <strong>{viewModel.excludedCount}</strong>
          <span>已排除</span>
        </div>
      </div>

      <div className="ai-context-body">
        <div className="ai-context-list">
          {viewModel.hasUsableContext ? (
            viewModel.includedEntities.slice(0, 2).map((entity) => (
              <article key={entity.id}>
                <strong>{entity.title}</strong>
                <span>{entity.type} · {entity.privacyLabel} · {entity.aiLabel}</span>
              </article>
            ))
          ) : (
            <div className="ai-context-empty">当前没有资料会进入 AI 预留上下文。</div>
          )}
        </div>

        <div className="ai-exclusion-list">
          {viewModel.excludedSummary.map((item) => (
            <div key={item.reason}>
              <strong>{item.count}</strong>
              <span>{item.reason}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CitedAnswerPanel({ draft, question, scoped, onQuestionChange, onSubmit }) {
  return (
    <section className="cited-answer-panel" aria-label="引用式 AI 问答">
      <details className="cited-answer-disclosure">
        <summary>
          <span>引用式问答</span>
          <small>{scoped ? "当前搜索范围" : "全库可见上下文"} · 需要来源</small>
        </summary>

        <form className="cited-answer-form" onSubmit={onSubmit}>
          <input
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            placeholder="输入一个需要引用依据的问题"
          />
          <button type="submit">生成引用草案</button>
        </form>

        {draft ? (
          <div className={draft.status === "ready" ? "answer-draft ready" : "answer-draft empty"}>
            <strong>{draft.answerDraft}</strong>
            {draft.citations.length > 0 && (
              <div className="citation-list">
                {draft.citations.map((citation) => (
                  <article key={citation.id}>
                    <div>
                      <strong>{citation.title}</strong>
                      <span>{citation.sourceTitle} · {citation.privacyState}</span>
                    </div>
                    <p>{citation.snippet}</p>
                    <small>{citation.relationshipPath}</small>
                  </article>
                ))}
              </div>
            )}
            {draft.excludedSummary.length > 0 && (
              <div className="answer-exclusions">
                {draft.excludedSummary.map((item) => (
                  <span key={item.reason}>{item.count} 条：{item.reason}</span>
                ))}
              </div>
            )}
            {draft.suggestedActions.length > 0 && (
              <div className="answer-actions">
                {draft.suggestedActions.map((action) => (
                  <span key={action}>{action}</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="answer-draft empty">
            <strong>等待问题</strong>
            <span>回答草案必须包含来源；没有来源时不会编造。</span>
          </div>
        )}
      </details>
    </section>
  );
}

function SearchResults({ viewModel, onOpenEntity, onAdd }) {
  if (viewModel.hasNoResults) {
    return (
      <section className="search-results empty" aria-label="搜索结果">
        <div>
          <h2>没有找到相关资料</h2>
          <span>可以换个关键词，或先把线索放进收集箱。</span>
        </div>
        <button type="button" onClick={onAdd}>新增资料</button>
      </section>
    );
  }

  return (
    <section className="search-results" aria-label="搜索结果">
      <div className="search-results-head">
        <div>
          <h2>搜索结果</h2>
          <span>{viewModel.totalResults} 条匹配，图谱已同步过滤</span>
        </div>
      </div>

      <SearchGroup title="资料" count={viewModel.entityResults.length}>
        {viewModel.entityResults.map((result) => (
          <button type="button" key={result.id} onClick={() => onOpenEntity(result.id)}>
            <strong>{result.title}</strong>
            <span>{result.type} · {result.privacyLabel} · {result.matchReason}</span>
          </button>
        ))}
      </SearchGroup>

      <SearchGroup title="附件" count={viewModel.attachmentResults.length}>
        {viewModel.attachmentResults.map((result) => (
          <button type="button" key={result.id} onClick={() => onOpenEntity(result.entityId)}>
            <strong>{result.name}</strong>
            <span>{result.entityTitle} · {result.size} · {result.privacyLabel}</span>
          </button>
        ))}
      </SearchGroup>

      <SearchGroup title="来源" count={viewModel.sourceResults.length}>
        {viewModel.sourceResults.map((result) => (
          <button type="button" key={result.id} onClick={() => onOpenEntity(result.entityId)}>
            <strong>{result.label}</strong>
            <span>{result.entityTitle} · {result.kind} · {result.privacyLabel}</span>
          </button>
        ))}
      </SearchGroup>

      <SearchGroup title="关系" count={viewModel.relationshipResults.length}>
        {viewModel.relationshipResults.map((result) => (
          <button type="button" key={result.id} onClick={() => onOpenEntity(result.toId)}>
            <strong>{`${result.fromTitle} -> ${result.toTitle}`}</strong>
            <span>{result.label}</span>
          </button>
        ))}
      </SearchGroup>
    </section>
  );
}

function CloudSnapshotPreview({ snapshot }) {
  const diff = snapshot.diff;

  return (
    <div className="cloud-snapshot-preview" aria-label="远端快照预览">
      <strong>远端快照预览</strong>
      <span>
        {snapshot.snapshotId} · {snapshot.summary.entityCount} 份资料 ·{" "}
        {snapshot.summary.relationshipCount} 条关系 · {snapshot.summary.attachmentCount} 个附件索引
      </span>
      {diff && (
        <div className="cloud-diff-list" aria-label="远端快照差异">
          <span>本地 {diff.localEntityCount} 份资料 · 远端 {diff.remoteEntityCount} 份资料</span>
          {diff.mode === "store-diff" && (
            <>
              <span>远端新增：{formatFeedbackList(diff.addedRemoteTitles, 3, 24) || "0"}</span>
              <span>本地独有：{formatFeedbackList(diff.missingRemoteTitles, 3, 24) || "0"}</span>
              <span>可能冲突：{formatFeedbackList(diff.possibleConflictTitles, 3, 24) || "0"}</span>
            </>
          )}
          <small>{diff.warningLabel}</small>
        </div>
      )}
      <small>这里只预览差异，不会覆盖当前本地资料库。</small>
    </div>
  );
}

function formatFeedbackSnippet(value, maxLength = 32) {
  const text = String(value || "").trim();

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function formatFeedbackList(values = [], maxItems = 2, maxItemLength = 48) {
  const items = values.filter(Boolean).map((value) => formatFeedbackSnippet(value, maxItemLength));

  if (items.length <= maxItems) return items.join("、");

  return `${items.slice(0, maxItems).join("、")} 等 ${items.length} 个`;
}

function SearchGroup({ title, count, children }) {
  if (count === 0) return null;

  return (
    <div className="search-group">
      <h3>{title}<span>{count}</span></h3>
      <div>{children}</div>
    </div>
  );
}

function drawGraph(ctx, width, height, edges, activeId, zoom, pan = { x: 0, y: 0 }) {
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 1;
  edges.forEach((edge) => {
    const x1 = (edge.from.x / 100) * width + pan.x;
    const y1 = (edge.from.y / 100) * height + pan.y;
    const x2 = (edge.to.x / 100) * width + pan.x;
    const y2 = (edge.to.y / 100) * height + pan.y;
    const active = edge.fromId === activeId || edge.toId === activeId;
    ctx.strokeStyle = active ? "rgba(157, 107, 255, .78)" : "rgba(180, 186, 206, .10)";
    ctx.setLineDash(edge.label.includes("相关") || edge.label.includes("计划") ? [4, 5] : []);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (active && zoom >= 90) {
      ctx.fillStyle = "rgba(220, 222, 232, .72)";
      ctx.font = "12px Inter, system-ui, sans-serif";
      ctx.fillText(edge.label, (x1 + x2) / 2 + 8, (y1 + y2) / 2 - 8);
    }
  });
}
