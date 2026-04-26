# OfferYou

### 先把简历改到能投，再把面试准备和天赋发现接上。
### 一个面向真实求职的简历定制与面试准备工作台。

---

OfferYou 现在的目标很明确：先把一条真实可用的求职链路跑通。

当前 MVP 关注四件事：

- 岗位定制：输入 JD 和简历，先看差距，再生成可投递快照。
- 面试准备：基于投递记录生成问题、自我介绍和答案草稿，并支持导出可复制的复盘文本。
- 天赋发现：把真实经历沉淀成更长期的优势判断。
- 事实主档：确认过的经历才进入长期资料层。

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

- Gemini：设置 `GEMINI_API_KEY`，可选设置 `GEMINI_MODEL`。
- OpenAI 兼容模式：设置 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`。
- 都未配置时会自动使用 `deterministic_fallback`，用于本地验证和无 Key 场景。

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
