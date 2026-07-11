import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const releaseDryRunSteps = [
  {
    label: "校验发布元数据和 GitHub Pages workflow",
    script: "release:verify",
  },
  {
    label: "运行单元与集成测试",
    script: "test:run",
  },
  {
    label: "构建生产静态包",
    script: "build",
  },
  {
    label: "预览 dist 并执行静态 smoke",
    script: "test:release:preview",
  },
];

export function createDryRunIntro(steps = releaseDryRunSteps) {
  return [
    "Graph Atlas release dry-run",
    "不会创建 tag、不会 push、不会部署；只验证本地和仓库内发布配置。",
    "不会运行全量浏览器 smoke；正式发布前需确认 GitHub Actions CI 或 npm run test:e2e 已通过。",
    "将按顺序执行：",
    ...steps.map((step, index) => `${index + 1}. npm run ${step.script} - ${step.label}`),
  ].join("\n");
}

export function readReleaseVersion({ cwd = process.cwd(), reader = readFileSync } = {}) {
  const packageJson = JSON.parse(reader(join(cwd, "package.json"), "utf8"));
  return packageJson.version;
}

export function runReleaseDryRun({
  steps = releaseDryRunSteps,
  cwd = process.cwd(),
  runner = spawnSync,
  readVersion = readReleaseVersion,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  stdout.write(`${createDryRunIntro(steps)}\n`);

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  for (const step of steps) {
    stdout.write(`\n> npm run ${step.script}\n`);
    const result = runner(npmCommand, ["run", step.script], {
      cwd,
      stdio: "inherit",
      env: process.env,
    });

    if (result.status !== 0) {
      stderr.write(`Release dry-run failed at "${step.script}".\n`);
      return result.status || 1;
    }
  }

  const version = readVersion({ cwd });
  stdout.write(
    `\nRelease dry-run passed. 当前仓库内发布配置满足 v${version} 发布前检查；正式发布前仍需确认全量浏览器 smoke 已通过。\n`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runReleaseDryRun();
}
