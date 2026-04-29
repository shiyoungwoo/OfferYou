import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const requiredPaths = [
  ["页面文件", "app/applications/new/page.tsx"],
  ["页面文件", "app/talent/page.tsx"],
  ["页面文件", "app/prep/page.tsx"],
  ["投递记录服务", "lib/services/applications/application-record-service.ts"],
  ["面试准备服务", "lib/services/interview/interview-prep-service.ts"],
  ["自用验收清单", "docs/quality/offeryou-self-use-acceptance.md"],
  ["样本夹具", "tests/fixtures/job-apply/cases.ts"],
  ["样本质量测试", "tests/integration/job-apply/job-apply-quality.test.ts"],
  ["样本 PDF 测试", "tests/integration/job-apply/job-apply-pdf-export.test.ts"],
  ["样本面试测试", "tests/integration/job-apply/job-apply-interview-prep.test.ts"],
  ["PDF 命令执行器", "lib/services/ingestion/command-runner.ts"],
  ["PDF 解析测试", "tests/unit/ingestion/opendataloader-pdf.test.ts"],
  ["模型供应商状态卡", "components/me/model-provider-status-card.tsx"],
  ["面试准备导出卡", "components/interview/interview-prep-export-card.tsx"],
  ["OpenAI 兼容客户端", "lib/ai/openai-compatible-client.ts"],
  ["主链路 E2E", "tests/e2e/vnext-create-preview-export.spec.ts"],
  ["建议质量服务", "lib/services/quality/suggestion-quality.ts"],
  ["事实保真服务", "lib/services/quality/fact-grounding.ts"],
  ["模型任务配置", "lib/ai/model-task-config.ts"],
  ["结构校准类型", "lib/services/calibration/resume-calibration-types.ts"],
  ["结构校准服务", "lib/services/calibration/resume-calibration-service.ts"],
  ["终版草稿服务", "lib/services/snapshot/final-resume-draft-service.ts"],
  ["结构校准面板", "components/applications/resume-calibration-panel.tsx"],
  ["结构校准测试", "tests/unit/applications/resume-calibration-panel.test.tsx"],
  ["结构校准服务测试", "tests/unit/calibration/resume-calibration-service.test.ts"],
  ["终版草稿测试", "tests/unit/snapshot/final-resume-draft-service.test.ts"],
  ["三段式链路测试", "tests/integration/calibration/calibrated-draft-chain.test.ts"],
  ["三段式端到端测试", "tests/integration/job-apply/three-stage-resume-chain.test.ts"],
  ["模板文件", "components/preview/template-professional-cn.tsx"],
  ["模板文件", "components/preview/template-ats-clean.tsx"],
  ["自用 Beta 报告", "docs/quality/offeryou-beta-report.md"],
  ["模型网关", "lib/ai/model-gateway.ts"]
];

let failed = false;

for (const [label, relativePath] of requiredPaths) {
  const absolutePath = path.join(rootDir, relativePath);
  try {
    await access(absolutePath);
  } catch {
    failed = true;
    console.error(`缺少${label}：${relativePath}`);
  }
}

if (failed) {
  console.error("vNext 一致性检查未通过，请先补齐缺失文件。");
  process.exit(1);
}

console.log("vNext 一致性检查通过，核心链路文件齐备。");
