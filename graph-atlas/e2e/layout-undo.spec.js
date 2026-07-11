import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    indexedDB.deleteDatabase("graph-atlas-attachments");
  });
  await page.reload();
  await expect(page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ })).toBeVisible();
});

test("applies a saved layout and restores the previous positions with undo", async ({
  page,
}) => {
  const layoutTitle = `Smoke 布局撤销 ${Date.now()}`;
  const updatedLayoutTitle = `${layoutTitle} 已校准`;
  const passport = page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ });
  const graphCanvas = page.locator(".graph-canvas");
  const savedPosition = await readGraphNodePosition(passport);

  await page.getByLabel("布局版本名称").fill(layoutTitle);
  await page.getByRole("button", { name: "保存布局" }).click();
  await expect(page.getByText(`布局已保存：${layoutTitle}`)).toBeVisible();
  await expect(page.getByText("已保存 1 个版本")).toBeVisible();

  const canvasBox = await graphCanvas.boundingBox();
  expect(canvasBox).not.toBeNull();

  await passport.dragTo(graphCanvas, {
    force: true,
    targetPosition: {
      x: canvasBox.width * 0.74,
      y: canvasBox.height * 0.3,
    },
  });
  await page.mouse.up();

  await expect
    .poll(async () => positionDistance(await readGraphNodePosition(passport), savedPosition))
    .toBeGreaterThan(1);
  const movedPosition = await readGraphNodePosition(passport);

  const layoutPanel = page.locator(".layout-version-panel");
  await layoutPanel.locator("summary").click();

  const layoutRow = layoutPanel.locator(".layout-version-row").first();
  await expect(layoutRow.locator('input[name="title"]')).toHaveValue(layoutTitle);
  await layoutRow.locator('input[name="title"]').fill(updatedLayoutTitle);
  await layoutRow.locator('input[name="note"]').fill("保存后补充备注");
  await layoutRow.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText(`布局版本已更新：${updatedLayoutTitle}`)).toBeVisible();
  await expect(layoutRow.locator('input[name="title"]')).toHaveValue(updatedLayoutTitle);
  await layoutRow.getByRole("button", { name: "应用" }).click();

  await expect(layoutRow.getByText("确认应用后将移动 1 个节点")).toBeVisible();
  await expect(layoutRow.getByRole("button", { name: "确认应用" })).toBeVisible();
  await expect(layoutRow.getByRole("button", { name: "取消" })).toBeVisible();
  expectPositionClose(await readGraphNodePosition(passport), movedPosition);

  await layoutRow.getByRole("button", { name: "取消" }).click();
  await expect(layoutRow.getByText("确认应用后将移动 1 个节点")).toHaveCount(0);
  await expect(
    page.getByText(`已取消应用布局版本：${updatedLayoutTitle}，当前布局未更改。`),
  ).toBeVisible();
  expectPositionClose(await readGraphNodePosition(passport), movedPosition);

  await layoutRow.getByRole("button", { name: "应用" }).click();
  await expect(layoutRow.getByText("确认应用后将移动 1 个节点")).toBeVisible();
  await layoutRow.getByRole("button", { name: "确认应用" }).click();

  await expect
    .poll(async () => positionDistance(await readGraphNodePosition(passport), savedPosition))
    .toBeLessThan(0.2);
  await expect(
    layoutPanel.getByText(`已应用“${updatedLayoutTitle}”，可恢复到应用前布局`),
  ).toBeVisible();
  await expect(layoutPanel.getByRole("button", { name: "撤销应用" })).toBeVisible();

  await layoutPanel.getByRole("button", { name: "撤销应用" }).click();

  await expect
    .poll(async () => positionDistance(await readGraphNodePosition(passport), movedPosition))
    .toBeLessThan(0.2);
  await expect(page.getByText("布局应用已撤销。")).toBeVisible();
  await expect(layoutPanel.getByRole("button", { name: "撤销应用" })).toBeHidden();

  await layoutRow.getByRole("button", { name: `删除${updatedLayoutTitle}` }).click();
  await expect(layoutRow.getByText("确认删除这个布局版本？")).toBeVisible();
  await layoutRow.getByRole("button", { name: "取消" }).click();
  await expect(layoutRow.getByText("确认删除这个布局版本？")).toHaveCount(0);
  await expect(page.getByText(`布局版本删除已取消：${updatedLayoutTitle}`)).toBeVisible();
  await expect(layoutPanel.getByText("已保存 1 个版本")).toBeVisible();

  await layoutRow.getByRole("button", { name: `删除${updatedLayoutTitle}` }).click();
  await layoutRow.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByText(`布局版本已删除：${updatedLayoutTitle}`)).toBeVisible();
  await expect(layoutPanel.locator(".layout-version-empty")).toHaveText("暂无保存布局");
});

test("copies a saved layout version with visible feedback", async ({ page }) => {
  const layoutTitle = `Smoke 布局复制 ${Date.now()}`;
  const copiedLayoutTitle = `${layoutTitle} 副本`;
  const secondCopiedLayoutTitle = `${layoutTitle} 副本 2`;

  await page.getByLabel("布局版本名称").fill(layoutTitle);
  await page.getByRole("button", { name: "保存布局" }).click();
  await expect(page.getByText(`布局已保存：${layoutTitle}`)).toBeVisible();

  const layoutPanel = page.locator(".layout-version-panel");
  await layoutPanel.locator("summary").click();
  await layoutPanel
    .locator(".layout-version-row")
    .first()
    .getByRole("button", { name: "复制", exact: true })
    .click();

  await expect(page.getByText(`布局版本已复制：${copiedLayoutTitle}`)).toBeVisible();
  await expect(layoutPanel.getByText("已保存 2 个版本")).toBeVisible();
  await expect
    .poll(async () =>
      layoutPanel.locator('input[name="title"]').evaluateAll((inputs, title) =>
        inputs.some((input) => input.value === title),
        copiedLayoutTitle,
      ),
    )
    .toBe(true);

  await layoutPanel
    .locator(".layout-version-row")
    .nth(1)
    .getByRole("button", { name: "复制", exact: true })
    .click();

  await expect(page.getByText(`布局版本已复制：${secondCopiedLayoutTitle}`)).toBeVisible();
  await expect(layoutPanel.getByText("已保存 3 个版本")).toBeVisible();
  await expect
    .poll(async () =>
      layoutPanel.locator('input[name="title"]').evaluateAll(
        (inputs, titles) => titles.every((title) =>
          inputs.some((input) => input.value === title),
        ),
        [copiedLayoutTitle, secondCopiedLayoutTitle],
      ),
    )
    .toBe(true);
});

test("confirms restoring the default graph layout before moving nodes", async ({ page }) => {
  const passport = page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ });
  const graphCanvas = page.locator(".graph-canvas");
  const defaultPosition = await readGraphNodePosition(passport);
  const canvasBox = await graphCanvas.boundingBox();
  expect(canvasBox).not.toBeNull();

  await passport.dragTo(graphCanvas, {
    force: true,
    targetPosition: {
      x: canvasBox.width * 0.7,
      y: canvasBox.height * 0.32,
    },
  });
  await page.mouse.up();

  await expect
    .poll(async () => positionDistance(await readGraphNodePosition(passport), defaultPosition))
    .toBeGreaterThan(1);
  const movedPosition = await readGraphNodePosition(passport);

  await page.getByRole("button", { name: "恢复布局" }).click();
  await expect(page.getByText("确认恢复默认布局？")).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();
  await expect(page.getByText("确认恢复默认布局？")).toHaveCount(0);
  await expect(page.getByText("已取消恢复默认布局，当前节点位置未更改。")).toBeVisible();
  expectPositionClose(await readGraphNodePosition(passport), movedPosition);

  await page.getByRole("button", { name: "恢复布局" }).click();
  await page.getByRole("button", { name: "确认恢复" }).click();
  await expect
    .poll(async () => positionDistance(await readGraphNodePosition(passport), defaultPosition))
    .toBeLessThan(0.2);
  await expect(page.getByText("默认布局已恢复。")).toBeVisible();
  await expect(page.getByText("确认恢复默认布局？")).toHaveCount(0);
});

async function readGraphNodePosition(locator) {
  return locator.evaluate((element) => ({
    x: Number.parseFloat(element.style.getPropertyValue("--x")),
    y: Number.parseFloat(element.style.getPropertyValue("--y")),
  }));
}

function positionDistance(first, second) {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

function expectPositionClose(actual, expected) {
  expect(actual.x).toBeCloseTo(expected.x, 1);
  expect(actual.y).toBeCloseTo(expected.y, 1);
}
