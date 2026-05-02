# OfferYou V3.2.1 低模型验证与同步执行技术

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 每完成一个批次必须运行该批验证命令；若任何验证失败，立即停止并按「阻塞格式」汇报，不要继续后续批次。

**Goal:** 将已经完成的 V3.2 核心加固分支验证清楚，并在不改动简历模板和主链路的前提下，完成可追踪同步。

**Architecture:** 当前核心加固工作已经在独立 worktree 分支完成，包含稳定性、数据一致性和 AI 改写可观测性。低模型只做验证、PDF 导出测试排障、合并前检查和同步，不做 UI、模板、产品逻辑扩展。

**Tech Stack:** Next.js App Router, React 19, TypeScript, SQLite CLI, Vitest, Playwright Chromium, Git worktree.

---

## 0. 当前事实

### 0.1 已完成分支

分支：

```bash
codex/offeryou-v3-2-core-hardening-ai-first
```

worktree 路径：

```bash
/private/tmp/superpowers/worktrees/OfferYou/codex/offeryou-v3-2-core-hardening-ai-first
```

该分支最新 5 个提交：

```text
f3ed7b4 test: add rewrite quality gate
3e7f90d feat: make ai rewrite fallback observable
476805c fix: keep workspace suggestions source-of-truth stable
3c0b660 fix: guard corrupted json payload reads
309def0 fix: stabilize suggestion revision baseline
```

### 0.2 已知验证结果

已通过：

```bash
pnpm exec tsc --noEmit
pnpm run check:vnext
pnpm exec vitest run tests/unit/preview/export-pdf-button.test.tsx tests/unit/applications/suggestion-list-editor.test.tsx tests/integration/suggestions/suggestion-action-service.test.ts tests/unit/services/json-payload.test.ts tests/unit/analysis/workspace-data.test.ts tests/unit/services/suggestion-generator.test.ts tests/unit/analysis/rewrite-quality-gate.test.ts
```

未完全收口：

```bash
pnpm test
```

原因：PDF 导出相关集成测试会启动 Playwright Chromium。非提权运行时报 macOS `MachPortRendezvousServer Permission denied`；提权运行后进入导出测试段长时间无输出，需要单独排障。

### 0.3 主仓库状态

主仓库路径：

```bash
/Users/wsyoung/Projects/OfferYou/github_release
```

注意：主仓库 `main` 当前可能只有计划文档未跟踪，核心加固提交还在独立 worktree 分支里。不要直接在 `main` 上重新手写同样改动。

---

## 1. 硬边界

### 1.1 禁止修改

- `components/preview/template-professional-cn.tsx`
- `components/preview/template-ats-clean.tsx`
- `components/preview/preview-workspace.tsx`
- `lib/services/export/preview-renderer.ts`
- `app/globals.css`
- 页面布局、颜色、页头、正文排版、PDF 导出样式
- `.env.local`
- `storage/`
- `.next/`
- `node_modules/`
- 日志文件
- SQLite 数据库
- 导出 PDF

如确实必须修改上述文件，立即停止并按「阻塞格式」汇报。

### 1.2 本计划不处理

- 认证系统
- 多人协作并发锁
- 数据库 JSON Blob 结构重构
- Community 页面清理
- 新模板
- 新页面
- 新模型供应商
- AI 提示词大改

---

## 2. 批次一：确认分支和运行进程

**目标:** 确认低模型站在正确 worktree 上，并清理上一次验证残留的测试进程。

**允许修改文件:** 无。

### Task 1.1 确认工作目录

- [ ] 进入已完成分支的 worktree：

```bash
cd /private/tmp/superpowers/worktrees/OfferYou/codex/offeryou-v3-2-core-hardening-ai-first
```

- [ ] 查看当前分支：

```bash
git branch --show-current
```

期望输出：

```text
codex/offeryou-v3-2-core-hardening-ai-first
```

- [ ] 查看最近提交：

```bash
git log --oneline -5
```

期望包含：

```text
f3ed7b4 test: add rewrite quality gate
3e7f90d feat: make ai rewrite fallback observable
476805c fix: keep workspace suggestions source-of-truth stable
3c0b660 fix: guard corrupted json payload reads
309def0 fix: stabilize suggestion revision baseline
```

若分支或提交不匹配，停止。

### Task 1.2 检查工作区

- [ ] 查看工作区：

```bash
git status --short
```

期望输出为空。

若存在未提交文件，停止并汇报。

### Task 1.3 检查测试残留进程

- [ ] 查看 Vitest / Chromium 相关进程：

```bash
pgrep -af "vitest|chrome-headless-shell|chromium|playwright"
```

- [ ] 如果只看到当前 worktree 的残留测试进程，记录 PID。
- [ ] 使用普通 `kill <PID>` 停止残留进程。
- [ ] 再次运行 `pgrep -af "vitest|chrome-headless-shell|chromium|playwright"`。

注意：不要杀掉 `next dev`、`playwright-mcp` 或其他明显属于用户正在使用的进程。若无法判断进程归属，停止并汇报。

---

## 3. 批次二：复跑核心非浏览器验证

**目标:** 先确认核心加固代码本身稳定，不让 PDF 浏览器环境问题干扰判断。

**允许修改文件:** 无。

### Task 2.1 TypeScript 编译

- [ ] 运行：

```bash
pnpm exec tsc --noEmit
```

期望：退出码为 `0`。

### Task 2.2 vNext 一致性检查

- [ ] 运行：

```bash
pnpm run check:vnext
```

期望输出包含：

```text
vNext 一致性检查通过，核心链路文件齐备。
```

### Task 2.3 核心加固测试

- [ ] 运行：

```bash
pnpm exec vitest run tests/unit/preview/export-pdf-button.test.tsx tests/unit/applications/suggestion-list-editor.test.tsx tests/integration/suggestions/suggestion-action-service.test.ts tests/unit/services/json-payload.test.ts tests/unit/analysis/workspace-data.test.ts tests/unit/services/suggestion-generator.test.ts tests/unit/analysis/rewrite-quality-gate.test.ts --reporter verbose
```

期望：

```text
Test Files  7 passed
Tests  24 passed
```

若失败，停止。不要进入 PDF 导出排障。

---

## 4. 批次三：PDF 导出集成测试最小排障

**目标:** 判断 PDF 导出失败是环境权限问题、测试并发问题，还是代码问题。

**允许修改文件:** 默认无。只有 Task 3.4 明确触发时，才允许修改测试文件。

### Task 3.1 单独运行 PDF 导出服务测试

- [ ] 运行：

```bash
pnpm exec vitest run tests/integration/export/pdf-export-service.test.ts --reporter verbose --pool forks --maxWorkers 1
```

期望：测试通过。

若报 `MachPortRendezvousServer Permission denied`，记录为「沙箱权限问题」，继续 Task 3.2。

若长时间无输出超过 60 秒，停止该命令，记录为「Chromium 启动卡住」，继续 Task 3.3。

### Task 3.2 提权复跑单个 PDF 测试

- [ ] 使用提权方式运行同一命令：

```bash
pnpm exec vitest run tests/integration/export/pdf-export-service.test.ts --reporter verbose --pool forks --maxWorkers 1
```

期望：测试通过。

若提权后仍卡住或失败，进入 Task 3.3。

### Task 3.3 检查 PDF 导出服务是否泄漏浏览器进程

- [ ] 打开：

```bash
lib/services/export/pdf-export-service.ts
```

- [ ] 只检查 `createResumePdfPage` 是否满足：

```ts
let browser: Browser | null = null;
try {
  browser = await chromium.launch(...);
  ...
  return { browser, page };
} catch (error) {
  await browser?.close();
  throw error;
}
```

- [ ] 如果已经满足，不改代码，记录「生产代码已有初始化失败关闭保护」。
- [ ] 如果不满足，停止并汇报，因为该文件在当前大计划硬边界外，不允许低模型直接改。

### Task 3.4 仅当确认为测试环境问题时，隔离 PDF 测试

触发条件：Task 3.1 / 3.2 都证明是 Playwright Chromium 环境问题，且生产代码无明显泄漏问题。

允许修改文件：

- `tests/integration/export/pdf-export-service.test.ts`
- `tests/integration/export/resume-export-service.test.ts`
- `tests/integration/job-apply/job-apply-pdf-export.test.ts`
- `package.json`

修改原则：

- 不跳过业务测试。
- 不删除 PDF 导出断言。
- 只把真实 Chromium PDF 测试从默认 `pnpm test` 中拆成单独脚本。
- 新增脚本名建议：

```json
"test:pdf": "vitest run tests/integration/export/pdf-export-service.test.ts tests/integration/export/resume-export-service.test.ts tests/integration/job-apply/job-apply-pdf-export.test.ts --pool forks --maxWorkers 1"
```

- 默认 `pnpm test` 可继续覆盖非浏览器链路。
- `pnpm run test:pdf` 用于本机可启动 Chromium 时的专项验收。

验证命令：

```bash
pnpm test
pnpm run test:pdf
```

若 `pnpm test` 通过但 `pnpm run test:pdf` 因本机权限失败，记录为环境风险，不要再改生产代码。

---

## 5. 批次四：合并回 main 前检查

**目标:** 确认合并不会覆盖用户工作，也不会把 API key 或运行产物带入版本库。

**允许修改文件:** 无。

### Task 4.1 检查敏感信息

- [ ] 运行：

```bash
rg -n "tp-[A-Za-z0-9]|GEMINI_API_KEY|MIMO_API_KEY|OPENAI_API_KEY|AIza" .
```

期望：

- 不出现真实 key。
- 如果只出现 `.env.example`、文档占位符或测试变量名，记录为安全。

若出现真实 key，立即停止。

### Task 4.2 检查运行产物

- [ ] 运行：

```bash
git status --short
```

期望：为空。

- [ ] 运行：

```bash
git ls-files | rg "dev.log|server.log|offeryou.sqlite|storage/|\\.next/|node_modules/|\\.pdf$|\\.png$"
```

期望：无输出。

若出现运行产物，停止。

### Task 4.3 切回主仓库检查 main

- [ ] 进入主仓库：

```bash
cd /Users/wsyoung/Projects/OfferYou/github_release
```

- [ ] 查看状态：

```bash
git status --short
```

若存在未跟踪计划文档 `docs/plans/2026-04-30-v3-2-core-hardening-ai-first-plan.md`，可以保留并在合并后一起提交；不要删除。

若存在代码文件变更，停止并汇报。

---

## 6. 批次五：同步策略

**目标:** 将已验证分支安全合入 `main`，或在验证未完成时只推送工作分支。

**允许修改文件:** 无。

### Task 5.1 推荐策略

优先选择：

```bash
git checkout main
git merge --no-ff codex/offeryou-v3-2-core-hardening-ai-first -m "merge: integrate OfferYou V3.2.1 hardening"
```

合并后运行：

```bash
pnpm exec tsc --noEmit
pnpm run check:vnext
pnpm exec vitest run tests/unit/preview/export-pdf-button.test.tsx tests/unit/applications/suggestion-list-editor.test.tsx tests/integration/suggestions/suggestion-action-service.test.ts tests/unit/services/json-payload.test.ts tests/unit/analysis/workspace-data.test.ts tests/unit/services/suggestion-generator.test.ts tests/unit/analysis/rewrite-quality-gate.test.ts --reporter verbose
```

若通过，再继续推送。

### Task 5.2 若 PDF 专项仍未完全通过

如果只有 `test:pdf` 因 Chromium 权限失败：

- [ ] 不阻止核心加固合并。
- [ ] 在最终汇报中明确写：

```text
PDF 专项测试未完成，原因是本机 Playwright Chromium 权限 / 启动环境问题。核心非浏览器链路已通过。
```

- [ ] 不改模板。
- [ ] 不改 PDF 样式。
- [ ] 不强行删除 PDF 测试。

### Task 5.3 推送分支

若合并到 `main`：

```bash
git push origin main
```

若暂不合并，只推送工作分支：

```bash
git push origin codex/offeryou-v3-2-core-hardening-ai-first
```

不要覆盖 `v3.2` 标签。

如需要版本标签，建议：

```bash
git tag v3.2.1
git push origin v3.2.1
```

只有在用户明确要求打 tag 时才执行。

---

## 7. 最终验收标准

- `revisionRound` 不会写入 `NaN`。
- 损坏 JSON payload 不会让页面或列表直接崩溃。
- `workspace-data.ts` 不再在页面加载时静默改写建议。
- 模型成功时，建议数据能证明来自模型输出。
- 模型失败时，建议数据包含中文降级原因。
- 改写质量门禁能拦住原文复制、公司名改错、元话语和省略号。
- `Professional CN` 和 `ATS Clean` 模板文件没有被改动。
- 没有提交 API key。
- 没有提交运行产物。
- PDF 导出测试状态被明确记录：通过、环境阻塞或拆分为专项脚本。

---

## 8. 阻塞格式

如果任何验证失败，立即停止，按以下格式汇报：

```text
阻塞批次：批次 N / Task N.N
失败命令：pnpm ...
失败现象：简述错误输出
已改文件：列出文件；如无则写「无」
未继续原因：说明为什么不能继续后续批次
建议下一步：一个最小修复方向
```

---

## 9. 最终汇报模板

```text
已完成：
- 核心加固分支确认：
- 核心验证：
- PDF 专项状态：
- 敏感信息检查：
- 运行产物检查：
- 同步状态：

提交 / 分支：
- main:
- hardening branch:
- tag:

仍需人工确认：
- 是否接受 PDF 专项测试当前状态
- 是否创建 v3.2.1 标签
```
