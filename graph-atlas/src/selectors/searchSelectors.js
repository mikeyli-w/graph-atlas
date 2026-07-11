import { getPrivacyLabel } from "../domain/privacy.js";

const ALL_TAGS = "全部";
const ALL_PRIVACY = "全部隐私";

export function selectSearchViewModel(store, filters) {
  const query = filters.query?.trim().toLowerCase() || "";
  const tagFilter = filters.tagFilter || ALL_TAGS;
  const privacyFilter = filters.privacyFilter || ALL_PRIVACY;
  const entityById = new Map(store.entities.map((entity) => [entity.id, entity]));
  const sourceByEdgeId = new Map(
    store.sources
      .filter((source) => source.targetType === "edge" && source.targetId)
      .map((source) => [source.targetId, source]),
  );
  const documentsByEntityId = new Map(
    store.documents.map((document) => [document.entityId, document]),
  );

  const entityResults = [];
  const visibleEntityIds = new Set();

  for (const entity of store.entities) {
    if (!passesEntityFilters(entity, tagFilter, privacyFilter)) continue;

    const document = documentsByEntityId.get(entity.id);
    const matches = !query || includesQuery(
      [
        entity.title,
        entity.type,
        entity.tags.join(" "),
        document?.title,
        document?.body,
      ],
      query,
    );

    if (matches) {
      visibleEntityIds.add(entity.id);
      if (query) {
        entityResults.push({
          id: entity.id,
          title: entity.title,
          type: entity.type,
          privacyLabel: getPrivacyLabel(entity.privacyLevel),
          matchReason: document?.body?.toLowerCase().includes(query) ? "内容命中" : "资料命中",
        });
      }
    }
  }

  const attachmentResults = query
    ? store.attachments
        .map((attachment) => ({
          attachment,
          entity: entityById.get(attachment.entityId),
        }))
        .filter(({ attachment, entity }) =>
          entity &&
          passesEntityFilters(entity, tagFilter, privacyFilter) &&
          includesQuery(
            [
              attachment.name,
              attachment.size,
              attachment.date,
              attachment.reference,
              attachment.localCopy?.contentHash,
              attachment.localCopy?.textPreview,
              entity.title,
            ],
            query,
          ),
        )
        .map(({ attachment, entity }) => {
          visibleEntityIds.add(entity.id);
          return {
            id: attachment.id,
            name: attachment.name,
            size: attachment.size,
            date: attachment.date,
            reference: attachment.reference || "",
            entityId: entity.id,
            entityTitle: entity.title,
            privacyLabel: getPrivacyLabel(entity.privacyLevel),
          };
        })
    : [];

  const sourceResults = query
    ? store.sources
        .map((source) => ({
          source,
          entity: source.targetType === "entity" ? entityById.get(source.targetId) : null,
        }))
        .filter(({ source, entity }) =>
          entity &&
          passesEntityFilters(entity, tagFilter, privacyFilter) &&
          includesQuery([source.label, source.kind, entity.title], query),
        )
        .map(({ source, entity }) => {
          visibleEntityIds.add(entity.id);
          return {
            id: source.id,
            label: source.label || "手动创建",
            kind: source.kind || "manual",
            entityId: entity.id,
            entityTitle: entity.title,
            privacyLabel: getPrivacyLabel(entity.privacyLevel),
          };
        })
    : [];

  const relationshipResults = query
    ? store.edges
        .map((edge) => ({
          edge,
          source: sourceByEdgeId.get(edge.id),
          from: entityById.get(edge.fromId),
          to: entityById.get(edge.toId),
        }))
        .filter(({ edge, source, from, to }) =>
          from &&
          to &&
          passesRelationshipFilters(from, to, tagFilter, privacyFilter) &&
          includesQuery(
            [
              edge.label,
              edge.relationType,
              edge.evidence,
              source?.label,
              source?.kind,
              source?.evidence,
              from.title,
              to.title,
            ],
            query,
          ),
        )
        .map(({ edge, source, from, to }) => {
          visibleEntityIds.add(from.id);
          visibleEntityIds.add(to.id);
          return {
            id: edge.id,
            fromId: from.id,
            fromTitle: from.title,
            toId: to.id,
            toTitle: to.title,
            label: edge.label,
            sourceLabel: source?.label || "",
          };
        })
    : [];

  const totalResults =
    entityResults.length +
    attachmentResults.length +
    sourceResults.length +
    relationshipResults.length;

  return {
    query,
    tagFilter,
    privacyFilter,
    hasActiveQuery: Boolean(query),
    hasNoResults: Boolean(query) && totalResults === 0,
    visibleEntityIds: Array.from(visibleEntityIds),
    entityResults,
    attachmentResults,
    sourceResults,
    relationshipResults,
    totalResults,
  };
}

function passesEntityFilters(entity, tagFilter, privacyFilter) {
  const matchesTag = tagFilter === ALL_TAGS || entity.tags.includes(tagFilter);
  const matchesPrivacy = privacyFilter === ALL_PRIVACY || entity.privacyLevel === privacyFilter;
  return matchesTag && matchesPrivacy;
}

function passesRelationshipFilters(from, to, tagFilter, privacyFilter) {
  const matchesTag =
    tagFilter === ALL_TAGS || from.tags.includes(tagFilter) || to.tags.includes(tagFilter);
  const matchesPrivacy =
    privacyFilter === ALL_PRIVACY ||
    (from.privacyLevel === privacyFilter && to.privacyLevel === privacyFilter);
  return matchesTag && matchesPrivacy;
}

function includesQuery(values, query) {
  return values
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}
