# OfferYou AI 与代码职责边界落地计划

> 本计划来自 Obsidian 项目文档 `OfferYou-AI与代码职责边界-v3.3.md` 与 `2026-05-07-OfferYou-AI代码职责边界修改计划.md`。  
> 执行前必须确认：Professional CN 与 ATS Clean 简历模板视觉冻结，不得主动修改。

## 1. 核心原则

OfferYou 不是「规则工作流外面套一层 AI」，而是「Agent 内核 + Web 交互界面」。

代码负责确定性工作：保存、路由、状态、文件解析、格式转换、导出、校验、权限和可追溯。

AI 负责非确定性判断：理解、比较、取舍、归因、改写、策略、校验和面试准备。

天赋挖掘不是可选增强。完成天赋挖掘后，OfferYou 才进入最大能力模式。天赋画像提供「用户模型」，JD 提供「机会模型」，简历事实提供「证据模型」。Agent 的核心任务是在三者之间找到最适合用户的职业表达。

## 2. 节点职责

| 节点 | 主责 | 是否必须 AI | 失败处理 |
|---|---|---:|---|
| 文件接收 | 代码 | 否 | 拒绝无效文件，提示原因 |
| PDF / DOCX / TXT 解析 | 工具 + 代码 | 否 | 解析失败进入人工粘贴文本 |
| 视觉布局校准 | AI | 是，若原始解析低置信 | 模型不可用时标记「需人工确认」，不自动下游改写 |
| 简历结构校准 | AI 主责，代码守边界 | 是 | 低置信项必须人工确认 |
| 天赋挖掘 | AI | 是 | 未完成时进入岗位定制模式，不进入最大能力模式 |
| JD 理解 | AI | 是 | 模型不可用时停止 AI 定制，只允许人工编辑 |
| 匹配度与差距分析 | AI 主责，代码辅助 | 是 | 规则分数只能标记为「粗略参考」 |
| 改写策略 | AI 主责，代码约束 | 是 | 模型不可用时不得生成「AI 优化改写」 |
| 改写建议 | AI | 是 | 失败则提示模型问题，允许用户手动编辑 |
| 事实校验 | AI + 代码 | 是 | `fail` 不允许普通接受，只能编辑或重新 AI 微调 |
| 人工确认 | 代码 | 否 | 并发冲突时提示刷新或重试 |
| FinalResumeDraft 合成 | 代码 | 否 | 缺少关键字段时提示人工补充 |
| 预览与 PDF 导出 | 代码 | 否 | 导出失败提示重试，不改模板视觉 |
| 面试准备 | AI | 是 | 模型不可用时不生成伪面试准备 |
| 投递记录 | 代码 | 否 | 写入失败提示用户 |

## 2.1 JD 输入模式与模型分层

JD 输入不再只有一种处理方式，但不做过度分层。当前只保留三档，默认使用「标准 AI」：

| 模式 | 适用输入 | 主责 | 自动继续条件 | 失败处理 |
|---|---|---|---|---|
| 基础模式 | 模型不可用、用户只想手动填、低成本文本处理 | 代码 + 轻量文本模型 | 文本可靠且模型可用时可做轻量理解 | 用户手动填写公司、岗位、JD 正文 |
| 标准 AI | 文本 JD、PDF/网页文本、普通 JD 截图 | 工具 + OCR 版面 + 模型 + 用户确认 | 文本可靠；截图需有版面块、模型可用、用户确认当前岗位 | 不允许只靠 OCR 文字继续 |
| 高质量 AI | 多公司混排截图、重要投递 | 视觉模型 + 用户确认 | 视觉模型可用且用户确认 | 模型不可用则回到基础模式 |

截图 JD 的关键规则：

- 不允许再用「字符长度足够」判断 OCR 可用。
- OCR 只负责取字和坐标，不负责判断当前 JD 属于哪个公司。
- 如果截图里存在多个公司或多个岗位，必须让用户确认当前公司、岗位和 JD 正文。
- 没有视觉模型时，不能把截图识别包装成 AI 理解。

模型分层：

- 小米 MiMo 普通文本节点默认 `mimo-v2.5`。
- 小米 MiMo 复杂推理节点默认 `mimo-v2.5-pro`。
- 小米 MiMo 截图/视觉识别预留 `mimo-v2.5`，因为 `v2.5-pro` 不作为图片识别模型使用。
- OpenAI Codex OAuth 简单节点默认 `gpt-5.4-mini`，复杂节点默认 `gpt-5.5`；具体模型 ID 通过环境变量覆盖，避免供应商权限变化导致硬编码失效。

## 3. 执行批次

### 批次 0：文档与约束同步

允许修改：

- `docs/**`
- `README.md`
- `AGENTS.md`

要求：

- 写明「天赋挖掘是最大能力模式的核心上下文」。
- 写明「模型不可用时只能进入基础编辑模式」。
- 写明「规则兜底不能伪装成 AI 改写」。
- 写明每个主链路节点由 AI 还是代码负责。

验证：

```bash
rg -n "天赋挖掘|TalentProfile|规则兜底|AI 优化改写|职责边界" docs README.md AGENTS.md
```

### 批次 1：运行模式状态落地

允许修改：

- `lib/services/job-apply/agent-run.ts`
- `lib/services/job-apply/job-apply-run-service.ts`
- `tests/unit/job-apply/**`

要求：

- 增加三种模式：`manual_editor`、`job_tailoring`、`talent_driven_agent`。
- 未配置模型时，不得进入正式 AI 生成。
- 未完成 TalentProfile 时，可以进入 `job_tailoring`，但不能标记为最大能力模式。
- 完成 TalentProfile 后，允许进入 `talent_driven_agent`。

验证：

```bash
pnpm test tests/unit/job-apply
pnpm exec tsc --noEmit
```

### 批次 2：模型可用性前置检查

允许修改：

- `lib/ai/**`
- `lib/services/job-apply/job-apply-run-service.ts`
- `tests/unit/ai/**`

要求：

- 增加模型能力检查结果：`configured`、`authenticated`、`callable`。
- 不输出 API Key。
- 模型不可用时返回中文可读原因。
- 必须 AI 的节点不能静默降级为规则生成。

验证：

```bash
pnpm test tests/unit/ai
pnpm test tests/unit/job-apply
pnpm exec tsc --noEmit
```

### 批次 3：简历结构校准改为 AI 主责

允许修改：

- `lib/services/calibration/**`
- `lib/services/ingestion/**`
- `tests/unit/calibration/**`
- `tests/unit/ingestion/**`

要求：

- 代码只能生成候选切块和低置信提示。
- 最终模块归属必须由模型判断。
- 模型不可用时，低置信模块进入人工确认，不继续自动生成改写。
- `CalibratedResumeProfile` 必须包含 `candidateId`、`sectionType`、`rawText`、`confidence`、`issues`。

验证：

```bash
pnpm test tests/unit/calibration
pnpm test tests/unit/ingestion
pnpm exec tsc --noEmit
```

### 批次 4：天赋挖掘进入主线

允许修改：

- `lib/services/talent/**`
- `lib/services/master/**`
- `lib/services/analysis/**`
- `components/master/**`
- `tests/unit/talent/**`
- `tests/unit/master/**`
- `tests/unit/analysis/**`

要求：

- 保存 TalentProfile 时，必须产生可被岗位定制读取的 `MasterInsight`。
- `listMasterInsights` 不能长期返回空数组。
- 岗位定制生成策略时必须读取 TalentProfile / MasterInsight。
- 未完成天赋挖掘时，仍可编辑简历，但标记为基础岗位定制。

验证：

```bash
pnpm test tests/unit/talent
pnpm test tests/unit/master
pnpm test tests/unit/analysis
pnpm exec tsc --noEmit
```

### 批次 5：JD 理解必须 AI 主路径

允许修改：

- `lib/services/analysis/jd-insight.ts`
- `lib/services/analysis/gap-analysis-service.ts`
- `tests/unit/analysis/**`

要求：

- 输出公司、岗位、硬要求、核心能力、加分项、避免项、岗位关键词。
- 禁止出现「目标岗位要求的动作」「结果和协作方式」等空泛标签。
- JSON 失败必须 repair 一次。
- repair 失败才停止并提示人工处理。

验证：

```bash
pnpm test tests/unit/analysis/jd-insight.test.ts
pnpm test tests/unit/analysis/gap-analysis-service.test.ts
pnpm exec tsc --noEmit
```

### 批次 6：改写策略与建议模型优先

允许修改：

- `lib/services/analysis/suggestion-generator.ts`
- `lib/services/analysis/suggestion-action-service.ts`
- `components/applications/suggestion-list.tsx`
- `components/applications/suggestion-action-bar.tsx`
- `tests/unit/services/suggestion-generator.test.ts`
- `tests/integration/suggestions/suggestion-action-service.test.ts`

要求：

- 每条建议必须包含 `candidateId`、`beforeText`、`afterText`、`jdAbility`、`reason`、`factAnchors`、`generationMode`。
- `afterText` 禁止省略号。
- `afterText` 不得与 `beforeText` 高度重复。
- 弱相关经历压缩，只保留时间线与可迁移能力。
- 强相关经历强化动作、工具、业务对象和结果。
- 模型不可用时，不生成「AI 优化改写」，只提供手动编辑入口。

验证：

```bash
pnpm test tests/unit/services/suggestion-generator.test.ts
pnpm test tests/integration/suggestions/suggestion-action-service.test.ts
pnpm exec tsc --noEmit
```

### 批次 7：Verifier 守住事实可信

允许修改：

- `lib/services/quality/**`
- `lib/services/analysis/suggestion-action-service.ts`
- `tests/unit/quality/**`
- `tests/integration/suggestions/suggestion-action-service.test.ts`

要求：

- JD、公司、岗位不能作为候选人事实依据。
- `verification.status === "fail"` 时，普通接受按钮不可用。
- 用户必须编辑或 AI 微调后才能继续。
- 页面不展示内部术语，只展示中文可读风险。

验证：

```bash
pnpm test tests/unit/quality
pnpm test tests/integration/suggestions/suggestion-action-service.test.ts
pnpm exec tsc --noEmit
```

### 批次 8：Snapshot 与 PDF 只读最终草稿

允许修改：

- `lib/services/snapshot/**`
- `lib/services/export/**`
- `app/api/records/[recordId]/download/route.ts`
- `tests/unit/snapshot/**`

要求：

- Snapshot 只读取已确认建议和手动编辑内容。
- 个人优势、工作经历、项目经历、教育背景不得重复。
- 英语等级只进入个人信息，不生成补充信息模块。
- 当前选择 ATS Clean 时，导出必须是 ATS Clean。
- 不修改冻结模板视觉。

验证：

```bash
pnpm test tests/unit/snapshot
pnpm run test:pdf
pnpm exec tsc --noEmit
```

### 批次 9：面试准备读取最终上下文

允许修改：

- `lib/services/interview/**`
- `tests/unit/interview/**`

要求：

- 不允许直接读取原始 OCR 文本生成面试准备。
- 输出包含自我介绍、5 个高频问题、3 个追问方向、风险问题应答。
- 每个问题至少关联一个岗位能力或简历证据。

验证：

```bash
pnpm test tests/unit/interview
pnpm exec tsc --noEmit
```

### 批次 10：真实样本验收与报告

允许修改：

- `docs/quality/job-apply-parity-report.md`
- `docs/quality/offeryou-self-use-goal-acceptance.md`
- 必要脚本与 fixture。

要求：

- 至少三组样本：AIPM、AI 应用 / 内容运营、弱相关转岗。
- 每组记录 `generationMode`、`fallbackReason`、事实风险、重复度、PDF 路径。
- 至少一组必须使用原始 PDF 简历和真实 JD，而不是 `job-apply` 已生成 Markdown 产物。
- 若模型不可用，报告结论必须写「不能验证 AI 能力」。

验证：

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm run test:pdf
pnpm run check:vnext
```

## 4. 最终验收

- 文档明确区分 AI 节点和代码节点。
- 天赋挖掘被纳入 Agent 主线。
- 模型不可用时，系统不会伪装成 AI 改写。
- 简历结构校准、JD 理解、改写、Verifier、面试准备均有模型主路径。
- FinalResumeDraft 是预览、PDF、面试准备的唯一来源。
- Professional CN 和 ATS Clean 模板视觉未被修改。
- 三组真实样本报告能诚实说明是否接近 `job-apply` Skill。
