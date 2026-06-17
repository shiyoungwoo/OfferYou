# OfferYou

### 先把简历改到能投，再把面试准备和天赋发现接上。
### 一个面向真实求职的简历定制与面试准备工作台。

---

OfferYou 现在的目标很明确：先把一条真实可用的求职链路跑通。

当前 MVP 关注四件事：

- 岗位定制：输入 JD 和简历，先看差距，再生成可投递快照。
- 面试准备：基于投递记录生成问题、自我介绍和答案草稿，并支持导出可复制的复盘文本。
- 天赋发现：把真实经历沉淀成 `TalentProfile`，作为 OfferYou 最大能力模式的核心上下文。
- 事实主档：确认过的经历才进入长期资料层。

## Agent-first 职责边界

OfferYou 的产品方向是 Agent-first：AI 负责理解、比较、取舍、改写和校验；代码负责状态、工具、存储、预览、导出和一致性。

天赋挖掘不是可选增强。完成天赋挖掘后，系统才进入「天赋驱动 Agent 模式」：`TalentProfile` 提供用户模型，`JDInsight` 提供机会模型，`CalibratedResumeProfile` 提供事实模型。Agent 在三者之间生成更适合用户、能发挥个人潜力的简历表达。

模型不可用时，OfferYou 只能作为基础简历编辑与模板导出工具使用，不能把规则兜底内容伪装成 AI 改写。详细执行边界见 [AI 与代码职责边界落地计划](docs/plans/2026-05-07-ai-code-boundary-talent-first-plan.md)。

## 快速开始

```bash
pnpm install
pnpm dev
```

打开 `http://localhost:3000` 后，优先看这几个入口：

- `/applications/new` - 修改简历和生成快照
- `/prep` - 面试准备
- `/talent` - 发现自己
- `/me` - 我的资料

## 本地验证

```bash
pnpm check:vnext
pnpm report:self-use
pnpm test
pnpm test:e2e -- tests/e2e/vnext-main-path.spec.ts
pnpm export:fixtures
pnpm build
```

`pnpm check:vnext` 会检查核心页面、投递记录、面试准备、样本夹具、质量服务和模型入口文件是否齐备。`pnpm report:self-use` 会生成自用 Beta 报告，汇总样本质量、PDF 路径、Interview Prep 与主要风险提示。

## 模型配置

- 小米 MiMo：推荐设置 `MIMO_API_KEY`、`MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1`，并设置 `DEFAULT_MODEL_PROVIDER=openai_compatible`。默认分层为：普通文本节点使用 `MIMO_MODEL_SIMPLE=mimo-v2.5`，复杂推理节点使用 `MIMO_MODEL_COMPLEX=mimo-v2.5-pro`，截图/视觉识别预留 `MIMO_MODEL_VISION=mimo-v2.5`。
- OpenAI Codex OAuth：如需使用 OpenAI Codex 模型分层，可设置 `OPENAI_COMPATIBLE_FLAVOR=openai_codex`、`OPENAI_CODEX_ACCESS_TOKEN`、`OPENAI_CODEX_BASE_URL=https://api.openai.com/v1`。默认简单节点为 `OPENAI_CODEX_MODEL_SIMPLE=gpt-5.4-mini`，复杂节点为 `OPENAI_CODEX_MODEL_COMPLEX=gpt-5.5`；两个模型名均可通过环境变量覆盖，避免未来权限或模型 ID 变化影响主链路。
- OpenAI 兼容模式：也支持 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`。
- Google Gemini：设置 `GEMINI_API_KEY` 后启用。默认分层：简单任务使用 `GEMINI_MODEL_SIMPLE=gemini-2.5-flash`，复杂推理使用 `GEMINI_MODEL_COMPLEX=gemini-2.5-pro`，视觉任务使用 `GEMINI_MODEL_VISION=gemini-2.5-flash`。也兼容旧版 `GEMINI_MODEL` 环境变量。使用 `@google/genai` SDK（Gemini CLI 同款内核）。
- 都未配置时只能进入基础编辑、规则参考和本地验证场景；不得把 `deterministic_fallback` 输出包装成正式 AI 改写。

## 模型能力说明

OfferYou 支持文本模型、多模态模型和确定性兜底。文本模型适合 JD 匹配和中文改写；多模态模型适合处理 JD 截图、PDF 页面截图和 OCR 校准；确定性兜底只用于无 Key 时的基础整理和本地验证。

JD 输入模式收敛为三档，默认使用「标准 AI」：

- 基础模式：合并基础编辑和低成本文本处理。模型不可用时只保存用户填写内容；文本可靠且模型可用时，可做轻量 JD 理解。
- 标准 AI：默认模式。文本 / PDF 先由工具提取再交给模型理解；截图 JD 必须保留 OCR 版面信息，并要求用户确认当前选中岗位。
- 高质量 AI：用于复杂截图和重要投递，优先使用视觉模型判断当前公司、岗位和 JD 正文。

## 数据与清理

- `storage/offeryou.sqlite` 保存草稿、快照、投递记录、面试准备、天赋档案和事实主档。
- `storage/<userId>/` 下保存上传文件和导出的 PDF 产物。
- `docs/quality/` 保存样本导出报告、真实试跑报告和人工复查产物。
- 模型密钥只应放在本地环境变量或 `.env.local` 中，不要写进仓库，也不要在文档里贴原文。
- 如果需要重置本地数据，可以先停止开发服务，再删除 `storage/offeryou.sqlite`、`storage/<userId>/` 以及相关的 `docs/quality/*-artifacts/` 目录。
- 重置后建议重新运行 `pnpm check:vnext` 和 `pnpm test`，确认基础链路仍然可用。

## 验收入口

- [自用求职验收清单](docs/quality/offeryou-self-use-acceptance.md)
- [样本导出报告](docs/quality/job-apply-fixture-outputs.md)

## 代码结构

- `app/`：页面与 API 路由
- `components/`：页面组件
- `lib/`：服务层、存储层、文档模型
- `tests/`：单测、集成测试、端到端测试
- `scripts/`：检查脚本与样本导出脚本
- `docs/quality/`：自用验收与样本报告

## 说明

- `AIPM` 是项目动机和作品集叙事，不是首页产品定位。
- PDF 输入解析会优先尝试 `opendataloader-pdf` CLI，未安装时自动回退到本地轻量解析。
- 简历快照与 PDF 导出使用同一份文档，避免预览和导出不一致。
- 真实经历优先，推断内容只保留在建议层，不回写事实主档。
