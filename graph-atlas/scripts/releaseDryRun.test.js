import { describe, expect, it, vi } from "vitest";

import {
  createDryRunIntro,
  readReleaseVersion,
  releaseDryRunSteps,
  runReleaseDryRun,
} from "./releaseDryRun.mjs";

describe("releaseDryRunSteps", () => {
  it("keeps the release dry-run as a no-publish wrapper around the required gates", () => {
    expect(releaseDryRunSteps.map((step) => step.script)).toEqual([
      "release:verify",
      "test:run",
      "build",
      "test:release:preview",
    ]);

    expect(createDryRunIntro()).toContain("不会创建 tag、不会 push、不会部署");
    expect(createDryRunIntro()).toContain("不会运行全量浏览器 smoke");
  });

  it("runs every release gate in order and reports success", () => {
    const runner = vi.fn(() => ({ status: 0 }));
    const readVersion = vi.fn(() => "0.2.3");
    const stdout = { write: vi.fn() };
    const stderr = { write: vi.fn() };

    const status = runReleaseDryRun({
      cwd: "/repo/graph-atlas",
      runner,
      readVersion,
      stdout,
      stderr,
    });

    expect(status).toBe(0);
    expect(runner.mock.calls.map((call) => call[1])).toEqual([
      ["run", "release:verify"],
      ["run", "test:run"],
      ["run", "build"],
      ["run", "test:release:preview"],
    ]);
    expect(readVersion).toHaveBeenCalledWith({ cwd: "/repo/graph-atlas" });
    expect(stdout.write.mock.calls.at(-1)[0]).toContain("v0.2.3 发布前检查");
    expect(stdout.write.mock.calls.at(-1)[0]).toContain("全量浏览器 smoke 已通过");
    expect(stderr.write).not.toHaveBeenCalled();
  });

  it("stops at the first failing release gate", () => {
    const runner = vi
      .fn()
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 1 });
    const stdout = { write: vi.fn() };
    const stderr = { write: vi.fn() };

    const status = runReleaseDryRun({
      runner,
      stdout,
      stderr,
    });

    expect(status).toBe(1);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(stderr.write).toHaveBeenCalledWith('Release dry-run failed at "test:run".\n');
  });

  it("reads the dry-run version from package.json", () => {
    const reader = vi.fn(() => JSON.stringify({ version: "1.2.3" }));

    expect(readReleaseVersion({ cwd: "/repo/graph-atlas", reader })).toBe("1.2.3");
    expect(reader).toHaveBeenCalledWith("/repo/graph-atlas/package.json", "utf8");
  });
});
