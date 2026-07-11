import { describe, expect, it } from "vitest";

import {
  defaultRelationshipTemplateTypes,
  loadRelationshipTemplates,
  relationshipTemplateStorageKey,
  saveRelationshipTemplates,
  validateRelationshipTemplate,
} from "./relationshipTemplates.js";

describe("relationshipTemplates", () => {
  it("loads defaults when storage is empty", () => {
    const storage = createMemoryStorage();

    expect(loadRelationshipTemplates(storage)).toEqual(defaultRelationshipTemplateTypes);
  });

  it("saves normalized unique templates", () => {
    const storage = createMemoryStorage();

    saveRelationshipTemplates([" 复诊资料 ", "复诊资料", "保管位置"], storage);

    expect(JSON.parse(storage.getItem(relationshipTemplateStorageKey))).toEqual([
      "复诊资料",
      "保管位置",
    ]);
    expect(loadRelationshipTemplates(storage)).toEqual(["复诊资料", "保管位置"]);
  });

  it("falls back to defaults without overwriting corrupt storage", () => {
    const storage = createMemoryStorage();
    storage.setItem(relationshipTemplateStorageKey, "{not json");

    expect(loadRelationshipTemplates(storage)).toEqual(defaultRelationshipTemplateTypes);
    expect(storage.getItem(relationshipTemplateStorageKey)).toBe("{not json");
  });

  it("rejects empty and oversized template values", () => {
    expect(() => validateRelationshipTemplate(" ")).toThrow("关系模板不能为空。");
    expect(() => validateRelationshipTemplate("一二三四五六七八九十一二三四五六七八九十一"))
      .toThrow("关系模板不能超过 20 个字符。");
    expect(validateRelationshipTemplate(" 复诊资料 ")).toBe("复诊资料");
  });
});

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}
