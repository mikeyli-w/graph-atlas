import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectTagSuggestions } from "../selectors/tagSuggestionSelectors.js";
import { tagSuggestionService } from "./tagSuggestionService.js";

describe("tagSuggestionService", () => {
  it("confirms a tag suggestion into the entity tag list", () => {
    const suggestion = selectTagSuggestions(seedKnowledgeStore, "travel").find(
      (item) => item.tag === "证件",
    );
    const result = tagSuggestionService.confirm(seedKnowledgeStore, "travel", suggestion.id);
    const updatedEntity = result.store.entities.find((entity) => entity.id === "travel");

    expect(updatedEntity.tags).toContain("证件");
    expect(updatedEntity.updated).toBe("刚刚");
    expect(result.store.auditLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "tag-suggestion",
          suggestionId: suggestion.id,
          status: "confirmed",
          entityId: "travel",
          tag: "证件",
        }),
      ]),
    );
    expect(selectTagSuggestions(result.store, "travel")).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: suggestion.id })]),
    );
  });

  it("confirms an edited tag suggestion with a reviewed label", () => {
    const suggestion = selectTagSuggestions(seedKnowledgeStore, "travel").find(
      (item) => item.tag === "证件",
    );
    const result = tagSuggestionService.confirm(seedKnowledgeStore, "travel", suggestion.id, {
      tag: "# 出行证件",
    });
    const updatedEntity = result.store.entities.find((entity) => entity.id === "travel");

    expect(updatedEntity.tags).toContain("出行证件");
    expect(updatedEntity.tags).not.toContain("证件");
    expect(result.store.auditLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "tag-suggestion",
          suggestionId: suggestion.id,
          status: "confirmed",
          entityId: "travel",
          tag: "出行证件",
        }),
      ]),
    );
    expect(selectTagSuggestions(result.store, "travel")).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: suggestion.id })]),
    );
  });

  it("rejects a tag suggestion without adding the tag", () => {
    const suggestion = selectTagSuggestions(seedKnowledgeStore, "travel").find(
      (item) => item.tag === "住宿",
    );
    const result = tagSuggestionService.reject(seedKnowledgeStore, "travel", suggestion.id);
    const updatedEntity = result.store.entities.find((entity) => entity.id === "travel");

    expect(updatedEntity.tags).not.toContain("住宿");
    expect(result.store.auditLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "tag-suggestion",
          suggestionId: suggestion.id,
          status: "rejected",
          entityId: "travel",
          tag: "住宿",
        }),
      ]),
    );
    expect(selectTagSuggestions(result.store, "travel")).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: suggestion.id })]),
    );
  });

  it("throws when the tag suggestion is not pending", () => {
    expect(() =>
      tagSuggestionService.confirm(seedKnowledgeStore, "travel", "missing-suggestion"),
    ).toThrow("标签建议不存在");
  });

  it("rejects an empty reviewed tag suggestion label", () => {
    const suggestion = selectTagSuggestions(seedKnowledgeStore, "travel").find(
      (item) => item.tag === "证件",
    );

    expect(() =>
      tagSuggestionService.confirm(seedKnowledgeStore, "travel", suggestion.id, {
        tag: " # ",
      }),
    ).toThrow("标签名称必填");
  });
});
