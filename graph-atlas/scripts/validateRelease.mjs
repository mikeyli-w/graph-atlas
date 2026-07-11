import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const releaseTagPrefix = "graph-atlas-v";
const semverPattern = /^\d+\.\d+\.\d+$/;

export function validateReleaseMetadata({
  packageJson,
  packageLockJson,
  releaseText,
  refType = "",
  refName = "",
  ref = "",
}) {
  const errors = [];
  const version = packageJson.version;
  const lockVersion = packageLockJson.version;
  const rootPackageVersion = packageLockJson.packages?.[""]?.version;

  if (!semverPattern.test(version || "")) {
    errors.push(`package.json version must be x.y.z, got "${version || ""}".`);
  }

  if (lockVersion !== version) {
    errors.push(`package-lock.json version "${lockVersion}" does not match package.json "${version}".`);
  }

  if (rootPackageVersion !== version) {
    errors.push(
      `package-lock root package version "${rootPackageVersion}" does not match package.json "${version}".`,
    );
  }

  if (!releaseText.includes(`## v${version}`)) {
    errors.push(`RELEASE.md must contain a "## v${version}" section.`);
  }

  const tagName = normalizeTagName({ refType, refName, ref });
  if (tagName) {
    const expectedTag = `${releaseTagPrefix}${version}`;
    if (tagName !== expectedTag) {
      errors.push(`Release tag "${tagName}" must match package version tag "${expectedTag}".`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    version,
    expectedTag: `${releaseTagPrefix}${version}`,
  };
}

export function validateReleaseScripts(packageJson) {
  const errors = [];
  const scripts = packageJson.scripts || {};
  const requiredScripts = [
    ["test:release:preview", "playwright test -c playwright.preview.config.mjs"],
    ["release:verify", "node scripts/validateRelease.mjs"],
    [
      "release:check",
      "npm run release:verify && npm run test:run && npm run build && npm run test:release:preview",
    ],
    ["release:dry-run", "node scripts/releaseDryRun.mjs"],
  ];

  for (const [name, expectedCommand] of requiredScripts) {
    if (scripts[name] !== expectedCommand) {
      errors.push(
        `package.json script "${name}" must be "${expectedCommand}", got "${scripts[name] || ""}".`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function validateViteConfig(viteConfigText) {
  const errors = [];

  if (!viteConfigText.includes('base: "./"')) {
    errors.push('Vite must use base: "./" so GitHub Pages subpath assets resolve correctly.');
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function validateReleaseWorkflow(workflowText) {
  const errors = [];
  const requiredFragments = [
    ['workflow_dispatch:', "Release workflow must support manual workflow_dispatch."],
    ['tags:\n      - "graph-atlas-v*"', 'Release workflow must run for "graph-atlas-v*" tags.'],
    ["contents: read", 'Release workflow permission "contents: read" is required.'],
    ["pages: write", 'Release workflow permission "pages: write" is required.'],
    ["id-token: write", 'Release workflow permission "id-token: write" is required.'],
    ["environment:\n      name: github-pages", 'Release workflow must deploy to the github-pages environment.'],
    ["working-directory: graph-atlas", "Release workflow must run commands from graph-atlas."],
    ["uses: actions/checkout@v4", "Release workflow must check out the repository."],
    ["uses: actions/setup-node@v4", "Release workflow must set up Node."],
    ["node-version: 20", "Release workflow must use Node 20."],
    ["cache-dependency-path: graph-atlas/package-lock.json", "Release workflow must cache npm using graph-atlas/package-lock.json."],
    ["uses: actions/configure-pages@v5", "Release workflow must configure GitHub Pages."],
    ["run: npm ci", "Release workflow must install dependencies with npm ci."],
    ["run: npm run release:verify", "Release workflow must verify release metadata."],
    ["run: npm run test:run", "Release workflow must run Vitest."],
    ["run: npm run build", "Release workflow must build the production bundle."],
    ["run: npm run test:e2e:install", "Release workflow must install Playwright Chromium."],
    ["run: npx playwright install-deps chromium", "Release workflow must install Chromium system dependencies."],
    ["run: npm run test:release:preview", "Release workflow must run the static preview smoke."],
    ["GRAPH_ATLAS_E2E_BROWSER: chromium", "Release preview smoke must use Playwright managed Chromium."],
    ["uses: actions/upload-pages-artifact@v3", "Release workflow must upload a GitHub Pages artifact."],
    ["path: graph-atlas/dist", "Release workflow must publish graph-atlas/dist."],
    ["uses: actions/deploy-pages@v4", "Release workflow must deploy with actions/deploy-pages."],
  ];

  for (const [fragment, message] of requiredFragments) {
    if (!workflowText.includes(fragment)) {
      errors.push(message);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function validateCiWorkflow(workflowText) {
  const errors = [];
  const requiredFragments = [
    ["pull_request:", "CI workflow must run on pull_request."],
    ["push:", "CI workflow must run on push."],
    ["contents: read", 'CI workflow permission "contents: read" is required.'],
    ["working-directory: graph-atlas", "CI workflow must run commands from graph-atlas."],
    ["node-version: 20", "CI workflow must use Node 20."],
    ["cache-dependency-path: graph-atlas/package-lock.json", "CI workflow must cache npm using graph-atlas/package-lock.json."],
    ["run: npm ci", "CI workflow must install dependencies with npm ci."],
    ["run: npm run test:run", "CI workflow must run Vitest."],
    ["run: npm run build", "CI workflow must build the production bundle."],
    ["run: npm run test:e2e:install", "CI workflow must install Playwright Chromium."],
    ["run: npx playwright install-deps chromium", "CI workflow must install Chromium system dependencies."],
    ["run: npm run test:release:preview", "CI workflow must run the static preview smoke."],
    ["GRAPH_ATLAS_E2E_BROWSER: chromium", "CI browser checks must use Playwright managed Chromium."],
    ["run: npm run test:e2e:ci", "CI workflow must run browser smoke tests."],
    ["uses: actions/upload-artifact@v4", "CI workflow must upload Playwright artifacts on failure."],
    ["graph-atlas/playwright-report/", "CI workflow must upload the Playwright report."],
    ["graph-atlas/test-results/", "CI workflow must upload Playwright test results."],
  ];

  for (const [fragment, message] of requiredFragments) {
    if (!workflowText.includes(fragment)) {
      errors.push(message);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function validateReleaseDocs({
  readmeText,
  releaseText,
  releaseGovernanceText,
  version = "",
  expectedTag = "",
}) {
  const errors = [];
  const requiredDocs = [
    ["README.md", readmeText],
    ["RELEASE.md", releaseText],
    ["RELEASE_GOVERNANCE.md", releaseGovernanceText],
  ];

  for (const [label, text] of requiredDocs) {
    if (!text.includes("npm run release:dry-run")) {
      errors.push(`${label} must tell users to run "npm run release:dry-run" before release.`);
    }
  }

  if (
    !releaseText.includes("不创建 tag") ||
    !releaseText.includes("不 push") ||
    !releaseText.includes("不部署") ||
    !releaseText.includes("不运行全量浏览器 smoke")
  ) {
    errors.push(
      "RELEASE.md must explain that release:dry-run does not create tags, push, deploy, or run full browser smoke.",
    );
  }

  if (!releaseText.includes("npm run test:e2e")) {
    errors.push('RELEASE.md must require "npm run test:e2e" or CI before release.');
  }

  if (version && !readmeText.includes(`当前版本：\`${version}\``)) {
    errors.push(`README.md current version must match package version "${version}".`);
  }

  if (expectedTag) {
    const requiredTagFragments = [
      ["README.md", readmeText, `正式 tag 必须形如 \`${expectedTag}\``],
      ["RELEASE.md", releaseText, `正式 tag 使用 \`${expectedTag}\``],
      ["RELEASE_GOVERNANCE.md", releaseGovernanceText, `git tag ${expectedTag}`],
      ["RELEASE_GOVERNANCE.md", releaseGovernanceText, `git push origin ${expectedTag}`],
    ];

    for (const [label, text, fragment] of requiredTagFragments) {
      if (!text.includes(fragment)) {
        errors.push(`${label} must reference release tag "${expectedTag}".`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function normalizeTagName({ refType = "", refName = "", ref = "" }) {
  if (refType === "tag") return refName;
  if (ref.startsWith("refs/tags/")) return ref.replace("refs/tags/", "");
  return "";
}

async function main() {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const packageLockJson = JSON.parse(
    await readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
  );
  const releaseText = await readFile(new URL("../../RELEASE.md", import.meta.url), "utf8");
  const readmeText = await readFile(new URL("../../README.md", import.meta.url), "utf8");
  const releaseGovernanceText = await readFile(
    new URL("../../RELEASE_GOVERNANCE.md", import.meta.url),
    "utf8",
  );
  const workflowText = await readFile(
    new URL("../../.github/workflows/graph-atlas-release.yml", import.meta.url),
    "utf8",
  );
  const ciWorkflowText = await readFile(
    new URL("../../.github/workflows/graph-atlas-ci.yml", import.meta.url),
    "utf8",
  );
  const viteConfigText = await readFile(new URL("../vite.config.mjs", import.meta.url), "utf8");
  const result = validateReleaseMetadata({
    packageJson,
    packageLockJson,
    releaseText,
    refType: process.env.GITHUB_REF_TYPE,
    refName: process.env.GITHUB_REF_NAME,
    ref: process.env.GITHUB_REF,
  });
  const scriptsResult = validateReleaseScripts(packageJson);
  const viteConfigResult = validateViteConfig(viteConfigText);
  const workflowResult = validateReleaseWorkflow(workflowText);
  const ciWorkflowResult = validateCiWorkflow(ciWorkflowText);
  const docsResult = validateReleaseDocs({
    readmeText,
    releaseText,
    releaseGovernanceText,
    version: result.version,
    expectedTag: result.expectedTag,
  });
  const errors = [
    ...result.errors,
    ...scriptsResult.errors,
    ...viteConfigResult.errors,
    ...workflowResult.errors,
    ...ciWorkflowResult.errors,
    ...docsResult.errors,
  ];

  if (errors.length > 0) {
    console.error("Release metadata check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Release metadata OK for v${result.version} (${result.expectedTag}).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}
