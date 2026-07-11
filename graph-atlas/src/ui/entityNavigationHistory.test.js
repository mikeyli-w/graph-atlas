import { describe, expect, it } from "vitest";

import {
  createEntityNavigationHistory,
  goBackInEntityHistory,
  goForwardInEntityHistory,
  selectEntityNavigationState,
  visitEntity,
} from "./entityNavigationHistory.js";

describe("entityNavigationHistory", () => {
  it("tracks visited entities and clears forward history on a new visit", () => {
    const initial = createEntityNavigationHistory("passport");
    const visited = visitEntity(visitEntity(initial, "travel"), "files");
    const backed = goBackInEntityHistory(visited);
    const branched = visitEntity(backed, "contacts");

    expect(visited).toEqual({
      past: ["passport", "travel"],
      current: "files",
      future: [],
    });
    expect(backed).toEqual({
      past: ["passport"],
      current: "travel",
      future: ["files"],
    });
    expect(branched).toEqual({
      past: ["passport", "travel"],
      current: "contacts",
      future: [],
    });
  });

  it("moves backward and forward without duplicating the current entity", () => {
    const history = visitEntity(
      visitEntity(createEntityNavigationHistory("passport"), "travel"),
      "files",
    );

    expect(goForwardInEntityHistory(goBackInEntityHistory(history))).toEqual(history);
    expect(visitEntity(history, "files")).toBe(history);
  });

  it("exposes button availability", () => {
    const initial = createEntityNavigationHistory("passport");
    const visited = visitEntity(initial, "travel");
    const backed = goBackInEntityHistory(visited);

    expect(selectEntityNavigationState(initial)).toEqual({
      current: "passport",
      canGoBack: false,
      canGoForward: false,
    });
    expect(selectEntityNavigationState(backed)).toEqual({
      current: "passport",
      canGoBack: false,
      canGoForward: true,
    });
  });
});
