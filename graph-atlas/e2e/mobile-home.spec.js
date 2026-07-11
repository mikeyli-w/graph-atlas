import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("graph-atlas-attachments");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
  await page.reload();
  await expect(page.getByPlaceholder("搜索护照、签证、附件、联系人")).toBeVisible();
});

const mobileViewportMatrix = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x700", width: 390, height: 700 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 },
];

test("keeps the mobile home surface visible without horizontal overflow or overlaps", async ({
  page,
}) => {
  await expect(page.locator(".vault-sidebar")).toBeHidden();
  await expect(page.locator(".top-actions")).toBeHidden();
  await expect(page.getByPlaceholder("搜索护照、签证、附件、联系人")).toBeVisible();

  const mobileNav = page.getByRole("navigation", { name: "移动端主导航" });
  const home = page.getByRole("region", { name: "首页任务摘要" });
  const tasks = home.locator(".task-entry");
  const statuses = home.locator(".status-card");
  const travelButtons = home.locator(".travel-check-list button");
  const aiSafety = page.getByRole("region", { name: "AI 安全状态" });
  const citedAnswer = page.getByRole("region", { name: "引用式 AI 问答" });

  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole("button", { name: "首页" })).toBeVisible();
  await expect(mobileNav.getByRole("button", { name: "关系图" })).toBeVisible();
  await expect(mobileNav.getByRole("button", { name: "详情" })).toBeVisible();
  await expect(mobileNav.getByRole("button", { name: /收集箱/ })).toBeVisible();
  await expect(mobileNav.getByRole("button", { name: "设置" })).toBeVisible();
  await expect(home.getByRole("button", { name: /找资料/ })).toBeVisible();
  await expect(home.getByRole("button", { name: /新增资料/ })).toBeVisible();
  await expect(home.getByRole("button", { name: /出行检查/ })).toBeVisible();
  await expect(home.getByRole("button", { name: "13 已保存" })).toBeVisible();
  await expect(home.locator(".travel-check-card").getByText("出行检查", { exact: true }))
    .toBeVisible();
  await expect(aiSafety.getByRole("heading", { name: "AI 安全状态" })).toBeVisible();
  await expect(citedAnswer.getByText("引用式问答")).toBeVisible();

  await expectInViewport(page, page.getByPlaceholder("搜索护照、签证、附件、联系人"));
  await expectInViewport(page, home.getByRole("button", { name: /找资料/ }));
  await expectInViewport(page, home.getByRole("button", { name: "13 已保存" }));
  await expectInViewport(
    page,
    home.locator(".travel-check-card").getByText("出行检查", { exact: true }),
  );
  await expectInViewport(page, aiSafety.getByRole("heading", { name: "AI 安全状态" }));
  await expectInViewport(page, citedAnswer.getByText("引用式问答"));

  await expectNoHorizontalOverflow(page);
  await expectNoEffectiveOverlap(page, [
    ...await visibleBoxes(tasks),
    ...await visibleBoxes(statuses),
    ...await visibleBoxes(travelButtons),
    ...await visibleBoxes(mobileNav.locator("button")),
  ]);
});

for (const viewport of mobileViewportMatrix) {
  test(`keeps the mobile shell usable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.reload();
    await expect(page.getByPlaceholder("搜索护照、签证、附件、联系人")).toBeVisible();

    const mobileNav = page.getByRole("navigation", { name: "移动端主导航" });
    await expect(page.locator(".vault-sidebar")).toBeHidden();
    await expect(page.locator(".top-actions")).toBeHidden();
    await expect(mobileNav).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoEffectiveOverlap(page, await visibleBoxes(mobileNav.locator("button")));

    await mobileNav.getByRole("button", { name: "首页" }).click();
    await expect(page.getByRole("region", { name: "首页任务摘要" })
      .getByRole("button", { name: /找资料/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "AI 安全状态" })).toBeVisible();

    await mobileNav.getByRole("button", { name: "关系图" }).click();
    await expect(page.getByRole("group", { name: "移动端图谱操作" })).toBeVisible();
    await expectGraphInViewport(page);
    await expectSelectorsDoNotOverlap(page, ".mobile-graph-guide", ".mobile-bottom-nav");

    await page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ }).click();
    const detailSheet = page.locator(".detail-panel.mobile-open");
    await expect(detailSheet.getByRole("heading", { name: "护照" })).toBeVisible();
    await expect(detailSheet).toContainText("关联笔记");
    await expect(detailSheet).toContainText("附件");
    await expectSelectorsDoNotOverlap(page, ".detail-panel.mobile-open", ".mobile-bottom-nav");
    await expectNoHorizontalOverflow(page);
  });
}

test("keeps the mobile home task buttons usable", async ({ page }) => {
  const home = page.getByRole("region", { name: "首页任务摘要" });
  const searchInput = page.getByPlaceholder("搜索护照、签证、附件、联系人");

  await page.getByRole("navigation", { name: "移动端主导航" })
    .getByRole("button", { name: "首页" })
    .click();
  await expect(home).toBeVisible();
  await home.getByRole("button", { name: /找资料/ }).click();
  await expect(searchInput).toHaveValue("护照");

  await searchInput.fill("");
  await page.getByRole("navigation", { name: "移动端主导航" })
    .getByRole("button", { name: "首页" })
    .click();
  await expect(home).toBeVisible();
  await home.getByRole("button", { name: /新增资料/ }).click();
  await expect(page.getByRole("heading", { name: "收集箱" })).toBeVisible();
  await expect(page.locator(".inbox-form").getByLabel("标题")).toBeVisible();

  await openFreshHome(page);
  await home.locator(".travel-check-list").getByRole("button", { name: /旅行清单/ }).click();
  await expect(page.getByRole("button", { name: /旅行清单，拖拽可调整图谱位置/ }))
    .toHaveClass(/active/);
});

test("opens mobile graph, detail sheet, inbox and settings from bottom navigation", async ({
  page,
}) => {
  const mobileNav = page.getByRole("navigation", { name: "移动端主导航" });
  const graphActions = page.getByRole("group", { name: "移动端图谱操作" });

  await mobileNav.getByRole("button", { name: "首页" }).click();
  await expectInViewport(page, page.getByRole("region", { name: "首页任务摘要" })
    .getByRole("button", { name: /找资料/ }));

  await mobileNav.getByRole("button", { name: "关系图" }).click();
  await expect(graphActions).toBeVisible();
  await expect(graphActions).toContainText("拖动画布看全图，松手可惯性滑动，拖动节点整理位置，双指缩放");
  await expectGraphInViewport(page);
  await expectNoHorizontalOverflow(page);
  await expectSelectorsDoNotOverlap(page, ".mobile-graph-guide", ".mobile-bottom-nav");

  await page.getByRole("button", { name: /身份证，拖拽可调整图谱位置/ }).click();
  const detailSheet = page.locator(".detail-panel.mobile-open");
  await expect(detailSheet).toBeVisible();
  await expect(detailSheet.getByRole("heading", { name: "身份证" })).toBeVisible();
  await expect(detailSheet).toContainText("资料状态");
  await expect(detailSheet).toContainText("标签");
  await expect(detailSheet).toContainText("关联笔记");
  await expect(detailSheet).toContainText("附件");
  await expectSelectorsDoNotOverlap(page, ".detail-panel.mobile-open", ".mobile-bottom-nav");

  await detailSheet.getByRole("button", { name: "关闭资料详情" }).click();
  await expect(page.locator(".detail-panel.mobile-open")).toHaveCount(0);
  await expect(mobileNav).toBeVisible();

  await mobileNav.getByRole("button", { name: "详情" }).click();
  await expect(page.locator(".detail-panel.mobile-open")
    .getByRole("heading", { name: "身份证" })).toBeVisible();

  await mobileNav.getByRole("button", { name: /收集箱/ }).click();
  await expect(page.getByRole("heading", { name: "收集箱" })).toBeVisible();
  await expect(page.locator(".detail-panel.mobile-open")).toHaveCount(0);

  await mobileNav.getByRole("button", { name: "设置" }).click();
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  await expect(page.locator(".detail-panel.mobile-open")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("keeps mobile detail summary and edit shortcuts usable", async ({ page }) => {
  const mobileNav = page.getByRole("navigation", { name: "移动端主导航" });

  await mobileNav.getByRole("button", { name: "关系图" }).click();
  await page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ }).click();

  const detailSheet = page.locator(".detail-panel.mobile-open");
  const summary = detailSheet.getByLabel("移动端详情摘要");
  const shortcuts = detailSheet.getByLabel("移动端详情快捷编辑");

  await expect(detailSheet.getByRole("heading", { name: "护照" })).toBeVisible();
  await expect(summary).toBeVisible();
  await expect(summary.getByText(/状态：/)).toBeVisible();
  await expect(summary.getByText(/隐私：/)).toBeVisible();
  await expect(summary.getByText(/AI：/)).toBeVisible();
  await expect(summary.getByText("附件：2")).toBeVisible();
  await expect(summary.getByText("关系：")).toBeVisible();
  await expect(summary.getByText("来源：")).toBeVisible();
  await expect(shortcuts).toBeVisible();
  await expect(shortcuts.getByRole("button", { name: "标签" })).toBeVisible();
  await expect(shortcuts.getByRole("button", { name: "关系" })).toBeVisible();
  await expect(shortcuts.getByRole("button", { name: "附件" })).toBeVisible();
  await expect(shortcuts.getByRole("button", { name: "来源" })).toBeVisible();
  await expect(shortcuts.getByRole("button", { name: "正文" })).toBeVisible();

  await shortcuts.getByRole("button", { name: "标签" }).click();
  const tagForm = detailSheet.locator(".tag-form");
  await expect(tagForm.getByRole("textbox", { name: "新增标签" })).toBeVisible();
  await tagForm.getByRole("textbox", { name: "新增标签" }).fill("快捷标签");
  await tagForm.getByRole("button", { name: "保存" }).click();
  await expect(detailSheet.locator(".tag-chips").filter({ hasText: "快捷标签" })).toBeVisible();

  await shortcuts.getByRole("button", { name: "关系" }).click();
  await expect(detailSheet.locator(".relationship-form")).toBeVisible();
  await expect(detailSheet.getByText("目标资料", { exact: true })).toBeVisible();

  await shortcuts.getByRole("button", { name: "附件" }).click();
  await expect(detailSheet.locator(".attachment-form")).toBeVisible();
  await expect(detailSheet.getByRole("button", { name: "保存附件索引" })).toBeVisible();

  await shortcuts.getByRole("button", { name: "来源" }).click();
  const sourceForm = detailSheet.locator(".source-form");
  await expect(sourceForm.getByLabel("来源说明")).toBeVisible();
  await expect(sourceForm.getByRole("button", { name: "补充来源" })).toBeVisible();

  await shortcuts.getByRole("button", { name: "正文" }).click();
  await expect(detailSheet.getByRole("button", { name: "属性" })).toHaveClass(/active/);
  await expect(detailSheet.getByLabel("Markdown 内容")).toBeVisible();
  await expect(detailSheet.getByLabel("Markdown 内容")).toBeFocused();
  await detailSheet.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(shortcuts).toBeVisible();
  await expect(shortcuts.getByRole("button", { name: "标签" })).toBeVisible();
  await shortcuts.getByRole("button", { name: "标签" }).click();
  await expect(detailSheet.getByRole("button", { name: "概览" })).toHaveClass(/active/);
  await expect(tagForm.getByRole("textbox", { name: "新增标签" })).toBeVisible();

  await expectNoHorizontalOverflow(page);
  await expectSelectorsDoNotOverlap(page, ".detail-panel.mobile-open", ".mobile-bottom-nav");
  await expectSelectorsDoNotOverlap(page, ".mobile-detail-shortcuts", ".detail-tabs");

  await page.reload();
  await expect(page.getByPlaceholder("搜索护照、签证、附件、联系人")).toBeVisible();
  await mobileNav.getByRole("button", { name: "详情" }).click();
  await expect(page.locator(".detail-panel.mobile-open")
    .locator(".tag-chips")
    .filter({ hasText: "快捷标签" })).toBeVisible();
});

test("keeps mobile graph controls, node drag and detail edits usable", async ({ page }) => {
  const mobileNav = page.getByRole("navigation", { name: "移动端主导航" });
  const graphActions = page.getByRole("group", { name: "移动端图谱操作" });
  const passport = page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ });

  await mobileNav.getByRole("button", { name: "关系图" }).click();
  await expect(graphActions).toBeVisible();

  const zoomStatus = graphActions.getByRole("status");
  await expect(zoomStatus).toHaveText("当前缩放 100%");
  await expect(page.locator(".zoom-control")).toContainText("100%");
  await graphActions.getByRole("button", { name: "放大" }).click();
  await expect(zoomStatus).toHaveText("当前缩放 110%");
  await expect(page.locator(".zoom-control")).toContainText("110%");
  await graphActions.getByRole("button", { name: "缩小" }).click();
  await expect(zoomStatus).toHaveText("当前缩放 100%");
  await expect(page.locator(".zoom-control")).toContainText("100%");
  await graphActions.getByRole("button", { name: "放大" }).click();
  await graphActions.getByRole("button", { name: "复位" }).click();
  await expect(zoomStatus).toHaveText("当前缩放 100%");
  await expect(page.locator(".zoom-control")).toContainText("100%");
  await pinchGraph(page, { startDistance: 80, endDistance: 112 });
  await expect(zoomStatus).toHaveText("当前缩放 140%");
  await expect(page.locator(".zoom-control")).toContainText("140%");
  const afterPinchReleasePan = await graphPanStyle(passport);
  await page.waitForTimeout(180);
  const afterPinchWaitPan = await graphPanStyle(passport);
  expect(afterPinchWaitPan).toEqual(afterPinchReleasePan);
  await pinchGraph(page, { startDistance: 120, endDistance: 84 });
  await expect(zoomStatus).toHaveText("当前缩放 98%");
  await expect(page.locator(".zoom-control")).toContainText("98%");
  await graphActions.getByRole("button", { name: "复位" }).click();
  await expect(zoomStatus).toHaveText("当前缩放 100%");
  await expect(page.locator(".zoom-control")).toContainText("100%");

  const beforePan = await passport.boundingBox();
  expect(beforePan).not.toBeNull();
  await dragGraphCanvas(page, { dx: 44, dy: -32, steps: 4 });
  const afterPanRelease = await passport.boundingBox();
  expect(afterPanRelease).not.toBeNull();
  expect(Math.abs(afterPanRelease.x - beforePan.x) + Math.abs(afterPanRelease.y - beforePan.y))
    .toBeGreaterThan(30);
  await page.waitForTimeout(220);
  const afterPanInertia = await passport.boundingBox();
  expect(afterPanInertia).not.toBeNull();
  const afterPanInertiaStyle = await graphPanStyle(passport);
  expect(Math.abs(afterPanInertiaStyle.x) + Math.abs(afterPanInertiaStyle.y))
    .toBeGreaterThan(82);
  await graphActions.getByRole("button", { name: "复位" }).click();
  const afterPanReset = await passport.boundingBox();
  expect(afterPanReset).not.toBeNull();
  expect(Math.abs(afterPanReset.x - beforePan.x) + Math.abs(afterPanReset.y - beforePan.y))
    .toBeLessThan(6);

  await graphActions.getByRole("button", { name: "当前资料" }).click();
  const detailSheet = page.locator(".detail-panel.mobile-open");
  await expect(detailSheet.getByRole("heading", { name: "护照" })).toBeVisible();
  await expect(detailSheet).toContainText("资料状态");
  await detailSheet.getByRole("button", { name: "关闭资料详情" }).click();

  const beforeDrag = await passport.boundingBox();
  expect(beforeDrag).not.toBeNull();
  await page.mouse.move(
    beforeDrag.x + beforeDrag.width / 2,
    beforeDrag.y + beforeDrag.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    beforeDrag.x + beforeDrag.width / 2 + 34,
    beforeDrag.y + beforeDrag.height / 2 + 36,
    { steps: 8 },
  );
  await page.mouse.up();
  const afterDrag = await passport.boundingBox();
  expect(afterDrag).not.toBeNull();
  expect(Math.abs(afterDrag.x - beforeDrag.x) + Math.abs(afterDrag.y - beforeDrag.y))
    .toBeGreaterThan(10);

  await page.reload();
  await expect(page.getByPlaceholder("搜索护照、签证、附件、联系人")).toBeVisible();
  await mobileNav.getByRole("button", { name: "关系图" }).click();
  const afterReload = await passport.boundingBox();
  expect(afterReload).not.toBeNull();
  expect(Math.abs(afterReload.x - beforeDrag.x) + Math.abs(afterReload.y - beforeDrag.y))
    .toBeGreaterThan(10);

  await graphActions.getByRole("button", { name: "当前资料" }).click();
  await expect(detailSheet.getByRole("heading", { name: "护照" })).toBeVisible();

  const favoriteButton = detailSheet.getByRole("button", { name: "从收藏中移除当前资料" });
  await expect(favoriteButton).toHaveClass(/active/);
  await expect(favoriteButton).toHaveAttribute("aria-pressed", "true");
  await favoriteButton.click();
  const unfavoriteButton = detailSheet.getByRole("button", { name: "收藏当前资料" });
  await expect(unfavoriteButton).not.toHaveClass(/active/);
  await expect(unfavoriteButton).toHaveAttribute("aria-pressed", "false");
  await expect(detailSheet.getByText("已取消收藏。")).toBeVisible();
  await unfavoriteButton.click();
  await expect(detailSheet.getByRole("button", { name: "从收藏中移除当前资料" })).toHaveClass(/active/);
  await expect(detailSheet.getByText("已加入收藏。")).toBeVisible();

  await detailSheet.getByLabel("隐私级别").selectOption({ label: "低（可导出）" });
  await expect(detailSheet.getByText("隐私级别已保存到本地。")).toBeVisible();
  await expect(selectPriorityValue(detailSheet, "隐私")).toHaveText("低（可导出）");

  await detailSheet.getByRole("button", { name: "新增标签" }).click();
  const tagForm = detailSheet.locator(".tag-form");
  await tagForm.getByRole("textbox", { name: "新增标签" }).fill("手机端");
  await tagForm.getByRole("button", { name: "保存" }).click();
  await expect(detailSheet.locator(".tag-chips").filter({ hasText: "手机端" })).toBeVisible();

  await detailSheet.getByRole("button", { name: "属性" }).click();
  await detailSheet.getByLabel("Markdown 内容").fill("手机端编辑后的护照资料");
  await expect(detailSheet.getByText("Markdown 已自动保存到本地。")).toBeVisible();
  await expect(detailSheet.getByLabel("Markdown 内容")).toHaveValue("手机端编辑后的护照资料");

  await page.reload();
  await expect(page.getByPlaceholder("搜索护照、签证、附件、联系人")).toBeVisible();
  await mobileNav.getByRole("button", { name: "详情" }).click();
  await expect(detailSheet.getByRole("heading", { name: "护照" })).toBeVisible();
  await expect(selectPriorityValue(detailSheet, "隐私")).toHaveText("低（可导出）");
  await expect(detailSheet.getByRole("button", { name: "从收藏中移除当前资料" })).toHaveClass(/active/);
  await detailSheet.getByRole("button", { name: "概览" }).click();
  await expect(detailSheet.locator(".tag-chips").filter({ hasText: "手机端" })).toBeVisible();
  await detailSheet.getByRole("button", { name: "属性" }).click();
  await expect(detailSheet.getByLabel("Markdown 内容")).toHaveValue("手机端编辑后的护照资料");
  await expectNoHorizontalOverflow(page);
  await expectSelectorsDoNotOverlap(page, ".detail-panel.mobile-open", ".mobile-bottom-nav");
});

async function openFreshHome(page) {
  await page.reload();
  await page.getByRole("navigation", { name: "移动端主导航" })
    .getByRole("button", { name: "首页" })
    .click();
  await expect(page.getByRole("region", { name: "首页任务摘要" })).toBeVisible();
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);
  expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewportWidth);
}

async function pinchGraph(page, { startDistance, endDistance }) {
  const graph = page.locator(".graph-canvas");
  const box = await graph.boundingBox();
  expect(box).not.toBeNull();

  await graph.evaluate((element, gesture) => {
    const centerX = gesture.left + gesture.width / 2;
    const centerY = gesture.top + gesture.height / 2;

    function fire(type, pointerId, x, y) {
      element.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType: "touch",
        clientX: x,
        clientY: y,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
      }));
    }

    fire("pointerdown", 81, centerX - gesture.startDistance / 2, centerY);
    fire("pointerdown", 82, centerX + gesture.startDistance / 2, centerY);
    fire("pointermove", 81, centerX - gesture.endDistance / 2, centerY);
    fire("pointermove", 82, centerX + gesture.endDistance / 2, centerY);
    fire("pointerup", 81, centerX - gesture.endDistance / 2, centerY);
    fire("pointerup", 82, centerX + gesture.endDistance / 2, centerY);
  }, {
    left: box.x,
    top: box.y,
    width: box.width,
    height: box.height,
    startDistance,
    endDistance,
  });
}

async function dragGraphCanvas(page, { dx, dy, steps = 1 }) {
  const graph = page.locator(".graph-canvas");
  const box = await graph.boundingBox();
  expect(box).not.toBeNull();

  await graph.evaluate((element, gesture) => {
    const startX = gesture.left + gesture.width / 2;
    const startY = gesture.top + gesture.height - 56;
    function fire(type, x, y) {
      element.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 91,
        pointerType: "touch",
        clientX: x,
        clientY: y,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
      }));
    }

    fire("pointerdown", startX, startY);
    for (let index = 1; index <= gesture.steps; index += 1) {
      fire(
        "pointermove",
        startX + (gesture.dx * index) / gesture.steps,
        startY + (gesture.dy * index) / gesture.steps,
      );
    }
    const endX = startX + gesture.dx;
    const endY = startY + gesture.dy;
    fire("pointerup", endX, endY);
  }, {
    left: box.x,
    top: box.y,
    width: box.width,
    height: box.height,
    dx,
    dy,
    steps,
  });
}

async function graphPanStyle(locator) {
  return locator.evaluate((element) => ({
    x: Number.parseFloat(element.style.getPropertyValue("--pan-x")) || 0,
    y: Number.parseFloat(element.style.getPropertyValue("--pan-y")) || 0,
  }));
}

async function expectInViewport(page, locator) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

async function expectGraphInViewport(page) {
  await expect.poll(async () => {
    const box = await page.locator(".graph-canvas").boundingBox();
    const viewport = page.viewportSize();

    if (!box || !viewport) return false;

    return box.x >= 0 && box.x + box.width <= viewport.width && box.y < viewport.height &&
      box.y + box.height > 0;
  }).toBe(true);
}

async function visibleBoxes(locator) {
  return locator.evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" &&
          rect.width > 0 && rect.height > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const label = element.textContent.trim().replace(/\s+/g, " ");

        return {
          label,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      }),
  );
}

async function expectNoEffectiveOverlap(page, boxes) {
  const overlaps = await page.evaluate((inputBoxes) => {
    const tolerance = 2;

    return inputBoxes.flatMap((first, firstIndex) =>
      inputBoxes.slice(firstIndex + 1).flatMap((second) => {
        const horizontal = Math.min(first.right, second.right) - Math.max(first.left, second.left);
        const vertical = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);

        if (horizontal > tolerance && vertical > tolerance) {
          return [`${first.label} overlaps ${second.label}`];
        }

        return [];
      }),
    );
  }, boxes);

  expect(overlaps).toEqual([]);
}

async function expectSelectorsDoNotOverlap(page, firstSelector, secondSelector) {
  await expect.poll(async () =>
    page.evaluate(([firstQuery, secondQuery]) => {
      const first = document.querySelector(firstQuery)?.getBoundingClientRect();
      const second = document.querySelector(secondQuery)?.getBoundingClientRect();

      if (!first || !second) return "missing";

      const vertical = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
      const horizontal = Math.min(first.right, second.right) - Math.max(first.left, second.left);

      return vertical > 2 && horizontal > 2 ? "overlap" : "";
    }, [firstSelector, secondSelector]),
  ).toBe("");
}

function selectPriorityValue(root, label) {
  return root.locator(".detail-priority-strip > div").filter({ hasText: label }).locator("strong");
}
