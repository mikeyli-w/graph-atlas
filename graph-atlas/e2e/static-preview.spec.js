import { expect, test } from "@playwright/test";

test("serves the built Graph Atlas bundle without a blank screen", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Graph Atlas").first()).toBeVisible();
  await expect(page.getByPlaceholder("搜索护照、签证、附件、联系人")).toBeVisible();

  await page.getByPlaceholder("搜索护照、签证、附件、联系人").fill("护照");
  await expect(page.getByRole("button", { name: /护照，拖拽可调整图谱位置/ })).toBeVisible();
});
