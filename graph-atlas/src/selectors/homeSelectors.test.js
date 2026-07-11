import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import { selectHomeSummary } from "./homeSelectors.js";

describe("selectHomeSummary", () => {
  it("shows the first-screen promise and three task entries", () => {
    const summary = selectHomeSummary(seedKnowledgeStore);

    expect(summary.headline).toBe("别再找资料了。它们已经在这里。");
    expect(summary.taskEntries.map((entry) => entry.label)).toEqual([
      "找资料",
      "新增资料",
      "出行检查",
    ]);
  });

  it("keeps AI out of the first-screen task entries", () => {
    const summary = selectHomeSummary(seedKnowledgeStore);
    const taskEntryText = summary.taskEntries
      .map((entry) => [entry.id, entry.label, entry.description, entry.action].join(" "))
      .join(" ")
      .toLowerCase();

    expect(taskEntryText).not.toContain("ai");
    expect(summary.taskEntries.map((entry) => entry.action)).toEqual([
      "search",
      "add",
      "travel-check",
    ]);
  });

  it("includes the travel-check targets required by the hero scenario", () => {
    const summary = selectHomeSummary(seedKnowledgeStore);

    expect(summary.travelCheckItems.map((item) => item.label)).toEqual([
      "护照",
      "签证记录",
      "旅行清单",
      "文件资料",
      "紧急联系人",
    ]);
    expect(summary.travelCheckItems.map((item) => item.targetId)).toEqual([
      "passport",
      "passport",
      "travel",
      "files",
      "emergency-contacts",
    ]);
  });

  it("summarizes material status counts before the graph", () => {
    const summary = selectHomeSummary(seedKnowledgeStore);

    expect(summary.statusSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "已保存", count: 13 }),
        expect.objectContaining({ label: "AI 不可见", count: 2 }),
        expect.objectContaining({ label: "缺附件", count: 2 }),
        expect.objectContaining({ label: "需检查", count: 1 }),
      ]),
    );
  });
});
