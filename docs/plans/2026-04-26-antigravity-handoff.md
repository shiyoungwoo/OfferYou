# OfferYou 交接文档：分析工作台 UI 重构与建议交互系统升级

生成时间：2026-04-26  
当前工作区：`/tmp/superpowers/worktrees/OfferYou/phase3-batch28`  
测试链接：`http://127.0.0.1:3000/applications/79433cb0-2c59-4462-9517-6996c6488457`

---

## 1. 本次会话的目标

本次 Antigravity 会话的目标是将"分析建议列表"（SuggestionList）升级为真正具有**可操作性**的审核界面，用户能在其中直接看到"原始表达 vs. JD 深度改写"的对比，并逐一确认、拒绝或微调每一条建议。

用户的核心诉求汇总：

1. **建议内容必须是实质改写，不能是"废话"**（如"围绕数据分析进行强化"这种元语言）。
2. **T 型表格布局**：项目名称/时间段作为顶部共享表头，下方左右两栏分别显示"原始表达"和"JD 深度分析匹配改写"。
3. **多项目独立处理**：一个建议块如果包含两个项目（如 OfferYou 和 AI 工具自媒体），每个项目必须有自己的 T 型块和独立改写。
4. **按钮位置**：接受/编辑/拒绝/继续微调四个按钮放在项目标题那一行，不是放在改写内容区域。
5. **JD 能力标签**：放在"JD 深度分析匹配改写"标签旁边，不是放在标题行。
6. **自动收起**：某栏目（如项目经历）内所有改写都被处理后，自动收起该栏目。
7. **界面不能溢出屏幕**。

---

## 2. 已修改的文件（24 个文件，629 行增加，284 行删减）

### 2.1 核心 UI：建议列表

**文件：`components/applications/suggestion-list.tsx`**（改动最大，+297 行）

完成：
- 全面重写为 **T 型双栏布局**（`TSection` 组件）。
- 顶部 Header 行：项目名称 + 紧凑操作按钮（接受/编辑/拒绝/微调）。
- 右栏顶部：`JD 深度分析匹配改写` 标签 + JD 能力标签（蓝色胶囊）。
- **锚点式内容拆分**（Anchor-based Extraction）：以时间轴（`YYYY.MM - 至今`）为锚点，反向找标题，正向找正文，彻底解决内容"出血"到标题行的问题。
- 新增 `overflow-x-hidden`、`min-w-0`、`break-all` 等多层溢出防御。
- 新增 `parseExtendedReasonText()` 解析器，从 reason 字符串里提取标签（`；标签：`）和缺口提醒（`【JD 缺失能力提醒】`）。

**仍未解决（已知 Bug）**：
- **项目标题识别仍有偏差**：用户反馈第二个项目的标题会把上一个项目末尾的内容（如"一键导出与投递记录"）包含进来。根本原因在于 beforeText 本身是 OCR 识别后的纯文本，没有标题层级信息。锚点回溯方案目前依赖"换行 + 日期"判断，在内容紧凑的 OCR 文本中仍会取错。
  - **推荐修复方案**：在初次 PDF/OCR 解析时（`ingestion` 层），应当就识别出"项目名称"、"时间段"、"内容点"三级结构，并以结构化 JSON 存储，而非存储纯文本 blob。这样 UI 层就能直接使用 `project.name` 而不依赖正则解析。
- **改写内容重复问题**：如果 AI 在 `afterText` 里没有区分两个项目（例如直接输出合并后的改写），前端拆分逻辑只能按日期锚点切分，可能导致两个项目显示相同内容。
  - **推荐修复方案**：`suggestion-generator.ts` 中已增加多项目检测逻辑（见 2.3），但在 AI 调用路径（DeepSeek）尚未同步此约束。建议在 AI Prompt 中明确要求按项目分段输出，并用 `---` 或 `## 项目 N` 分隔。
- **自动收起**：点击接受/拒绝后 `router.refresh()` 触发，但 `expandedId` 的 `null` 设置时机没有跟多项目完成状态挂钩，导致两个项目都接受了仍不收起。
  - **推荐修复方案**：服务端在所有建议都有 `status`（accepted/rejected）后，将其从待处理列表移除或标记，前端 `useEffect` 检测到该 suggestion 不再在待处理列表中时自动折叠。
- **横向溢出（水平滚动条）**：已多次尝试添加 `overflow-x-hidden`、`min-w-0`、`break-all`，但用户报告问题仍存在。
  - **根本原因分析**：溢出元素可能不在 `TSection` 内部，可能是 `SuggestionActionBar` 在 compact 模式使用了 `scale-90`（CSS transform 不影响布局流，但 origin-right 可能让元素视觉上超出容器），或者是父级 `article` / `section` 的 flex 上下文没有正确继承 `min-w-0`。
  - **推荐排查方法（给下一位工程师）**：
    ```js
    // 在浏览器控制台执行，找出超出视口的元素
    const allEls = document.querySelectorAll("*");
    const overflowing = [...allEls].filter(el => el.scrollWidth > el.clientWidth + 1);
    console.log(overflowing.map(el => ({ tag: el.tagName, class: el.className, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })));
    ```
  - 最可能的罪魁祸首：`SuggestionActionBar` compact 模式的 `scale-90 origin-right` 会造成视觉溢出（即使 DOM 宽度正常），应改为直接缩小 `font-size` 和 `padding`，而不是 CSS transform。

### 2.2 操作按钮

**文件：`components/applications/suggestion-action-bar.tsx`**（+40 行）

完成：
- 新增 `compact` prop（默认 `false`）。
- `compact=true` 时渲染四个紧凑小按钮（接受/编辑/拒绝/微调），使用圆角矩形而非圆形胶囊，字号 11px。
- ⚠️ 当前 compact 按钮使用 `scale-90 origin-right`，这是溢出问题的潜在来源，建议改为直接缩小 padding 和字号。

### 2.3 建议改写生成器

**文件：`lib/services/analysis/suggestion-generator.ts`**（+88 行）

完成：
- 导出了 `rewriteFactForJd` 供外部直接调用。
- 新增多项目检测：如果 `fact` 中含有多个日期锚点，会按项目分别生成改写片段。
- 将改写产物中的 `reason` 格式化为结构化字符串：`基于 JD...；标签：XXX；质量提升`，以便 UI 层解析标签。
- 移除了原有的"围绕...强化..."等元语言话术。

**仍存在的问题**：
- 当前多项目改写逻辑只在**确定性（deterministic）路径**生效，AI 路径（`/api/drafts/[draftId]/suggestions/[id]` 调用 DeepSeek rewrite）尚未约束。建议在 `prompts/rewrite_expert.md` 中增加"多项目分段输出"的指令。

### 2.4 建议数据加载

**文件：`lib/services/analysis/workspace-data.ts`**（+44 行）

完成：
- 新增了 "Hot-fix 层"：在从数据库取出旧建议时，如果 `afterText` 包含"围绕"或"强化"等元语言，自动用 `rewriteFactForJd` 重新生成一版干净的改写。
- 集成了 `text-cleaner.ts` 的 OCR 纠错逻辑（`normalizeOcrResumeText`）。

### 2.5 OCR 文本清洗

**文件（新）：`lib/services/analysis/text-cleaner.ts`**

完成：
- 集中管理 OCR 常见错误修正，例如 `O"erYou` → `OfferYou`。
- 提供 `normalizeOcrResumeText(text)` 供 `workspace-data.ts` 和 `snapshot-composer.ts` 调用。

### 2.6 页面布局

**文件：`app/applications/[draftId]/page.tsx`**（+4 行）

完成：
- 顶层 `<main>` 增加了 `overflow-x-hidden`，作为全局溢出兜底。

### 2.7 其他相关文件（本次会话间接涉及）

| 文件 | 改动概述 |
|---|---|
| `lib/services/snapshot/snapshot-composer.ts` | 集成 text-cleaner，修复循环依赖 |
| `lib/ai/model-gateway.ts` | 微调模型选择逻辑 |
| `lib/ai/model-provider-config.ts` | provider 配置 |
| `lib/services/analysis/suggestion-action-service.ts` | 接受/拒绝建议的写入逻辑 |
| `components/preview/template-professional-cn.tsx` | 简历模板视觉微调 |
| `components/preview/export-pdf-button.tsx` | PDF 导出按钮 |
| `lib/services/export/preview-renderer.ts` | 预览渲染器 |
| `playwright.config.ts` | E2E 配置 |
| `prompts/rewrite_expert.md` | AI 改写 prompt |

---

## 3. 用户本次会话提出的问题与反馈记录

以下是用户在本次会话中提出的主要问题，每个问题的**根本原因**和**修复状态**：

| # | 用户反馈 | 根本原因 | 修复状态 |
|---|---|---|---|
| 1 | 建议改成的内容都是废话，没有实际改后的内容 | `afterText` 使用了"元语言"模板话术，没有输出实际改写句子 | ✅ 已修复（deterministic 路径）|
| 2 | 智能修正给整没了 | 重构时误删了 `normalizeOcrResumeText` 调用 | ✅ 已恢复 |
| 3 | Module parse failed: 重复声明 | `snapshot-composer.ts` 中 import 重复 | ✅ 已修复 |
| 4 | 还是废话（"这段经历与目标JD相关性较弱"这类） | UI 层直接显示 `reasonText` 而非改写后内容 | ✅ 已修复 UI 结构 |
| 5 | rewriteFactForJd is not a function | 函数未导出 | ✅ 已导出 |
| 6 | 改后内容还是废话，T 型表格三栏太重复 | 布局设计问题，三栏展示了相同维度 | ✅ 已合并为 T 型双栏 |
| 7 | 省略号，改写内容截断 | 字符串拼接逻辑没有完整生成句子 | ✅ 已修复生成逻辑 |
| 8 | T 型理解没问题，执行不到位，项目标题全是内容 | 标题和内容分割逻辑错误 | ✅ 已修复（锚点方案）|
| 9 | 内容填充错误，原始表达没内容 | 切割逻辑 `slice` 起止点错误 | ✅ 已修复 |
| 10 | 还有一个项目没有识别出来，AI 改写深度分析还是很烂 | 只有单项目处理逻辑，改写质量低 | 🔶 已部分修复（多项目框架已建立，改写质量提升有限）|
| 11 | 两个项目改写内容一样，策略文字减少空间，按钮太大不匹配，项目名称识别有误 | afterText 拆分未按日期锚点做、按钮未缩小、OCR 文本无层级 | 🔶 已部分修复（按钮已缩小，拆分已改进，识别仍有误差）|
| 12 | 接受两个项目的按钮后不会自动收起 | `onActionComplete` 没有多项目完成状态追踪 | ❌ 未完全解决 |
| 13 | 内容直接超出屏幕了 | CSS 溢出防御不足 | 🔶 已多次修复，用户报告问题仍存在 |
| 14 | 每次打开网页都打不开（browser_subagent） | browser_subagent 在此环境下无法连接本地 dev server | ❌ 环境限制，无法在代理中打开 localhost |

---

## 4. 仍未解决的关键问题（给下一位工程师）

### 4.1 横向溢出（最高优先级）

**现象**：`/applications/[draftId]` 页面出现横向滚动条，内容超出屏幕。

**推荐排查步骤**：
1. 打开 Chrome DevTools → Elements 面板。
2. 在控制台执行：
   ```js
   const overflowing = [...document.querySelectorAll("*")].filter(el => el.scrollWidth > el.clientWidth + 1);
   console.table(overflowing.map(el => ({ tag: el.tagName, class: el.className.slice(0, 60), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })));
   ```
3. 最可能的罪魁祸首：`SuggestionActionBar` 的 `scale-90 origin-right`（transform 不影响布局流但影响视觉绘制）。
4. 修复方案：移除 `scale-90`，改为直接将按钮 `px` 和 `py` 及 `text-[11px]` 缩小，不使用 CSS transform。

### 4.2 项目标题识别不准确

**现象**：第二个项目的标题包含了上一个项目的末尾内容（如"一键导出与投递记录 AI 工具自媒体内容运营"）。

**根本原因**：OCR 识别结果存储为纯文本 blob，没有结构化标题层级。当前用日期锚点回溯查找标题，但如果项目内容和下一个项目标题之间没有明确换行，回溯会取错。

**推荐修复方案**：
- 在 `lib/services/ingestion/` 层新增"简历结构解析"服务，在 ingestion 时就识别出：
  ```json
  {
    "section": "project",
    "entries": [
      { "name": "OfferYou AI 岗位定制简历助手", "dateRange": "2026.03 - 至今", "bullets": ["..."] },
      { "name": "AI 工具自媒体内容运营", "dateRange": "2026.03 - 至今", "bullets": ["..."] }
    ]
  }
  ```
- 将结构化数据存储到数据库，供 Suggestion 生成和 UI 展示直接使用，彻底告别正则解析。

### 4.3 多项目改写内容相同

**现象**：两个项目在 JD 深度分析改写列显示相同内容。

**根本原因**：AI 路径（DeepSeek/rewrite endpoint）输出的 `afterText` 是合并的，前端无法区分两个项目的改写边界。

**推荐修复方案**：
1. 在 `prompts/rewrite_expert.md` 中增加：如果输入包含多个项目，必须按项目分段输出，格式：`## 项目 1: {项目名}\n{改写内容}\n\n## 项目 2: {项目名}\n{改写内容}`。
2. 在 `suggestion-action-service.ts` 中解析此格式，将 `afterText` 拆分为 `afterTextPerEntry: string[]` 存储。
3. UI 层按 index 取对应改写，而不是全部显示同一个 `afterText`。

### 4.4 自动收起逻辑

**现象**：点击两个项目的接受/拒绝后，该建议栏目不会自动收起。

**推荐修复方案**：
- 将"完成状态"提升至 Suggestion 级别。当 `suggestion.status !== "pending"` 时，`useEffect` 中自动将 `expandedId` 设为 `null`（前提：建议列表在 refresh 后将已处理建议移除或标记）。
- 或者在 `onActionComplete` 中直接检查"该 suggestion 是否是最后一个未处理建议"，如果是则执行收起。

### 4.5 AI 改写质量（DeepSeek 路径）

**现象**：点击"继续微调"后 DeepSeek 的改写仍然产出"AI 废话"（元语言、模糊描述）。

**推荐修复方案**：
1. 查看 `prompts/rewrite_expert.md`，当前 prompt 是否已明确禁止输出"基于..."、"围绕..."等元语言。
2. 在 prompt 中增加 Few-shot 示例：
   - **坏例子**：`围绕数据分析和结果表达强化这段经历的表达...`
   - **好例子**：`独立主导 AI 工具从 0 到 1 产品定义，设计三阶段改写流程（解构→导师式优化→快照派生），覆盖 PDF/Word/图片三种输入格式，当前 MVP 已可端到端运行。`
3. 降低 temperature（当前建议 `temperature: 0.3`），减少创意发散，增加确定性。

---

## 5. 给下一位工程师的接手建议

**优先级 P0（阻塞体验）**：
1. 用 DevTools 定位并彻底修复横向溢出（预计 30 分钟内可解决）。
2. 修复自动收起逻辑（在 `onActionComplete` 中正确设置 `setExpandedId(null)`）。

**优先级 P1（核心功能正确性）**：
3. 在 ingestion 层新增简历结构化解析，解决项目标题识别问题（根本性修复）。
4. 在 AI prompt 中要求多项目分段输出，解决改写内容相同问题。

**优先级 P2（体验提升）**：
5. 优化 AI 改写质量（prompt few-shot + temperature 调低）。
6. 实现"JD 能力缺口提醒"：如果 JD 里某个关键能力在简历里完全找不到，应当高亮提示用户。

---

## 6. 关键文件速查

| 文件 | 职责 |
|---|---|
| `components/applications/suggestion-list.tsx` | 建议列表 UI，T 型布局，多项目拆分 |
| `components/applications/suggestion-action-bar.tsx` | 接受/编辑/拒绝/微调按钮（含 compact 模式）|
| `lib/services/analysis/suggestion-generator.ts` | 确定性改写生成，多项目拆分逻辑 |
| `lib/services/analysis/workspace-data.ts` | 建议数据加载，hot-fix 层（旧建议自动重写）|
| `lib/services/analysis/text-cleaner.ts` | OCR 纠错（OfferYou 等常见识别错误）|
| `lib/services/snapshot/snapshot-composer.ts` | 从 draft + 已接受建议组装新简历 |
| `prompts/rewrite_expert.md` | DeepSeek AI 改写 prompt |
| `app/applications/[draftId]/page.tsx` | 分析工作台页面，含 overflow-x-hidden |

---

## 7. 环境说明

- **Dev Server**：`pnpm dev`，运行在 `http://127.0.0.1:3000`。
- **AI 模型**：`deepseek-chat`（OpenAI Compatible），通过 `lib/ai/model-gateway.ts` 调用。
- **browser_subagent / CDP 限制**：当前 Antigravity 的 `browser_subagent` 工具无法直接访问 `localhost:3000`，调试页面问题需由工程师在本地 Chrome DevTools 手动操作。Playwright E2E 测试可以在 `tests/e2e/` 下运行。
- **工作分支**：`phase3-batch28`（worktree 位置：`/tmp/superpowers/worktrees/OfferYou/phase3-batch28`）。
