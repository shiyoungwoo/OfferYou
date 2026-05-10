# OfferYou 产品可信度与 AI 主线修复执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **重要边界:** 本计划只允许修改 `/Users/wsyoung/Projects/OfferYou/github_release` 代码仓库。不得修改 Obsidian vault 中 OfferYou 之外的任何文件。不得修改简历模板视觉，除非本计划明确点名。

**Goal:** 修复 OfferYou 当前最影响产品可信度和 Agent-first 主线的偏差：事实校验污染、质量门禁不阻断、面试准备仍为规则模板、天赋 / Insight 空心化，以及低风险工程债。

**Architecture:** 先不做大规模 Agent Orchestrator 重构。当前阶段保持现有 Next.js + Service Layer 架构，只把关键可信度机制补齐：事实依据只来自用户材料，失败建议不能普通接受，AI 用在面试准备和天赋洞察，工程债按最小范围逐步清理。

**Tech Stack:** Next.js 15、React 19、TypeScript、Vitest、Playwright、SQLite、MiMo / OpenAI-compatible Model Gateway。

---

## 0. 全局执行规则

### 0.1 必须遵守

- [ ] 严格按批次顺序执行，不允许跳批。
- [ ] 每批只修改该批「允许修改文件」范围内的文件。
- [ ] 每批完成后运行该批指定验证命令。
- [ ] 任意验证失败，立刻停止，不继续后续批次。
- [ ] 不修改 `components/preview/template-professional-cn.tsx` 和 `components/preview/template-ats-clean.tsx`，除非后续用户明确要求。
- [ ] 不提交 `.env.local`、`storage/`、`.next/`、`node_modules/`、日志、SQLite 数据库、导出 PDF。
- [ ] 不把真实 API Key 写入源码、测试、文档或 Git。
- [ ] 不使用 `git add .`。如果需要提交，只能精确 add 本计划修改过的文件。

### 0.2 停止汇报格式

如果任何步骤失败，按以下格式汇报：

```markdown
## 阻塞停止

批次：批次 X - 名称
失败步骤：第 N 步
执行命令：`...`
失败现象：...
已修改文件：...
未继续执行的批次：X+1 至最后
建议下一步：...
```

### 0.3 全局验收命令

最终批次必须运行：

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm run test:pdf
pnpm run check:vnext
```

预期：

- TypeScript 0 错误。
- 默认测试通过。
- PDF / job-apply 相关测试通过。
- `check:vnext` 通过。

---

## 1. 执行总览

| 批次 | 目标 | 优先级 | 是否允许改模板 |
|---|---|---|---|
| 0 | 建立基线与防越界检查 | P0 | 否 |
| 1 | 修复事实校验污染 | P0 | 否 |
| 2 | 质量门禁阻断 fail 建议 | P0 | 否 |
| 3 | 面试准备和自我介绍 AI 化 | P1 | 否 |
| 4 | 天赋发现 AI 化与 Insight Layer 落地 | P1 | 否 |
| 5 | 统一 JSON parser | P2 | 否 |
| 6 | 清理 Prisma 死代码 | P2 | 否 |
| 7 | `better-sqlite3` 参数化数据层迁移 | P2 | 否 |
| 8 | 上传 / 下载安全边界 | P2 | 否 |
| 9 | JobApplyRun 轻量编排准备 | P3 | 否 |
| 10 | 综合验证与交接报告 | P0 | 否 |

---

## 批次 0：建立基线与防越界检查

**目标:** 确认当前仓库状态、测试基线、敏感信息状态。  
**允许修改文件:** 无。  
**禁止:** 修改任何文件。

- [ ] **Step 0.1: 确认当前目录**

Run:

```bash
pwd
git rev-parse --show-toplevel
```

Expected:

- 两个输出都指向 `/Users/wsyoung/Projects/OfferYou/github_release`。

- [ ] **Step 0.2: 检查工作区状态**

Run:

```bash
git status --short
```

Expected:

- 记录当前已有改动。
- 如果存在大量无关改动，不要清理，不要 revert，只在最终报告说明。

- [ ] **Step 0.3: 检查敏感信息**

Run:

```bash
git grep -n "tp-" || true
git grep -n "MIMO_API_KEY=.*[A-Za-z0-9]" || true
git ls-files | rg "env|sqlite|\\.log$|storage|node_modules|\\.next" || true
```

Expected:

- 不应出现真实小米 API Key。
- 不应出现已跟踪的 `.env.local`、SQLite、日志、`.next`、`storage`、`node_modules`。

- [ ] **Step 0.4: 跑当前基线**

Run:

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm run check:vnext
```

Expected:

- 全部通过。
- 如果基线已失败，停止并按阻塞格式汇报，不进入批次 1。

---

## 批次 1：修复事实校验污染

**目标:** JD、公司名、岗位名不能作为候选人事实依据。  
**允许修改文件:**

- `lib/services/quality/fact-grounding.ts`
- `tests/unit/quality/fact-grounding.test.ts`

**禁止:**

- 不改 `resume-verifier.ts`。
- 不改建议生成策略。
- 不改 UI。

### 设计要求

事实依据 corpus 只允许包含：

- `beforeText`
- `reasonText` 中明确来自用户事实的内容，但如果不能区分，短期可保留现状。
- `resumeText`
- `masterFacts.text`
- `masterFacts.title`

事实依据 corpus 不允许包含：

- `jdText`
- `company`
- `jobTitle`

JD、公司名、岗位名仍可用于「岗位匹配」和「能力标签」，但不能用于证明候选人做过某事。

- [ ] **Step 1.1: 写失败测试：JD 数字不能作为事实依据**

Modify: `tests/unit/quality/fact-grounding.test.ts`

新增测试：

```ts
it("does not treat JD text as candidate fact evidence", () => {
  const result = checkFactGrounding({
    beforeText: "负责产品需求整理。",
    afterText: "带领 30 人团队完成 AI 产品上线。",
    jdText: "要求有带领 30 人团队经验。",
    resumeText: "负责产品需求整理。",
    masterFacts: []
  });

  expect(result.highRisk).toBe(true);
  expect(result.riskNotes.join("\n")).toContain("30");
});
```

- [ ] **Step 1.2: 写失败测试：公司和岗位不作为能力事实依据**

同文件新增测试：

```ts
it("does not use company or job title as evidence for candidate achievements", () => {
  const result = checkFactGrounding({
    beforeText: "负责需求文档。",
    afterText: "在目标公司完成 50% 转化提升。",
    company: "目标公司",
    jobTitle: "AI 产品经理",
    resumeText: "负责需求文档。",
    masterFacts: []
  });

  expect(result.highRisk).toBe(true);
});
```

- [ ] **Step 1.3: 运行测试确认失败**

Run:

```bash
pnpm test tests/unit/quality/fact-grounding.test.ts
```

Expected:

- 新增测试失败，证明当前实现确实把 JD / company / jobTitle 当成事实 corpus。

- [ ] **Step 1.4: 修改实现**

Modify: `lib/services/quality/fact-grounding.ts`

把 `buildCorpus` 中以下项移除：

```ts
input.jdText,
input.company ?? "",
input.jobTitle ?? "",
```

保留：

```ts
input.beforeText,
input.reasonText ?? "",
input.resumeText ?? "",
...(input.masterFacts ?? []).flatMap((fact) => [fact.text, fact.title ?? ""])
```

- [ ] **Step 1.5: 运行验证**

Run:

```bash
pnpm test tests/unit/quality/fact-grounding.test.ts
pnpm exec tsc --noEmit
```

Expected:

- 测试通过。
- TypeScript 通过。

---

## 批次 2：质量门禁阻断 fail 建议

**目标:** `verification.status === "fail"` 的建议不能被普通接受。用户必须编辑后确认或请求 AI 微调。  
**允许修改文件:**

- `lib/services/analysis/suggestion-action-service.ts`
- `components/applications/suggestion-list.tsx`
- `components/applications/suggestion-action-bar.tsx`
- `tests/integration/suggestions/suggestion-action-service.test.ts`
- `tests/unit/applications/suggestion-list.test.tsx`
- `tests/unit/applications/suggestion-list-editor.test.tsx`

**禁止:**

- 不改建议生成模型 prompt。
- 不改简历模板。
- 不改 Snapshot 合成。

### 产品规则

| verification.status | 页面状态 | 接受按钮 |
|---|---|---|
| `pass` | 正常 | 可直接接受 |
| `warn` | 显示风险 | 可接受 |
| `fail` | 高风险 | 禁止直接接受 |

`fail` 建议允许两种路径：

- 用户点击「编辑」，修改 `afterText` 后再确认。
- 用户点击「AI 微调」，生成新建议，新建议重新校验。

### 实现规则

- 如果 API 收到 `action: "accept"`，且 suggestion 的 `verification.status === "fail"`，并且没有 `afterText` 覆盖，则抛出中文错误。
- 错误文案：`这条建议未通过事实校验，请先编辑或要求 AI 微调后再确认。`
- 如果用户提交了 `afterText`，仍允许保存，但必须把状态标记为 `accepted`，并记录 `acceptedAfterText`。

- [ ] **Step 2.1: 写 service 测试**

Modify: `tests/integration/suggestions/suggestion-action-service.test.ts`

新增测试：

```ts
it("blocks accepting failed verification suggestions without manual edits", async () => {
  // 基于现有 test helper 创建 draft。
  // 找到一条 suggestion，把 verification 改为 { status: "fail", issues: ["事实缺少依据"] }。
  // 调用 applySuggestionAction({ action: "accept" })。
  // 断言 reject.toThrow("未通过事实校验")。
});
```

如果现有 helper 不便复用，则在测试中读取 draft 后手动 `saveWorkspaceDraft` 注入一条 fail suggestion。

- [ ] **Step 2.2: 写允许手动编辑后接受的测试**

同文件新增：

```ts
it("allows accepting failed verification suggestions when afterText is manually provided", async () => {
  // 同样准备 fail suggestion。
  // 调用 applySuggestionAction({ action: "accept", afterText: "用户手动确认后的表达" })。
  // 断言 status 为 accepted，acceptedAfterText 为手动文本。
});
```

- [ ] **Step 2.3: 运行测试确认失败**

Run:

```bash
pnpm test tests/integration/suggestions/suggestion-action-service.test.ts
```

Expected:

- 第一个新增测试失败。

- [ ] **Step 2.4: 修改 service 阻断逻辑**

Modify: `lib/services/analysis/suggestion-action-service.ts`

在 `if (input.action === "accept")` 内，设置 accepted 前加入：

```ts
const isFailedVerification = suggestion.verification?.status === "fail";
const hasManualOverride = Boolean(input.afterText?.trim());

if (isFailedVerification && !hasManualOverride) {
  throw new Error("这条建议未通过事实校验，请先编辑或要求 AI 微调后再确认。");
}
```

- [ ] **Step 2.5: 修改 UI 按钮状态**

Modify:

- `components/applications/suggestion-action-bar.tsx`
- `components/applications/suggestion-list.tsx`

要求：

- `fail` 建议的「接受」按钮禁用或改成「需编辑后确认」。
- 按钮下方或右侧显示短提示：`未通过事实校验，需编辑或 AI 微调。`
- 不显示内部术语 `verification`、`schema`、`fallback`。
- `warn` 建议仍可接受，但显示风险提示。

- [ ] **Step 2.6: 补组件测试**

Modify:

- `tests/unit/applications/suggestion-list.test.tsx`
- `tests/unit/applications/suggestion-list-editor.test.tsx`

新增断言：

- fail 建议不展示可点击的普通「接受」按钮，或按钮 disabled。
- fail 建议展示「需编辑后确认」提示。
- warn 建议仍允许接受。

- [ ] **Step 2.7: 运行验证**

Run:

```bash
pnpm test tests/integration/suggestions/suggestion-action-service.test.ts
pnpm test tests/unit/applications/suggestion-list.test.tsx tests/unit/applications/suggestion-list-editor.test.tsx
pnpm exec tsc --noEmit
```

Expected:

- 全部通过。

---

## 批次 3：面试准备和自我介绍 AI 化

**目标:** 面试准备和自我介绍从确定性模板升级为模型主路径，模型失败时明确回退并写入风险提示。  
**允许修改文件:**

- `lib/services/interview/interview-prep-service.ts`
- `tests/unit/interview/interview-prep-service.test.ts`
- `tests/integration/job-apply/job-apply-interview-prep.test.ts`
- `tests/unit/ai/model-gateway.test.ts`（仅当需要补 mock）

**禁止:**

- 不改面试准备 UI。
- 不改 PDF 模板。
- 不改导出逻辑。

### 设计要求

`createInterviewPrepFromRecord` 生成 prep 时：

- 优先调用 `callModelJSON`。
- 输入必须包含：
  - 公司。
  - 岗位。
  - JDInsight。
  - FinalResumeDraft / Snapshot 主要内容。
  - 已确认建议或 masterFactsUsed。
- 输出必须包含：
  - `selfIntroDraft`
  - `questions`
- 模型失败时可以使用当前模板函数兜底，但必须在 `InterviewPrepRecord` 中增加 `generationMode` 和 `riskNotes`。

### 类型变更

Modify `InterviewPrepRecord`：

```ts
generationMode?: "model" | "model_repaired" | "deterministic_fallback";
riskNotes?: string[];
modelProvider?: string;
```

`InterviewQuestion` 保持兼容，不要破坏现有 UI。

- [ ] **Step 3.1: 写模型成功测试**

Modify: `tests/unit/interview/interview-prep-service.test.ts`

新增 mock `callModelJSON` 的测试：

```ts
it("generates interview prep with model output when available", async () => {
  // mock callModelJSON 返回 selfIntroDraft 和 4 个问题。
  // 调用 createInterviewPrepFromRecord。
  // 断言 selfIntroDraft 来自模型。
  // 断言 questions 来自模型。
  // 断言 generationMode 为 model 或 model_repaired。
});
```

- [ ] **Step 3.2: 写模型失败回退测试**

同文件新增：

```ts
it("falls back to deterministic interview prep with readable risk note when model fails", async () => {
  // mock callModelJSON throw。
  // 调用 createInterviewPrepFromRecord。
  // 断言仍有 questions。
  // 断言 generationMode 为 deterministic_fallback。
  // 断言 riskNotes 包含「模型暂不可用」或同等中文提示。
});
```

- [ ] **Step 3.3: 运行测试确认失败**

Run:

```bash
pnpm test tests/unit/interview/interview-prep-service.test.ts
```

Expected:

- 新增测试失败。

- [ ] **Step 3.4: 实现模型生成函数**

Modify: `lib/services/interview/interview-prep-service.ts`

新增函数：

```ts
async function buildInterviewPrepWithModel(input: {
  record: NonNullable<Awaited<ReturnType<typeof readApplicationRecord>>>;
  draft: NonNullable<Awaited<ReturnType<typeof readWorkspaceDraft>>>;
  snapshot: ResumeDocument | null;
  prepId: string;
}): Promise<Pick<InterviewPrepRecord, "selfIntroDraft" | "questions" | "generationMode" | "riskNotes" | "modelProvider">>
```

实现要求：

- 调用 `callModelJSON`。
- task 使用 `"interview"` 或现有可用 task 类型；如果类型不支持，先使用最接近的任务类型，不新增大范围类型重构。
- system prompt 明确：
  - 只能基于已确认快照和 JD。
  - 不编造公司、学历、项目结果。
  - 输出 5 到 8 个问题。
  - 自我介绍 60 到 90 秒。
- JSON schema 轻量约束：

```ts
type ModelInterviewPrepOutput = {
  selfIntroDraft: string;
  questions: Array<{
    questionText: string;
    sourceType?: InterviewQuestionSourceType;
    sourceRef?: string;
    answerDraft?: string;
  }>;
};
```

- [ ] **Step 3.5: 接入 createInterviewPrepFromRecord**

在创建 `prep` 前调用模型函数。

伪代码：

```ts
const generated = await buildInterviewPrepWithModel({ record, draft, snapshot, prepId: `interview-${record.id}` })
  .catch(() => buildDeterministicInterviewPrep(...));
```

保留当前 `buildInterviewQuestions` 和 `buildSelfIntroDraft` 作为 fallback。

- [ ] **Step 3.6: 运行验证**

Run:

```bash
pnpm test tests/unit/interview/interview-prep-service.test.ts
pnpm test tests/integration/job-apply/job-apply-interview-prep.test.ts --pool forks --maxWorkers 1
pnpm exec tsc --noEmit
```

Expected:

- 全部通过。

---

## 批次 4：天赋发现 AI 化与 Insight Layer 落地

**目标:** 天赋发现不再只是关键词匹配，至少能用模型生成可保存的 Insight，并允许岗位匹配引用。  
**允许修改文件:**

- `lib/services/talent/talent-profile.ts`
- `lib/services/talent/talent-profile-service.ts`
- `lib/services/master/master-service.ts`
- `components/master/master-insight-list.tsx`
- `tests/unit/talent/talent-profile.test.ts`
- `tests/unit/talent/talent-profile-service.test.ts`
- `tests/unit/master/master-service.test.ts`

**禁止:**

- 不改天赋发现页面大布局。
- 不改简历模板。
- 不新增复杂职业陪伴 UI。

### 设计要求

短期目标不是完整职业陪伴，而是让 Insight Layer 不再空心化。

新增或补齐：

```ts
type MasterInsightSummary = {
  id: string;
  userId: string;
  title: string;
  insightText: string;
  evidenceFactIds: string[];
  status: "pending_confirmation" | "confirmed" | "rejected";
  createdAt: string;
  updatedAt: string;
};
```

### 数据存储策略

为了避免本批次变成数据库大迁移，允许短期把 Insight 存在现有 JSON payload 或新增轻量表。

推荐新增表：

```sql
CREATE TABLE IF NOT EXISTS master_insights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

如果新增表，需要在 `lib/db.ts` schema 中添加。注意：本批次还未迁移 `better-sqlite3`，仍按现有 db.ts 风格写。

- [ ] **Step 4.1: 写 master insight 测试**

Modify: `tests/unit/master/master-service.test.ts`

新增测试：

```ts
it("stores and lists confirmed master insights", async () => {
  // 调用新增 saveMasterInsight 或 confirmMasterInsight。
  // 再调用 listMasterInsights(userId)。
  // 断言返回对应 insight，不再是空数组。
});
```

- [ ] **Step 4.2: 实现 Insight 存取**

Modify: `lib/services/master/master-service.ts`

新增：

```ts
export async function saveMasterInsight(input: {
  userId: string;
  title: string;
  insightText: string;
  evidenceFactIds: string[];
  status?: "pending_confirmation" | "confirmed" | "rejected";
}): Promise<MasterInsightSummary>
```

修改 `listMasterInsights`：

- 从数据库读取。
- JSON 解析失败时跳过损坏项并返回风险日志，或复用 `parseJsonPayload`。
- 不再返回空数组。

- [ ] **Step 4.3: 天赋发现模型输出 Insight**

Modify:

- `lib/services/talent/talent-profile.ts`
- `lib/services/talent/talent-profile-service.ts`

要求：

- 保留当前规则版作为 fallback。
- 优先调用模型生成：
  - 3 到 5 条个人优势。
  - 每条优势的证据。
  - 可迁移到岗位定制的能力标签。
- 模型失败时 `generationMode = "deterministic_fallback"` 并写中文 `riskNotes`。
- 确认天赋画像时，把高置信优势写入 `master_insights`。

- [ ] **Step 4.4: 更新 Master Insight UI**

Modify: `components/master/master-insight-list.tsx`

要求：

- 如果有 insight，展示 title、insightText、status。
- 如果没有 insight，显示：`暂无已确认洞察。完成天赋发现后，可在这里沉淀可复用优势。`
- 不显示内部技术术语。

- [ ] **Step 4.5: 运行验证**

Run:

```bash
pnpm test tests/unit/master/master-service.test.ts
pnpm test tests/unit/talent/talent-profile.test.ts tests/unit/talent/talent-profile-service.test.ts
pnpm exec tsc --noEmit
```

Expected:

- 全部通过。

---

## 批次 5：统一 JSON parser

**目标:** 消除 AI JSON 提取逻辑重复，统一到 `lib/ai/json-parser.ts`。  
**允许修改文件:**

- `lib/ai/json-parser.ts`（新增）
- `lib/ai/model-gateway.ts`
- `lib/ai/openai-compatible-client.ts`
- `lib/ai/gemini-client.ts`
- `tests/unit/ai/json-parser.test.ts`（新增）
- `tests/unit/ai/model-gateway.test.ts`
- `tests/unit/ai/openai-compatible-client.test.ts`

**禁止:**

- 不改 provider 配置行为。
- 不改模型选择策略。

### 设计要求

从 `model-gateway.ts` 提取当前最稳的逻辑：

- `stripMarkdown`
- `extractFirstJsonValue`
- `parseLooseJSON`

导出：

```ts
export function stripMarkdown(text: string): string
export function extractFirstJsonValue(text: string): string | null
export function parseLooseJSON<T = unknown>(text: string): T
```

- [ ] **Step 5.1: 创建 json-parser 测试**

Create: `tests/unit/ai/json-parser.test.ts`

覆盖：

- 纯 JSON object。
- Markdown fenced JSON。
- 前后有中文说明的 JSON。
- 嵌套 object / array。
- 无效 JSON 抛中文错误或标准错误。

- [ ] **Step 5.2: 创建 `lib/ai/json-parser.ts`**

从 `model-gateway.ts` 移出逻辑，保持行为不变。

- [ ] **Step 5.3: 替换调用**

Modify:

- `lib/ai/model-gateway.ts`
- `lib/ai/openai-compatible-client.ts`
- `lib/ai/gemini-client.ts`

删除重复实现，统一 import。

- [ ] **Step 5.4: 运行验证**

Run:

```bash
pnpm test tests/unit/ai/json-parser.test.ts tests/unit/ai/model-gateway.test.ts tests/unit/ai/openai-compatible-client.test.ts
pnpm exec tsc --noEmit
```

Expected:

- 全部通过。

---

## 批次 6：清理 Prisma 死代码

**目标:** 删除未使用 Prisma 轨道，避免后续 Agent 误以为项目使用 Prisma。  
**允许修改文件:**

- `package.json`
- `pnpm-lock.yaml`
- `prisma/schema.prisma`
- `README.md`（仅当有 Prisma 说明需要删除）
- `docs/plans/2026-05-05-low-model-product-trust-ai-mainline-plan.md`（仅记录完成状态，不强制）

**禁止:**

- 不改运行时数据库表结构。
- 不改 `lib/db.ts`，留到批次 7。

### 设计要求

- 删除 `prisma/schema.prisma`。
- 从 `package.json` 删除：
  - scripts: `prisma:generate`
  - scripts: `prisma:migrate:dev`
  - dependencies: `@prisma/client`
  - devDependencies: `prisma`
- 运行 `pnpm install` 更新 lockfile。

- [ ] **Step 6.1: 检查 Prisma 引用**

Run:

```bash
rg -n "prisma|@prisma/client|prisma:" .
```

Expected:

- 只应看到 package、lock、schema 或文档引用。
- 如果 lib/app/tests 中存在运行时 import，停止汇报，不执行删除。

- [ ] **Step 6.2: 删除 schema**

Delete:

- `prisma/schema.prisma`

如果 `prisma/` 目录为空，可删除目录。

- [ ] **Step 6.3: 修改 package.json**

删除 Prisma 相关脚本和依赖。

- [ ] **Step 6.4: 更新 pnpm-lock**

Run:

```bash
pnpm install
```

Expected:

- 安装成功。
- `pnpm-lock.yaml` 更新。

- [ ] **Step 6.5: 验证**

Run:

```bash
rg -n "prisma|@prisma/client|prisma:" package.json lib app tests || true
pnpm exec tsc --noEmit
pnpm test tests/unit/db.test.ts
```

Expected:

- 无运行时代码引用 Prisma。
- TypeScript 通过。
- DB 单测通过。

---

## 批次 7：`better-sqlite3` 参数化数据层迁移

**目标:** 用 `better-sqlite3` 替换 `sqlite3` CLI，保留现有表和服务接口，逐步获得参数化查询能力。  
**允许修改文件:**

- `package.json`
- `pnpm-lock.yaml`
- `lib/db.ts`
- `tests/unit/db.test.ts`
- 使用 `executeSql/querySql/sqlString` 的 service 文件，只有在必要时才改：
  - `lib/services/analysis/workspace-repository.ts`
  - `lib/services/snapshot/snapshot-service.ts`
  - `lib/services/applications/application-record-service.ts`
  - `lib/services/interview/interview-prep-service.ts`
  - `lib/services/master/master-service.ts`
  - `lib/services/talent/talent-profile-service.ts`
  - `lib/services/talent/career-navigation.ts`

**禁止:**

- 不改业务逻辑。
- 不改表名。
- 不迁移历史数据结构。

### 分阶段策略

为了降低风险，保留现有公共 API：

```ts
executeSql(sql: string): Promise<void>
querySql<T>(sql: string): Promise<T[]>
sqlString(value: string): string
```

同时新增参数化 API：

```ts
executeSqlParams(sql: string, params?: SqlParam[]): Promise<void>
querySqlParams<T>(sql: string, params?: SqlParam[]): Promise<T[]>
```

本批次最低验收：

- `db.ts` 不再调用 `execFile("sqlite3", ...)`。
- 新增参数化 API。
- 至少 `interview-prep-service.ts` 和 `master-service.ts` 改用参数化 API。
- 旧 API 保留兼容，后续再逐步替换。

- [ ] **Step 7.1: 安装依赖**

Run:

```bash
pnpm add better-sqlite3
pnpm add -D @types/better-sqlite3
```

Expected:

- 安装成功。
- `package.json` 和 `pnpm-lock.yaml` 更新。

如果网络或编译失败，停止汇报。

- [ ] **Step 7.2: 写参数化 DB 测试**

Modify: `tests/unit/db.test.ts`

新增：

```ts
it("supports parameterized insert and query with quotes", async () => {
  await executeSqlParams(
    "INSERT INTO master_facts (id, user_id, title, summary, block_type) VALUES (?, ?, ?, ?, ?)",
    ["fact-param-1", "user-1", "O'Reilly 项目", "包含 ' 单引号", "project"]
  );

  const rows = await querySqlParams<{ title: string; summary: string }>(
    "SELECT title, summary FROM master_facts WHERE id = ?",
    ["fact-param-1"]
  );

  expect(rows[0].title).toBe("O'Reilly 项目");
});
```

- [ ] **Step 7.3: 实现 better-sqlite3 连接**

Modify: `lib/db.ts`

要求：

- 使用 `Database` from `better-sqlite3`。
- `getDatabasePath()` 保持不变。
- `ensureDatabase()` 保持 async 形式，避免大范围调用点改动。
- schema 初始化继续使用同一段 SQL。
- 设置 busy timeout：

```ts
db.pragma(`busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
```

新增：

```ts
export type SqlParam = string | number | null | boolean;
export async function executeSqlParams(sql: string, params: SqlParam[] = []) { ... }
export async function querySqlParams<T>(sql: string, params: SqlParam[] = []): Promise<T[]> { ... }
```

保留：

```ts
export async function executeSql(sql: string) { ... }
export async function querySql<T>(sql: string): Promise<T[]> { ... }
export function sqlString(value: string) { ... }
```

但旧 API 内部也通过 better-sqlite3 执行。

- [ ] **Step 7.4: 迁移至少两个服务到参数化 API**

Modify:

- `lib/services/interview/interview-prep-service.ts`
- `lib/services/master/master-service.ts`

把新增 / 改动过的 SQL 优先迁移：

```ts
await executeSqlParams(
  `INSERT INTO ... VALUES (?, ?, ?)`,
  [value1, value2, value3]
);
```

查询：

```ts
await querySqlParams<{ payload_json: string }>(
  "SELECT payload_json FROM interview_preps WHERE id = ? LIMIT 1",
  [prepId]
);
```

- [ ] **Step 7.5: 运行验证**

Run:

```bash
pnpm test tests/unit/db.test.ts
pnpm test tests/unit/interview/interview-prep-service.test.ts tests/unit/master/master-service.test.ts
pnpm exec tsc --noEmit
pnpm test
```

Expected:

- 全部通过。

---

## 批次 8：上传 / 下载安全边界

**目标:** 给文件上传和下载补最小安全约束，避免本地文件被误读或磁盘被耗尽。  
**允许修改文件:**

- `app/api/uploads/ingest/route.ts`
- `app/api/records/[recordId]/download/route.ts`
- `lib/storage/local-storage-adapter.ts`
- `tests/integration/storage/local-storage-adapter.test.ts`
- 新增测试文件：
  - `tests/unit/api/upload-route.test.ts`（如现有测试架构支持）
  - `tests/unit/api/download-route.test.ts`（如现有测试架构支持）

**禁止:**

- 不改前端上传 UI。
- 不改 PDF 导出路径格式，除非为目录约束所需。

### 设计要求

上传：

- 限制文件大小，建议 10 MB。
- MIME / 扩展名白名单：
  - PDF
  - DOCX
  - TXT
  - PNG / JPG / JPEG（如果当前支持图片）
- 超限返回中文错误。

下载：

- 只能读取 storage adapter 管理目录下的文件。
- 禁止 `../` 路径遍历。
- 禁止绝对路径越界。

- [ ] **Step 8.1: 检查现有上传实现**

Run:

```bash
nl -ba app/api/uploads/ingest/route.ts | sed -n '1,220p'
nl -ba app/api/records/[recordId]/download/route.ts | sed -n '1,220p'
nl -ba lib/storage/local-storage-adapter.ts | sed -n '1,240p'
```

- [ ] **Step 8.2: 给 LocalStorageAdapter 增加路径约束测试**

Modify: `tests/integration/storage/local-storage-adapter.test.ts`

新增：

```ts
it("rejects paths outside the storage root", async () => {
  // 如果 adapter 暴露 read/download 方法，则传入 ../../etc/passwd。
  // 断言抛出中文错误或返回拒绝。
});
```

- [ ] **Step 8.3: 实现目录约束**

Modify: `lib/storage/local-storage-adapter.ts`

新增 helper：

```ts
function assertInsideStorageRoot(root: string, targetPath: string) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(targetPath);
  if (!resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`) && resolvedTarget !== resolvedRoot) {
    throw new Error("文件路径超出允许范围。");
  }
}
```

在所有读取 / 写入 / 下载路径前调用。

- [ ] **Step 8.4: 上传接口增加大小和类型限制**

Modify: `app/api/uploads/ingest/route.ts`

新增常量：

```ts
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg"]);
```

逻辑：

- `file.size > MAX_UPLOAD_BYTES` 返回 400。
- 扩展名不在白名单返回 400。
- 错误文案中文。

- [ ] **Step 8.5: 下载接口约束**

Modify: `app/api/records/[recordId]/download/route.ts`

要求：

- 不直接信任数据库里的 path。
- 通过 storage adapter 的受控 read 方法读取。
- 如果当前只能读绝对路径，则先检查路径在 storage root 内。

- [ ] **Step 8.6: 运行验证**

Run:

```bash
pnpm test tests/integration/storage/local-storage-adapter.test.ts
pnpm exec tsc --noEmit
```

如果新增 API route 单测：

```bash
pnpm test tests/unit/api/upload-route.test.ts tests/unit/api/download-route.test.ts
```

Expected:

- 全部通过。

---

## 批次 9：JobApplyRun 轻量编排准备

**目标:** 不做五个完整 Agent 类，只把现有状态回放升级为可承接编排的轻量 Run 控制契约。  
**允许修改文件:**

- `lib/services/job-apply/agent-run.ts`
- `lib/services/job-apply/job-apply-run-service.ts`
- `tests/unit/job-apply/agent-run.test.ts`
- 新增：`tests/unit/job-apply/job-apply-run-service.test.ts`（如不存在）

**禁止:**

- 不改 API route。
- 不改 UI。
- 不重排现有服务。

### 设计要求

当前 `job-apply-run-service.ts` 是状态回放器。这个批次只做轻量准备：

- 明确 nextAction。
- 明确 blockingReason。
- 明确 generationMode。
- 明确是否需要人工确认。

新增类型：

```ts
type JobApplyNextAction =
  | "confirm_resume_calibration"
  | "review_suggestions"
  | "sync_snapshot"
  | "export_pdf"
  | "prepare_interview"
  | "check_model_config"
  | "done";
```

`JobApplyRun` 增加：

```ts
nextAction?: JobApplyNextAction;
blockingReason?: string;
needsHumanConfirmation?: boolean;
```

- [ ] **Step 9.1: 写状态判断测试**

Modify / Create:

- `tests/unit/job-apply/agent-run.test.ts`
- `tests/unit/job-apply/job-apply-run-service.test.ts`

覆盖：

- 未完成校准 → `confirm_resume_calibration`。
- 有 pending suggestions → `review_suggestions`。
- 建议已确认但 snapshot 过期 → `sync_snapshot`。
- snapshot ready → `export_pdf`。
- export ready → `prepare_interview`。
- interview ready → `done`。
- 模型失败 → `check_model_config`。

- [ ] **Step 9.2: 修改类型**

Modify: `lib/services/job-apply/agent-run.ts`

增加 `JobApplyNextAction` 和字段。

- [ ] **Step 9.3: 修改 service 推导 nextAction**

Modify: `lib/services/job-apply/job-apply-run-service.ts`

要求：

- 不调用新业务逻辑。
- 只根据现有 draft / snapshot / interview / risk 状态推导。
- 中文 `blockingReason` 不包含内部技术术语。

- [ ] **Step 9.4: 运行验证**

Run:

```bash
pnpm test tests/unit/job-apply/agent-run.test.ts
pnpm exec tsc --noEmit
```

如果新增 service 测试：

```bash
pnpm test tests/unit/job-apply/job-apply-run-service.test.ts
```

Expected:

- 全部通过。

---

## 批次 10：综合验证与交接报告

**目标:** 确认所有修改没有破坏主链路，并生成给用户和后续 Agent 的交接说明。  
**允许修改文件:**

- `docs/plans/2026-05-05-product-trust-ai-mainline-execution-report.md`（新增）
- `README.md`（仅当需要删除 Prisma 说明或更新模型配置说明）
- 不允许修改模板。

- [ ] **Step 10.1: 运行全量类型检查**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected:

- 通过。

- [ ] **Step 10.2: 运行默认测试**

Run:

```bash
pnpm test
```

Expected:

- 通过。

- [ ] **Step 10.3: 运行 PDF / job-apply 集成测试**

Run:

```bash
pnpm run test:pdf
```

Expected:

- 通过。

- [ ] **Step 10.4: 运行 vNext 检查**

Run:

```bash
pnpm run check:vnext
```

Expected:

- 通过。

- [ ] **Step 10.5: 检查敏感信息和运行产物**

Run:

```bash
git grep -n "tp-" || true
git grep -n "MIMO_API_KEY=.*[A-Za-z0-9]" || true
git status --short
git ls-files | rg "env|sqlite|\\.log$|storage|node_modules|\\.next" || true
```

Expected:

- 不出现真实 API Key。
- 不出现运行产物被跟踪。

- [ ] **Step 10.6: 写执行报告**

Create: `docs/plans/2026-05-05-product-trust-ai-mainline-execution-report.md`

内容必须包含：

```markdown
# OfferYou 产品可信度与 AI 主线修复执行报告

## 已完成批次

## 修改文件

## 验证命令与结果

## 产品行为变化

## 仍未处理的问题

## 后续建议
```

- [ ] **Step 10.7: 最终 git 状态**

Run:

```bash
git status --short
```

Expected:

- 只出现本计划允许修改的文件。
- 如果出现无关文件，停止，不提交，报告给用户。

---

## 11. 最终交付标准

执行完成后，必须满足：

- [ ] JD 不再作为候选人事实依据。
- [ ] `fail` 建议不能被普通接受。
- [ ] 面试准备优先走模型，失败时透明回退。
- [ ] 天赋发现能生成并保存 Master Insight。
- [ ] `listMasterInsights` 不再是空实现。
- [ ] JSON parser 只有一套主实现。
- [ ] Prisma 死代码已删除或明确不再存在。
- [ ] 数据库层开始支持参数化查询。
- [ ] 上传和下载有基础安全边界。
- [ ] JobApplyRun 能返回下一步动作。
- [ ] `pnpm exec tsc --noEmit` 通过。
- [ ] `pnpm test` 通过。
- [ ] `pnpm run test:pdf` 通过。
- [ ] `pnpm run check:vnext` 通过。
- [ ] 没有 API Key 和运行产物进入 Git。

---

## 12. 非目标

本计划不做：

- 不重做 Professional CN 或 ATS Clean 模板。
- 不调整简历颜色、排版、页头、项目符号。
- 不新增社区、批量投递、岗位扫描。
- 不做完整多用户认证系统。
- 不做五个独立 Agent 类的大重构。
- 不把 RewriteStrategy 全量交给 AI。
- 不迁移到 Prisma。
- 不把 Obsidian vault 其他目录纳入任何 Git 操作。

---

## 13. 推荐提交策略

如果用户要求 Git 同步，按批次或阶段提交：

```bash
git add lib/services/quality/fact-grounding.ts tests/unit/quality/fact-grounding.test.ts
git commit -m "fix: prevent JD text from grounding resume facts"
```

不要使用：

```bash
git add .
```

最终 tag 由用户决定。当前不要自动打 tag。

