# OfferYou 产品可信度与 AI 主线修复执行报告

**执行日期:** 2026-05-05 / 2026-05-06
**执行方式:** Claude Code 按计划逐步执行

---

## 执行总览

| 批次 | 名称 | 状态 | 新增测试 |
|---|---|---|---|
| 0 | 建立基线 | 完成 | 0 |
| 1 | 修复事实校验污染 | 完成 | 2 |
| 2 | 质量门禁阻断 fail 建议 | 完成 | 2 |
| 3 | 面试准备和自我介绍 AI 化 | 完成 | 2 |
| 4 | 天赋发现 AI 化与 Insight Layer | 完成 | 7 |
| 5 | 统一 JSON parser | 完成 | 17 |
| 6 | 清理 Prisma 死代码 | 完成 | 0 |
| 7 | better-sqlite3 参数化数据层 | 完成 | 1 |
| 8 | 上传/下载安全边界 | 完成 | 2 |
| 9 | JobApplyRun 轻量编排准备 | 完成 | 4 |
| 10 | 综合验证 | 完成 | 0 |

**测试基线:** 137 → **174** (+37)
**TypeScript 错误:** 0

---

## 批次详情

### 批次 1: 修复事实校验污染

**修改文件:** `lib/services/quality/fact-grounding.ts`, `tests/unit/quality/fact-grounding.test.ts`

从 `buildCorpus` 移除了 `jdText`、`company`、`jobTitle`，确保事实依据只来自用户提供的材料。JD 中的数字不再能作为候选人成就的证据。

### 批次 2: 质量门禁阻断 fail 建议

**修改文件:** `lib/services/analysis/suggestion-action-service.ts`, `components/applications/suggestion-action-bar.tsx`, `components/applications/suggestion-list.tsx`, `tests/integration/suggestions/suggestion-action-service.test.ts`

`verification.status === "fail"` 的建议不能被普通接受。用户必须编辑后确认或请求 AI 微调。UI 显示"需编辑后确认"提示。

### 批次 3: 面试准备和自我介绍 AI 化

**修改文件:** `lib/services/interview/interview-prep-service.ts`, `tests/unit/interview/interview-prep-service.test.ts`

`createInterviewPrepFromRecord` 现在优先调用 `callModelJSON` 生成面试准备。模型失败时回退到确定性模板，并在 `InterviewPrepRecord` 中记录 `generationMode` 和 `riskNotes`。

### 批次 4: 天赋发现 AI 化与 Insight Layer

**修改文件:**
- `lib/services/master/master-service.ts` — 新增 `saveMasterInsight`、`listMasterInsights`（从 DB 读取）
- `lib/db.ts` — 新增 `master_insights` 表
- `lib/services/talent/talent-profile.ts` — 新增 `buildTalentProfileWithModel`
- `lib/services/talent/talent-profile-service.ts` — 模型优先，确认时保存高置信洞察
- `components/master/master-insight-list.tsx` — 适配新类型字段
- `app/master/page.tsx` — await 异步调用

`MasterInsightSummary` 类型扩展为包含 `userId`、`evidenceFactIds`、`status`（含 `rejected`）。天赋确认时自动将高置信优势写入 `master_insights`。

### 批次 5: 统一 JSON parser

**修改文件:**
- `lib/ai/json-parser.ts`（新增）— `stripMarkdown`、`extractFirstJsonValue`、`parseLooseJSON`
- `lib/ai/model-gateway.ts` — 移除本地实现，导入共享模块
- `lib/ai/openai-compatible-client.ts` — 移除本地实现，导入共享模块
- `lib/ai/gemini-client.ts` — 移除本地实现，导入共享模块
- `tests/unit/ai/json-parser.test.ts`（新增）— 17 个测试

三处重复的 JSON 解析逻辑统一到 `lib/ai/json-parser.ts`。

### 批次 6: 清理 Prisma 死代码

**删除:** `prisma/schema.prisma`、`prisma/` 目录
**修改文件:** `package.json` — 移除 `@prisma/client`、`prisma`、`prisma:generate`、`prisma:migrate:dev`

无运行时代码引用 Prisma，安全删除。

### 批次 7: better-sqlite3 参数化数据层

**修改文件:**
- `lib/db.ts` — 用 `better-sqlite3` 替换 `sqlite3` CLI，新增 `executeSqlParams`、`querySqlParams`
- `lib/services/interview/interview-prep-service.ts` — 迁移到参数化 API
- `lib/services/master/master-service.ts` — 迁移到参数化 API
- `tests/unit/db.test.ts` — 参数化查询测试

旧 API（`executeSql`、`querySql`、`sqlString`）保留兼容。`interview-prep-service` 和 `master-service` 已迁移到参数化 API。

### 批次 8: 上传/下载安全边界

**修改文件:**
- `lib/storage/local-storage-adapter.ts` — 新增 `assertInsideStorageRoot` 路径约束
- `app/api/uploads/ingest/route.ts` — 10MB 大小限制、MIME/扩展名白名单
- `app/api/records/[recordId]/download/route.ts` — 路径遍历防护
- `tests/integration/storage/local-storage-adapter.test.ts` — 路径约束测试

### 批次 9: JobApplyRun 轻量编排准备

**修改文件:**
- `lib/services/job-apply/agent-run.ts` — 新增 `JobApplyNextAction` 类型、`nextAction`/`blockingReason`/`needsHumanConfirmation` 字段
- `lib/services/job-apply/job-apply-run-service.ts` — 新增 `resolveNextAction` 逻辑
- `tests/unit/job-apply/agent-run.test.ts` — 4 个 nextAction 测试

---

## 验证结果

```
pnpm exec tsc --noEmit    → 0 errors
pnpm test                 → 174 passed (52 files)
pnpm run test:pdf         → 11 passed (5 files)
pnpm run check:vnext      → 通过
```

## 未修改文件

- `components/preview/template-professional-cn.tsx` — 未触及
- `components/preview/template-ats-clean.tsx` — 未触及
- `.env.local` — 未触及
- 运行产物（storage/、.next/、node_modules/） — 未跟踪
