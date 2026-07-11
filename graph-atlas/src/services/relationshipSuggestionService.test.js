import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectDetailViewModel } from "../selectors/detailSelectors.js";
import { selectRelationshipSuggestions } from "../selectors/relationshipSuggestionSelectors.js";
import { relationshipSuggestionService } from "./relationshipSuggestionService.js";

describe("relationshipSuggestionService", () => {
  it("confirms a relationship suggestion into the formal edge list", () => {
    const suggestion = selectRelationshipSuggestions(seedKnowledgeStore, "travel").find(
      (item) => item.toId === "contacts",
    );
    const result = relationshipSuggestionService.confirm(
      seedKnowledgeStore,
      "travel",
      suggestion.id,
    );

    expect(result.store.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromId: "travel",
          toId: "contacts",
          relationType: "紧急联系人",
          source: "suggestion",
        }),
      ]),
    );
    expect(result.store.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetType: "edge",
          targetId: "edge-travel-紧急联系人-contacts",
          kind: "suggestion",
          label: expect.stringContaining("关系依据："),
        }),
      ]),
    );
    expect(selectDetailViewModel(result.store, "travel").relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: "contacts",
          relation: "紧急联系人",
          sourceKindLabel: "AI 建议确认",
          sourcePermissionLabel: "AI 建议确认，只读",
          sourcePermissionLevel: "readonly",
          sourcePermissionActionLabel: "只读，可新增手动关系补充",
          sourcePermissionReason:
            "AI 建议确认后的关系保留原始依据，不直接编辑；需要修正时可新增手动关系补充。",
          sourcePermissionSummary: "权限：只读，可新增手动关系补充",
          sourceObjectStatusLabel: "来源对象",
          sourceAuditLabel: "AI 建议确认 · AI 建议确认，只读",
          sourceAuditRows: [
            {
              id: "source",
              label: "来源",
              value: "AI 建议确认 · 来源对象",
            },
            {
              id: "evidence",
              label: "依据",
              value: expect.stringContaining("来源说明："),
            },
            {
              id: "permission",
              label: "权限",
              value: "AI 建议确认，只读",
            },
          ],
          sourceAuditDescription: expect.stringContaining(
            "AI 建议确认 · AI 建议确认，只读 · 来源对象 · 来源说明：",
          ),
        }),
      ]),
    );
  });

  it("confirms an edited relationship suggestion with user reviewed fields", () => {
    const suggestion = selectRelationshipSuggestions(seedKnowledgeStore, "travel").find(
      (item) => item.toId === "contacts",
    );
    const result = relationshipSuggestionService.confirm(
      seedKnowledgeStore,
      "travel",
      suggestion.id,
      {
        targetId: "files",
        relationType: "包含",
        evidence: "用户确认后改为关联文件资料",
      },
    );

    expect(result.store.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "edge-travel-包含-files",
          fromId: "travel",
          toId: "files",
          relationType: "包含",
          source: "suggestion",
          evidence: "用户确认后改为关联文件资料",
        }),
      ]),
    );
    expect(result.store.auditLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "relationship-suggestion",
          suggestionId: suggestion.id,
          status: "confirmed",
          toId: "files",
          relationType: "包含",
        }),
      ]),
    );
    expect(selectDetailViewModel(result.store, "travel").relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: "files",
          relation: "包含",
          evidenceLabel: "来源说明：用户确认后改为关联文件资料",
          sourceKindLabel: "AI 建议确认",
        }),
      ]),
    );
  });

  it("rejects a suggestion without adding an edge", () => {
    const suggestion = selectRelationshipSuggestions(seedKnowledgeStore, "travel").find(
      (item) => item.toId === "contacts",
    );
    const result = relationshipSuggestionService.reject(
      seedKnowledgeStore,
      "travel",
      suggestion.id,
    );

    expect(result.store.edges).toHaveLength(seedKnowledgeStore.edges.length);
    expect(result.store.auditLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "relationship-suggestion",
          suggestionId: suggestion.id,
          status: "rejected",
        }),
      ]),
    );
    expect(selectRelationshipSuggestions(result.store, "travel")).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: suggestion.id })]),
    );
  });

  it("throws when the suggestion is not pending", () => {
    expect(() =>
      relationshipSuggestionService.confirm(seedKnowledgeStore, "travel", "missing-suggestion"),
    ).toThrow("关系建议不存在");
  });

  it("rejects invalid edited suggestion confirmation", () => {
    const suggestion = selectRelationshipSuggestions(seedKnowledgeStore, "travel").find(
      (item) => item.toId === "contacts",
    );

    expect(() =>
      relationshipSuggestionService.confirm(seedKnowledgeStore, "travel", suggestion.id, {
        targetId: "missing",
      }),
    ).toThrow("目标资料必填");
    expect(() =>
      relationshipSuggestionService.confirm(seedKnowledgeStore, "travel", suggestion.id, {
        targetId: "travel",
      }),
    ).toThrow("不能关联到当前资料");
    expect(() =>
      relationshipSuggestionService.confirm(seedKnowledgeStore, "travel", suggestion.id, {
        relationType: " ",
      }),
    ).toThrow("关系类型必填");
    expect(() =>
      relationshipSuggestionService.confirm(seedKnowledgeStore, "travel", suggestion.id, {
        targetId: "files",
        relationType: "材料",
      }),
    ).toThrow("关系已存在");
  });
});
