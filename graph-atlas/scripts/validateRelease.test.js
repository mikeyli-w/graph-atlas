import { describe, expect, it } from "vitest";

import {
  normalizeTagName,
  validateCiWorkflow,
  validateReleaseDocs,
  validateReleaseMetadata,
  validateReleaseScripts,
  validateViteConfig,
  validateReleaseWorkflow,
} from "./validateRelease.mjs";

const packageJson = {
  version: "0.1.0",
  scripts: {
    "test:release:preview": "playwright test -c playwright.preview.config.mjs",
    "release:verify": "node scripts/validateRelease.mjs",
    "release:check": "npm run release:verify && npm run test:run && npm run build && npm run test:release:preview",
    "release:dry-run": "node scripts/releaseDryRun.mjs",
  },
};
const packageLockJson = {
  version: "0.1.0",
  packages: {
    "": {
      version: "0.1.0",
    },
  },
};
const releaseText = [
  "# Graph Atlas Release",
  "## v0.1.0",
  "npm run release:dry-run",
  "npm run test:e2e",
  "不创建 tag，不 push，不部署，也不运行全量浏览器 smoke。",
  "正式 tag 使用 `graph-atlas-v0.1.0`",
].join("\n\n");
const readmeText = [
  "当前版本：`0.1.0`",
  "发布前运行：npm run release:dry-run",
  "正式 tag 必须形如 `graph-atlas-v0.1.0`",
].join("\n\n");
const releaseDocsText = "发布前运行：npm run release:dry-run";
const releaseGovernanceText = [
  "发布前运行：npm run release:dry-run",
  "git tag graph-atlas-v0.1.0",
  "git push origin graph-atlas-v0.1.0",
].join("\n");
const releaseWorkflowText = `
name: Graph Atlas Release
on:
  workflow_dispatch:
  push:
    tags:
      - "graph-atlas-v*"
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  release:
    environment:
      name: github-pages
    defaults:
      run:
        working-directory: graph-atlas
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache-dependency-path: graph-atlas/package-lock.json
      - uses: actions/configure-pages@v5
      - run: npm ci
      - run: npm run release:verify
      - run: npm run test:run
      - run: npm run build
      - run: npm run test:e2e:install
      - run: npx playwright install-deps chromium
      - run: npm run test:release:preview
        env:
          GRAPH_ATLAS_E2E_BROWSER: chromium
      - uses: actions/upload-pages-artifact@v3
        with:
          path: graph-atlas/dist
      - uses: actions/deploy-pages@v4
`;
const ciWorkflowText = `
name: Graph Atlas CI
on:
  push:
  pull_request:
permissions:
  contents: read
jobs:
  graph-atlas-ci:
    defaults:
      run:
        working-directory: graph-atlas
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache-dependency-path: graph-atlas/package-lock.json
      - run: npm ci
      - run: npm run test:run
      - run: npm run build
      - run: npm run test:e2e:install
      - run: npx playwright install-deps chromium
      - run: npm run test:release:preview
        env:
          GRAPH_ATLAS_E2E_BROWSER: chromium
      - run: npm run test:e2e:ci
      - uses: actions/upload-artifact@v4
        with:
          path: |
            graph-atlas/playwright-report/
            graph-atlas/test-results/
`;

describe("validateReleaseMetadata", () => {
  it("accepts matching package, lockfile, release notes and tag", () => {
    const result = validateReleaseMetadata({
      packageJson,
      packageLockJson,
      releaseText,
      refType: "tag",
      refName: "graph-atlas-v0.1.0",
    });

    expect(result).toEqual({
      ok: true,
      errors: [],
      version: "0.1.0",
      expectedTag: "graph-atlas-v0.1.0",
    });
  });

  it("rejects package-lock version drift", () => {
    const result = validateReleaseMetadata({
      packageJson,
      packageLockJson: {
        ...packageLockJson,
        packages: {
          "": {
            version: "0.2.0",
          },
        },
      },
      releaseText,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      'package-lock root package version "0.2.0" does not match package.json "0.1.0".',
    ]);
  });

  it("rejects release notes without the package version section", () => {
    const result = validateReleaseMetadata({
      packageJson,
      packageLockJson,
      releaseText: "# Graph Atlas Release\n\n## v0.0.9\n",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('RELEASE.md must contain a "## v0.1.0" section.');
  });

  it("rejects tags that do not match the package version", () => {
    const result = validateReleaseMetadata({
      packageJson,
      packageLockJson,
      releaseText,
      refType: "tag",
      refName: "graph-atlas-v0.2.0",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Release tag "graph-atlas-v0.2.0" must match package version tag "graph-atlas-v0.1.0".',
    );
  });
});

describe("validateViteConfig", () => {
  it("accepts relative production asset paths for repository Pages", () => {
    expect(validateViteConfig('export default defineConfig({ base: "./" });')).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("rejects root-relative assets that break repository Pages", () => {
    expect(validateViteConfig("export default defineConfig({});")).toEqual({
      ok: false,
      errors: ['Vite must use base: "./" so GitHub Pages subpath assets resolve correctly.'],
    });
  });
});

describe("normalizeTagName", () => {
  it("reads tags from GitHub ref metadata", () => {
    expect(normalizeTagName({ refType: "tag", refName: "graph-atlas-v0.1.0" }))
      .toBe("graph-atlas-v0.1.0");
    expect(normalizeTagName({ ref: "refs/tags/graph-atlas-v0.1.0" }))
      .toBe("graph-atlas-v0.1.0");
    expect(normalizeTagName({ ref: "refs/heads/main" })).toBe("");
  });
});

describe("validateReleaseScripts", () => {
  it("accepts the release script contract", () => {
    expect(validateReleaseScripts(packageJson)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("rejects release script drift", () => {
    const result = validateReleaseScripts({
      scripts: {
        ...packageJson.scripts,
        "release:check": "npm run test:run && npm run build",
        "release:dry-run": "",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      'package.json script "release:check" must be "npm run release:verify && npm run test:run && npm run build && npm run test:release:preview", got "npm run test:run && npm run build".',
      'package.json script "release:dry-run" must be "node scripts/releaseDryRun.mjs", got "".',
    ]);
  });
});

describe("validateReleaseWorkflow", () => {
  it("accepts the release workflow contract", () => {
    expect(validateReleaseWorkflow(releaseWorkflowText)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("rejects workflow drift that would skip Pages deployment or preview smoke", () => {
    const result = validateReleaseWorkflow(
      releaseWorkflowText
        .replace("path: graph-atlas/dist", "path: dist")
        .replace("GRAPH_ATLAS_E2E_BROWSER: chromium", "GRAPH_ATLAS_E2E_BROWSER: chrome")
        .replace("run: npm ci", "run: npm install")
        .replace("uses: actions/configure-pages@v5", "uses: actions/cache@v4"),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "Release workflow must configure GitHub Pages.",
      "Release workflow must install dependencies with npm ci.",
      "Release preview smoke must use Playwright managed Chromium.",
      "Release workflow must publish graph-atlas/dist.",
    ]);
  });
});

describe("validateCiWorkflow", () => {
  it("accepts the CI workflow contract", () => {
    expect(validateCiWorkflow(ciWorkflowText)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("rejects CI drift that would skip browser coverage or failure artifacts", () => {
    const result = validateCiWorkflow(
      ciWorkflowText
        .replace("run: npm run test:e2e:ci", "run: npm run test:e2e -- --list")
        .replace("graph-atlas/test-results/", "test-results/"),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "CI workflow must run browser smoke tests.",
      "CI workflow must upload Playwright test results.",
    ]);
  });
});

describe("validateReleaseDocs", () => {
  it("accepts docs that point users to the dry-run release gate", () => {
    expect(
      validateReleaseDocs({
        readmeText,
        releaseText,
        releaseGovernanceText,
        version: "0.1.0",
        expectedTag: "graph-atlas-v0.1.0",
      }),
    ).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("rejects docs that drift back to lower-level release commands", () => {
    const result = validateReleaseDocs({
      readmeText: "发布前运行：npm run release:verify",
      releaseText: "# Release\n\nnpm run release:check\n",
      releaseGovernanceText: releaseDocsText,
      version: "0.1.0",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      'README.md must tell users to run "npm run release:dry-run" before release.',
      'RELEASE.md must tell users to run "npm run release:dry-run" before release.',
      "RELEASE.md must explain that release:dry-run does not create tags, push, deploy, or run full browser smoke.",
      'RELEASE.md must require "npm run test:e2e" or CI before release.',
      'README.md current version must match package version "0.1.0".',
    ]);
  });

  it("rejects release notes that do not require full browser smoke outside dry-run", () => {
    const result = validateReleaseDocs({
      readmeText,
      releaseText: releaseText
        .replace("npm run test:e2e\n\n", "")
        .replace("，也不运行全量浏览器 smoke", ""),
      releaseGovernanceText,
      version: "0.1.0",
      expectedTag: "graph-atlas-v0.1.0",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "RELEASE.md must explain that release:dry-run does not create tags, push, deploy, or run full browser smoke.",
      'RELEASE.md must require "npm run test:e2e" or CI before release.',
    ]);
  });

  it("rejects README current version drift", () => {
    const result = validateReleaseDocs({
      readmeText: "当前版本：`0.2.0`\n\n发布前运行：npm run release:dry-run",
      releaseText,
      releaseGovernanceText,
      version: "0.1.0",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      'README.md current version must match package version "0.1.0".',
    ]);
  });

  it("rejects release tag drift across release docs", () => {
    const result = validateReleaseDocs({
      readmeText: readmeText.replace("graph-atlas-v0.1.0", "graph-atlas-v0.2.0"),
      releaseText: releaseText.replace("graph-atlas-v0.1.0", "graph-atlas-v0.2.0"),
      releaseGovernanceText: releaseGovernanceText
        .replace("git tag graph-atlas-v0.1.0", "git tag graph-atlas-v0.2.0")
        .replace("git push origin graph-atlas-v0.1.0", "git push origin graph-atlas-v0.2.0"),
      version: "0.1.0",
      expectedTag: "graph-atlas-v0.1.0",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      'README.md must reference release tag "graph-atlas-v0.1.0".',
      'RELEASE.md must reference release tag "graph-atlas-v0.1.0".',
      'RELEASE_GOVERNANCE.md must reference release tag "graph-atlas-v0.1.0".',
      'RELEASE_GOVERNANCE.md must reference release tag "graph-atlas-v0.1.0".',
    ]);
  });
});
