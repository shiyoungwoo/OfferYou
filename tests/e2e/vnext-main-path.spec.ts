import { expect, test } from "@playwright/test";

async function expectNoNextErrors(page: import("@playwright/test").Page) {
  await expect(page.getByText("Application error")).toHaveCount(0);
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
  await expect(page.getByText("Hydration failed")).toHaveCount(0);
}

test.describe("vNext main path smoke test", () => {
  test("opens the core product paths", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /先把简历改到能投，再把面试准备和天赋发现接上。/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "先修改简历" })).toBeVisible();
    await expect(page.getByRole("link", { name: "面试准备", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "发现自己", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "查看我的", exact: true })).toBeVisible();
    await expectNoNextErrors(page);

    await page.goto("/applications/new");
    await expect(page.getByRole("heading", { name: /先判断岗位值不值得投，再生成一版可导出的快照简历。/i })).toBeVisible();
    await expect(page.getByLabel("目标岗位")).toBeVisible();
    await expect(page.getByLabel("目标公司")).toBeVisible();
    await expect(page.getByRole("heading", { name: "输入当前简历，系统只会在快照层做岗位表达。" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "把招聘方真正看重的要求贴进来。" })).toBeVisible();
    await expectNoNextErrors(page);

    await page.goto("/talent");
    await expect(page.getByRole("heading", { name: /发现自己，比急着给自己贴标签更重要。/i })).toBeVisible();
    await expect(page.getByText("先看见自己，再沉淀长期资料")).toBeVisible();
    await expectNoNextErrors(page);

    await page.goto("/prep");
    await expect(page.getByRole("heading", { name: /从投递记录进入面试准备/i })).toBeVisible();
    await expect(page.locator("body")).toContainText(/当前还没有投递记录|可用记录/);
    await expectNoNextErrors(page);

    await page.goto("/master");
    await expect(page.getByRole("heading", { name: /把真实经历、洞察和可复用资料沉淀在这里。/i })).toBeVisible();
    await expectNoNextErrors(page);
  });
});
