import { describe, expect, it } from "vitest";

import { seedKnowledgeStore } from "../data/seedKnowledgeStore.js";
import {
  getAiVisibility,
  getPrivacyLabel,
  selectAiContextEntities,
  updatePrivacyAccess,
} from "./privacy.js";

describe("privacy domain", () => {
  it("keeps high privacy entities out of AI context by default", () => {
    const passport = seedKnowledgeStore.entities.find((entity) => entity.id === "passport");

    expect(passport).toEqual(
      expect.objectContaining({
        privacyLevel: "high",
        aiAccess: false,
      }),
    );
    expect(selectAiContextEntities(seedKnowledgeStore)).not.toContainEqual(
      expect.objectContaining({ id: "passport" }),
    );
    expect(getAiVisibility(passport)).toEqual({
      aiAccess: false,
      label: "AI 不可见",
      description: "高隐私资料默认不进入 AI",
    });
  });

  it("keeps medium privacy entities out of cloud AI context by default", () => {
    const profile = seedKnowledgeStore.entities.find((entity) => entity.id === "profile");

    expect(profile).toEqual(
      expect.objectContaining({
        privacyLevel: "medium",
        aiAccess: false,
      }),
    );
    expect(selectAiContextEntities(seedKnowledgeStore)).not.toContainEqual(
      expect.objectContaining({ id: "profile" }),
    );
    expect(getAiVisibility(profile).description).toBe("中隐私资料默认不进入云端 AI");
  });

  it("allows low privacy entities into reserved AI context", () => {
    expect(selectAiContextEntities(seedKnowledgeStore)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "work", privacyLevel: "low", aiAccess: true }),
        expect.objectContaining({ id: "travel", privacyLevel: "low", aiAccess: true }),
      ]),
    );
  });

  it("uses Chinese privacy labels in the UI model", () => {
    expect(getPrivacyLabel("high")).toBe("高（仅自己可见）");
    expect(getPrivacyLabel("medium")).toBe("中（本地保存）");
    expect(getPrivacyLabel("low")).toBe("低（可导出）");
  });

  it("does not automatically open AI access when moving from high to low privacy", () => {
    expect(
      updatePrivacyAccess(
        {
          privacyLevel: "high",
          aiAccess: false,
        },
        "低（可导出）",
      ),
    ).toEqual({
      privacyLevel: "low",
      aiAccess: false,
    });
  });
});
