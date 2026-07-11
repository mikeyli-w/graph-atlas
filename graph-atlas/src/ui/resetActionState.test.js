import { describe, expect, it } from "vitest";

import {
  cancelReset,
  confirmReset,
  createResetActionState,
  requestReset,
} from "./resetActionState.js";

describe("reset action UI state", () => {
  it("requires an explicit confirmation step before reset can proceed", () => {
    const requested = requestReset();

    expect(createResetActionState()).toEqual({ pending: false });
    expect(requested).toEqual({ pending: true });
    expect(cancelReset(requested)).toEqual(createResetActionState());
    expect(confirmReset(requested)).toEqual(createResetActionState());
  });
});
