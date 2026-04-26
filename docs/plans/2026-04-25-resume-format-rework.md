# 简历 PDF 版式重构 计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 OfferYou 的简历输出收敛成「单栏、A4、事实优先、一页优先、两页兜底」的可投递 PDF，并在样本导出里生成一份可人工检查的版本。

**Architecture:** 统一调整 `ResumeDocument` 的展示层、HTML 导出层和 React 预览层，让两条输出路径共用同一套结构顺序与信息密度规则。保留现有 Snapshot / Export 链路，只改版式、页眉信息和分页策略，不动分析链路。

**Tech Stack:** Next.js、React、TypeScript、Playwright、Vitest、Tailwind CSS。

---

### Task 1: 收敛简历结构模型

**Files:**
- Modify: `lib/document/resume-document.ts`
- Modify: `lib/services/snapshot/snapshot-composer.ts`
- Modify: `lib/services/analysis/workspace-data.ts`（如需对齐页面预估）
- Test: `tests/unit/snapshot/snapshot-composer.test.ts`

- [ ] **Step 1: 写出结构期望的测试或断言**
- [ ] **Step 2: 运行测试确认当前结构不符合**
- [ ] **Step 3: 补充 GitHub / 作品集链接字段与 section 顺序**
- [ ] **Step 4: 运行测试确认通过**

### Task 2: 重做 HTML / React 预览版式

**Files:**
- Modify: `lib/services/export/preview-renderer.ts`
- Modify: `components/preview/template-professional-cn.tsx`
- Modify: `components/preview/template-ats-clean.tsx`
- Modify: `components/preview/resume-page.tsx`
- Modify: `components/preview/resume-preview.tsx`
- Test: `tests/unit/preview/preview-renderer.test.tsx`
- Test: `tests/unit/preview/resume-template-switch.test.tsx`

- [ ] **Step 1: 为单栏 A4 版式补测试**
- [ ] **Step 2: 运行测试确认旧双栏布局不再符合**
- [ ] **Step 3: 改为单栏、紧凑 section、页眉链接位**
- [ ] **Step 4: 运行测试确认预览渲染通过**

### Task 3: 重新导出样本 PDF

**Files:**
- Modify: `scripts/export-job-apply-fixtures.mjs`
- Test: `pnpm export:fixtures`

- [ ] **Step 1: 运行样本导出**
- [ ] **Step 2: 检查输出报告与 PDF 路径**
- [ ] **Step 3: 确认至少一份 AIPM 样本 PDF 可人工查看**

### Task 4: 回归验证

**Files:**
- Test: `pnpm check:vnext`
- Test: `pnpm test`
- Test: `pnpm build`

- [ ] **Step 1: 跑检查脚本**
- [ ] **Step 2: 跑单元 / 集成测试**
- [ ] **Step 3: 跑生产构建**
- [ ] **Step 4: 记录样本 PDF 位置**
