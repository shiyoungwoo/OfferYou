import { expect, test } from "@playwright/test";

test.describe("vNext create preview export flow", () => {
  test("creates a draft, generates a snapshot, and opens the preview page", async ({ page }) => {
    const uniqueSeed = Date.now();
    const company = `E2E测试公司 ${uniqueSeed}`;
    const jobTitle = "AI 产品经理";
    const jdContent = [
      "负责 AI 产品规划、需求拆解与跨团队协作。",
      "需要能够把复杂问题拆成可执行的下一步，并推动落地。"
    ].join("\n");
    const resumeContent = [
      "王小明",
      "AI 产品经理",
      "1. 负责过需求梳理和跨团队协作，推动多个模糊项目落地。",
      "2. 能把零散信息整理成可执行步骤，并沉淀成复用方法。"
    ].join("\n");

    await page.goto("/applications/new");
    await expect(page.getByRole("heading", { name: /先判断岗位值不值得投，再生成一版可导出的快照简历。/i })).toBeVisible();

    await page.getByLabel("目标岗位").fill(jobTitle);
    await page.getByLabel("目标公司").fill(company);
    await page.getByPlaceholder("粘贴当前简历正文，建议保留尽可能完整的事实材料。").fill(resumeContent);
    await page.getByPlaceholder("粘贴岗位描述、职责、要求与关键词。").fill(jdContent);

    await page.getByRole("button", { name: "进入差距分析与建议清单" }).click();

    await expect(page).toHaveURL(/\/applications\/[^/]+$/);
    await expect(page.getByText("分析工作台", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "确认并生成简历初版" })).toBeVisible();

    await page.getByRole("button", { name: "确认并生成简历初版" }).click();

    await expect(page).toHaveURL(/\/applications\/[^/]+\/preview$/);
    await expect(page.getByRole("button", { name: "确认无误后导出 PDF" })).toBeVisible();
    await expect(page.getByText("返回工作台")).toBeVisible();
    await expect(page.getByRole("button", { name: /编辑当前预览|收起编辑/ })).toBeVisible();
  });
});
