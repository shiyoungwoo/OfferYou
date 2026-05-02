# OfferYou V3.2 Core Hardening And AI-First Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 每完成一个批次必须运行该批验证命令；若任何验证失败，立即停止，不要继续后续批次。

**Goal:** 在不改动当前主链路和两套简历模板的前提下，修复稳定性、数据一致性和 AI 改写主引擎三类问题。

**Architecture:** 当前 V3.2 的产品壳、交互、预览和 PDF 模板已冻结。本计划只加固服务层、数据读取层、建议生成层和相关测试，禁止顺手调整 UI 版式、颜色、简历模板、导航和产品范围。AI 改写必须成为可验证的主路径：模型可用时使用模型结果，模型不可用时明确标记为确定性兜底，不再伪装成 AI。

**Tech Stack:** Next.js App Router, React 19, TypeScript, SQLite CLI, Vitest, Playwright for later manual verification.

---

## 0. 硬边界

### 0.1 不允许修改

- `components/preview/template-professional-cn.tsx`
- `components/preview/template-ats-clean.tsx`
- `components/preview/preview-workspace.tsx`
- `lib/services/export/preview-renderer.ts`
- `app/globals.css`
- 页面布局、颜色、页头、正文排版、PDF 导出样式
- `storage/`、`.env.local`、`.next/`、`node_modules/`、日志、SQLite 数据库、导出 PDF

如确实必须改上述文件，必须停止并按「阻塞格式」汇报，不能自行继续。

### 0.2 本计划暂不处理

- 认证系统
- 多人协作并发锁
- 全 JSON Blob 存储的数据库重构
- Community 页面、`template-a.tsx` 等历史残留删除
- 新模板、新页面、新功能

这些问题可以进入下一阶段，但不能混入本计划。

### 0.3 开始前命令

```bash
cd /Users/wsyoung/Projects/OfferYou/github_release
git status --short
git checkout main
git pull --ff-only
git checkout -b codex/offeryou-v3-2-core-hardening-ai-first
```

若 `git status --short` 有未提交内容，停止并汇报，不能覆盖他人改动。

---

## 1. 批次一：修复测试基线与 revisionRound NaN

**目标:** 先让当前测试断言回到产品真实状态，同时修复 `revisionRound` 可写入 `NaN` 的硬 bug。

**允许修改文件:**

- `lib/services/analysis/suggestion-action-service.ts`
- `tests/integration/suggestions/suggestion-action-service.test.ts`
- `tests/unit/preview/export-pdf-button.test.tsx`
- `tests/unit/applications/suggestion-list-editor.test.tsx`

### Task 1.1 更新两个旧 UI 文案测试

- [ ] 打开 `components/preview/export-pdf-button.tsx`，确认当前两页以上提示的真实文案。
- [ ] 修改 `tests/unit/preview/export-pdf-button.test.tsx`，断言当前真实文案或当前真实状态，不要为了测试恢复旧文案。
- [ ] 打开 `components/applications/suggestion-list.tsx`，确认「质量提示」是否已按产品要求隐藏或改名。
- [ ] 修改 `tests/unit/applications/suggestion-list-editor.test.tsx`，断言当前产品要求：不要要求页面出现「质量提示」这四个字。

验证命令：

```bash
pnpm exec vitest run tests/unit/preview/export-pdf-button.test.tsx tests/unit/applications/suggestion-list-editor.test.tsx
```

期望结果：2 个测试文件通过。

### Task 1.2 为 revisionRound NaN 写失败测试

- [ ] 在 `tests/integration/suggestions/suggestion-action-service.test.ts` 新增用例：当原 suggestion 没有 `revisionRound` 字段，执行 `revise` 后 child suggestion 的 `revisionRound` 必须等于 `1`。
- [ ] 测试数据里故意省略 `revisionRound`，不要写 `revisionRound: 0`。

验证命令：

```bash
pnpm exec vitest run tests/integration/suggestions/suggestion-action-service.test.ts
```

期望结果：新增测试先失败，失败原因应指向 `NaN` 或不等于 `1`。

### Task 1.3 修复 revisionRound

- [ ] 修改 `lib/services/analysis/suggestion-action-service.ts`：

```ts
const nextRevisionRound = (suggestion.revisionRound ?? 0) + 1;
```

- [ ] child suggestion 使用 `revisionRound: nextRevisionRound`。
- [ ] 不改 `reviseAfterText` 的文案，不扩展 AI 微调逻辑。

验证命令：

```bash
pnpm exec vitest run tests/integration/suggestions/suggestion-action-service.test.ts
pnpm exec tsc --noEmit
```

期望结果：全部通过。

### Task 1.4 批次一提交

```bash
git add lib/services/analysis/suggestion-action-service.ts tests/integration/suggestions/suggestion-action-service.test.ts tests/unit/preview/export-pdf-button.test.tsx tests/unit/applications/suggestion-list-editor.test.tsx
git commit -m "fix: stabilize suggestion revision baseline"
```

---

## 2. 批次二：JSON payload 读取保护与错误边界

**目标:** 单个损坏的 `payload_json` 不应让列表页、详情页或 API 直接 500 白屏。先做读取保护和最小错误边界，不做数据库结构重构。

**允许修改文件:**

- `lib/db.ts`
- `lib/services/persistence/json-payload.ts`
- `lib/services/analysis/workspace-repository.ts`
- `lib/services/snapshot/snapshot-service.ts`
- `lib/services/applications/application-record-service.ts`
- `lib/services/interview/interview-prep-service.ts`
- `lib/services/talent/talent-profile-service.ts`
- `app/error.tsx`
- `app/not-found.tsx`
- `app/loading.tsx`
- `tests/unit/services/json-payload.test.ts`
- `tests/unit/analysis/workspace-repository.test.ts`
- `tests/unit/snapshot/snapshot-service.test.ts`
- `tests/unit/applications/application-record-service.test.ts`
- `tests/unit/interview/interview-prep-service.test.ts`
- `tests/unit/talent/talent-profile-service.test.ts`

### Task 2.1 新增 JSON payload 工具

- [ ] 创建 `lib/services/persistence/json-payload.ts`。
- [ ] 导出：

```ts
export type JsonPayloadParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

export function parseJsonPayload<T>(payload: string, context: string): JsonPayloadParseResult<T> {
  try {
    return { ok: true, value: JSON.parse(payload) as T };
  } catch {
    return { ok: false, reason: `${context} 的存储数据已损坏，已跳过该记录。` };
  }
}
```

- [ ] 不要在工具里 `console.error` 输出完整 payload，避免泄露简历内容。

测试文件：`tests/unit/services/json-payload.test.ts`

验证命令：

```bash
pnpm exec vitest run tests/unit/services/json-payload.test.ts
```

期望结果：合法 JSON 返回 `ok: true`；损坏 JSON 返回 `ok: false`，不抛异常，不包含原始 payload。

### Task 2.2 保护 workspace draft 读取

- [ ] 修改 `lib/services/analysis/workspace-repository.ts`。
- [ ] `readWorkspaceDraft` 使用 `parseJsonPayload`，损坏时返回 `null`。
- [ ] `listWorkspaceDrafts` 使用 `flatMap` 或循环过滤损坏记录。
- [ ] 不修改 `saveWorkspaceDraft`。

测试文件：`tests/unit/analysis/workspace-repository.test.ts`

测试要求：

- 单条损坏 payload 返回 `null`。
- 列表中一条损坏、一条正常时，只返回正常记录。

验证命令：

```bash
pnpm exec vitest run tests/unit/analysis/workspace-repository.test.ts
```

### Task 2.3 保护快照、投递记录、面试准备、天赋档案读取

- [ ] 修改 `lib/services/snapshot/snapshot-service.ts`：损坏 snapshot 返回 `null`。
- [ ] 修改 `lib/services/applications/application-record-service.ts`：单条损坏返回 `null`，列表过滤损坏记录。
- [ ] 修改 `lib/services/interview/interview-prep-service.ts`：损坏 prep 返回 `null`。
- [ ] 修改 `lib/services/talent/talent-profile-service.ts`：损坏 profile / navigation 返回 `null`。

验证命令：

```bash
pnpm exec vitest run tests/unit/snapshot/snapshot-service.test.ts tests/unit/applications/application-record-service.test.ts tests/unit/interview/interview-prep-service.test.ts tests/unit/talent/talent-profile-service.test.ts
```

若某个测试文件不存在，先创建最小测试；不要跳过对应服务。

### Task 2.4 保护 db.ts 的 sqlite JSON 输出

- [ ] 修改 `lib/db.ts` 中 `querySql` 的 `JSON.parse(stdout)`。
- [ ] 捕获异常后抛出新的错误信息：`数据库查询结果无法解析，请检查 SQLite 输出。`
- [ ] 错误信息不要包含完整 SQL、payload 或简历内容。

测试要求：

- 如果当前 `lib/db.ts` 难以单测，至少在 `tests/unit/services/json-payload.test.ts` 里覆盖 payload 工具；`db.ts` 用 TypeScript 编译兜底。

验证命令：

```bash
pnpm exec tsc --noEmit
```

### Task 2.5 增加最小错误边界

- [ ] 创建 `app/error.tsx`，必须是 client component。
- [ ] 创建 `app/not-found.tsx`。
- [ ] 创建 `app/loading.tsx`。
- [ ] 文案只说明「当前页面加载失败 / 正在加载 / 未找到内容」，不要引入新功能，不要改整体布局。

验证命令：

```bash
pnpm exec tsc --noEmit
pnpm run check:vnext
```

### Task 2.6 批次二提交

```bash
git add lib/db.ts lib/services/persistence/json-payload.ts lib/services/analysis/workspace-repository.ts lib/services/snapshot/snapshot-service.ts lib/services/applications/application-record-service.ts lib/services/interview/interview-prep-service.ts lib/services/talent/talent-profile-service.ts app/error.tsx app/not-found.tsx app/loading.tsx tests/unit/services/json-payload.test.ts tests/unit/analysis/workspace-repository.test.ts tests/unit/snapshot/snapshot-service.test.ts tests/unit/applications/application-record-service.test.ts tests/unit/interview/interview-prep-service.test.ts tests/unit/talent/talent-profile-service.test.ts
git commit -m "fix: guard corrupted json payload reads"
```

---

## 3. 批次三：禁止页面加载时静默改写持久化建议

**目标:** UI 展示内容必须来自数据库或明确生成后的写入结果。页面加载时不得临时重写建议文本。

**允许修改文件:**

- `lib/services/analysis/workspace-data.ts`
- `tests/unit/analysis/workspace-data.test.ts`
- 只在必要时修改 `tests/unit/applications/suggestion-list.test.tsx`

### Task 3.1 写一致性测试

- [ ] 创建或修改 `tests/unit/analysis/workspace-data.test.ts`。
- [ ] mock `readWorkspaceDraft` 返回一个 `afterText` 包含旧兜底短语的 suggestion。
- [ ] 调用 `getAnalysisWorkspaceData(draftId)`。
- [ ] 断言返回的 `suggestions[0].afterText` 等于数据库里的清洗后文本，不会调用 `rewriteFactForJd` 生成新文本。

验证命令：

```bash
pnpm exec vitest run tests/unit/analysis/workspace-data.test.ts
```

期望结果：当前代码应先失败，因为 `workspace-data.ts` 会加载时重写。

### Task 3.2 删除加载时修复逻辑

- [ ] 修改 `lib/services/analysis/workspace-data.ts`。
- [ ] 删除 `rewriteFactForJd` import。
- [ ] 删除 `if (s.afterText.includes("相关性较弱")...)` 整段逻辑。
- [ ] 保留 `beforeText` 的 OCR 清洗和 `afterText` 的 `cleanGeneratedResumeText`。
- [ ] 不新增页面按钮，不新增自动修复脚本。

验证命令：

```bash
pnpm exec vitest run tests/unit/analysis/workspace-data.test.ts
pnpm exec vitest run tests/unit/applications/suggestion-list.test.tsx
pnpm exec tsc --noEmit
```

### Task 3.3 批次三提交

```bash
git add lib/services/analysis/workspace-data.ts tests/unit/analysis/workspace-data.test.ts tests/unit/applications/suggestion-list.test.tsx
git commit -m "fix: keep workspace suggestions source-of-truth stable"
```

---

## 4. 批次四：AI 改写主路径可观测、可测试、不可静默降级

**目标:** 模型可用时必须能证明使用了模型输出；模型不可用时必须在数据里明确记录降级原因。确定性兜底只能是保底，不得被 UI 或数据误认为 AI 改写。

**允许修改文件:**

- `lib/services/analysis/suggestion-generator.ts`
- `lib/ai/model-gateway.ts`
- `lib/ai/model-provider-config.ts`
- `tests/unit/services/suggestion-generator.test.ts`
- `tests/unit/ai/model-gateway.test.ts`
- `tests/unit/ai/openai-compatible-client.test.ts`
- `prompts/rewrite_expert.md`

### Task 4.1 增加建议生成元信息

- [ ] 在 `SuggestionSeed` 类型中新增可选字段：

```ts
generationMode?: "model" | "deterministic_fallback";
modelProvider?: ModelProviderKey;
modelFallbackReason?: string;
```

- [ ] AI 成功返回时：

```ts
generationMode: "model"
modelProvider: provider
sourceLabel: getAIRewriteSourceLabel(provider)
```

- [ ] 确定性兜底时：

```ts
generationMode: "deterministic_fallback"
modelProvider: "deterministic_fallback"
```

- [ ] 同步更新持久化类型：如果 `PersistedWorkspaceDraft["suggestions"]` 类型不包含这些字段，应加入可选字段。

验证命令：

```bash
pnpm exec tsc --noEmit
```

### Task 4.2 禁止 generateAISuggestions 静默 catch

- [ ] 修改 `generateAISuggestions`。
- [ ] `callModelJSON` 返回 `fallbackReason` 时，不要直接 `return generateSeedSuggestions(input)`。
- [ ] 使用一个局部 helper，例如：

```ts
function withFallbackReason(suggestions: SuggestionSeed[], reason: string): SuggestionSeed[] {
  return suggestions.map((suggestion) => ({
    ...suggestion,
    generationMode: "deterministic_fallback",
    modelProvider: "deterministic_fallback",
    modelFallbackReason: reason,
    reasonText: `${suggestion.reasonText}；模型降级原因：${reason}`
  }));
}
```

- [ ] catch 分支也必须带上可读中文降级原因。
- [ ] 不允许吞掉错误后只返回普通 seed suggestions。

验证命令：

```bash
pnpm exec vitest run tests/unit/services/suggestion-generator.test.ts tests/unit/ai/model-gateway.test.ts
```

### Task 4.3 写 AI 路径单测

在 `tests/unit/services/suggestion-generator.test.ts` 增加三类测试：

- [ ] mock `callModelJSON` 返回小米 / OpenAI 兼容模型结果，断言 `afterText` 使用模型返回内容，`generationMode` 为 `model`。
- [ ] mock `callModelJSON` 返回 `fallbackReason`，断言所有建议都包含 `modelFallbackReason`，`generationMode` 为 `deterministic_fallback`。
- [ ] mock 模型返回的 `after` 与 `before` 完全相同，断言 `reasonText` 内部仍保留质量风险信息，但 UI 不要求显示「质量提示」四个字。

验证命令：

```bash
pnpm exec vitest run tests/unit/services/suggestion-generator.test.ts
```

### Task 4.4 收紧提示词，不改 UI

- [ ] 修改 `prompts/rewrite_expert.md`。
- [ ] 强化规则：
  - `after` 必须是最终可放入简历的正文。
  - 禁止输出「建议」「可以」「这段经历」「相关性较弱」「请补充」等元话语。
  - 禁止复制原文作为改写结果。
  - 必须保留公司名、学校名、时间、数字事实，不得擅自改名。
  - 低相关经历可以压缩，但仍要写成简历正文。
- [ ] 不修改任何页面和模板。

验证命令：

```bash
pnpm exec vitest run tests/unit/services/suggestion-generator.test.ts
pnpm exec tsc --noEmit
```

### Task 4.5 批次四提交

```bash
git add lib/services/analysis/suggestion-generator.ts lib/ai/model-gateway.ts lib/ai/model-provider-config.ts prompts/rewrite_expert.md tests/unit/services/suggestion-generator.test.ts tests/unit/ai/model-gateway.test.ts tests/unit/ai/openai-compatible-client.test.ts
git commit -m "feat: make ai rewrite fallback observable"
```

---

## 5. 批次五：黄金样本评测，固定「AI 质量」不再靠感觉

**目标:** 用真实求职场景建立最小黄金样本，让后续 Agent 不再靠主观判断「有没有 AI 改写」。

**允许修改文件:**

- `tests/fixtures/rewrite-quality/ai-pm-self-use.json`
- `tests/unit/analysis/rewrite-quality-gate.test.ts`
- `lib/services/quality/rewrite-quality-gate.ts`
- `docs/quality/rewrite-quality-acceptance.md`

### Task 5.1 创建黄金样本 fixture

- [ ] 创建 `tests/fixtures/rewrite-quality/ai-pm-self-use.json`。
- [ ] 内容包含：
  - `jdText`：使用当前 AI 产品经理 / 大数据产品经理 JD 摘要。
  - `sourceBlocks`：个人优势、OfferYou 项目、AI 工具内容运营、陕西怡阳医疗科技有限公司、广发银行北京分行、教育背景。
  - `mustPreserveFacts`：`陕西怡阳医疗科技有限公司`、`广发银行北京分行`、`湖南工业大学`、`OfferYou`、`8000+`、`700+`。
  - `mustAvoidPhrases`：`建议`、`可以`、`这段经历`、`相关性较弱`、`请补充`、`...`、`…`。
  - `jdKeywords`：`AI 工具`、`Prompt`、`产品流程`、`数据分析`、`内容运营`、`学习落地`。

### Task 5.2 创建质量门禁工具

- [ ] 创建 `lib/services/quality/rewrite-quality-gate.ts`。
- [ ] 导出 `evaluateRewriteQuality({ beforeText, afterText, jdKeywords, mustPreserveFacts })`。
- [ ] 规则：
  - `afterText` 不得等于 `beforeText`。
  - `afterText` 不得包含 `mustAvoidPhrases`。
  - `afterText` 至少命中 1 个 JD keyword。
  - 如果 `beforeText` 包含某个 `mustPreserveFact`，`afterText` 不得把它改错或删除。
  - 返回 `{ passed: boolean; issues: string[] }`。

### Task 5.3 创建质量门禁测试

- [ ] 创建 `tests/unit/analysis/rewrite-quality-gate.test.ts`。
- [ ] 覆盖：
  - 完整改写通过。
  - 原文复制失败。
  - 公司名被改错失败。
  - 出现「建议」「这段经历」「…」失败。

验证命令：

```bash
pnpm exec vitest run tests/unit/analysis/rewrite-quality-gate.test.ts
```

### Task 5.4 写人工验收说明

- [ ] 创建 `docs/quality/rewrite-quality-acceptance.md`。
- [ ] 写明后续人工验收标准：
  - 同一份 JD + 简历，Web 端输出至少要能看出岗位定制痕迹。
  - 模型失败时必须显示降级原因，不能让用户误以为是 AI 改写。
  - 公司名、学校名、时间、数字事实不得改错。
  - 模板和排版不作为本轮验收项。

验证命令：

```bash
pnpm exec vitest run tests/unit/analysis/rewrite-quality-gate.test.ts
pnpm exec tsc --noEmit
```

### Task 5.5 批次五提交

```bash
git add tests/fixtures/rewrite-quality/ai-pm-self-use.json tests/unit/analysis/rewrite-quality-gate.test.ts lib/services/quality/rewrite-quality-gate.ts docs/quality/rewrite-quality-acceptance.md
git commit -m "test: add rewrite quality gate"
```

---

## 6. 总体验证

所有批次完成后运行：

```bash
pnpm exec tsc --noEmit
pnpm run check:vnext
pnpm exec vitest run tests/unit/preview/export-pdf-button.test.tsx tests/unit/applications/suggestion-list-editor.test.tsx tests/integration/suggestions/suggestion-action-service.test.ts tests/unit/services/json-payload.test.ts tests/unit/analysis/workspace-data.test.ts tests/unit/services/suggestion-generator.test.ts tests/unit/analysis/rewrite-quality-gate.test.ts
pnpm test
```

验收标准：

- `revisionRound` 不会写入 `NaN`。
- 损坏的 `payload_json` 不会让列表读取和详情读取直接崩溃。
- `workspace-data.ts` 不再在页面加载时临时改写建议。
- 模型成功时，建议可证明来自模型输出。
- 模型失败时，建议明确带有中文降级原因。
- 质量门禁能拦住原文复制、公司名改错、元话语和省略号。
- `Professional CN` 和 `ATS Clean` 模板文件没有被改动。
- `.env.local`、`storage/`、`.next/`、`node_modules/`、日志、SQLite、PDF、截图没有进入 Git。

---

## 7. 阻塞格式

如果任何验证失败，立即停止，按以下格式汇报：

```text
阻塞批次：批次 N / Task N.N
失败命令：pnpm ...
失败现象：简述错误输出
已改文件：列出文件
未继续原因：说明为什么不能继续后续批次
建议下一步：一个最小修复方向
```

---

## 8. 最终提交与版本

完成所有批次后：

```bash
git status --short
git log --oneline -5
```

若工作区干净，再由负责人决定是否：

```bash
git push origin codex/offeryou-v3-2-core-hardening-ai-first
```

不要直接覆盖 `v3.2` 标签。若需要新版本，建议使用 `v3.2.1` 或 `v3.3`。
