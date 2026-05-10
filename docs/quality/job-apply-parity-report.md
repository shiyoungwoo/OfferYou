# OfferYou 与 job-apply Skill 对齐质量报告

生成日期：2026-05-06

## 当前结论

OfferYou 已经从「页面壳子优先」转向 Agent-first 主线，但距离 job-apply Skill 的稳定体验仍有差距。当前代码已把 JD 理解、简历结构校准、改写建议和面试准备放到模型优先路径；当模型不可用时，链路会显式记录 `deterministic_fallback`，不能伪装成 AI 改写。

本轮补强重点：

- JD 理解新增模型优先路径，输出 `JDInsight` 时记录 `generationMode`、`modelProvider` 与中文降级原因。
- 模型改写建议缺少 `candidateId` 时，不再按数组顺序绑定，而是优先按 `beforeText` 与校准候选块做文本重叠匹配，降低 A 项目内容写入 B 项目的风险。
- 空泛能力标签会被过滤，避免出现「目标岗位要求的动作」「结果和协作方式」这类不可用标签。

## AI 主线审计

| 阶段 | 当前实现 | 模型使用情况 | 主要风险 |
|---|---|---|---|
| 简历解析与校准 | `lib/services/calibration/resume-calibration-service.ts` | 模型优先，失败后确定性结构恢复 | PDF/OCR 原文质量差时，低置信块仍需人工确认 |
| JD 匹配分析 | `lib/services/analysis/gap-analysis-service.ts` | 模型优先，失败后规则评分 | 无模型时只能得到粗粒度匹配判断 |
| JDInsight | `lib/services/analysis/jd-insight.ts` | 本轮改为模型优先，失败后规则抽取 | 规则抽取仍无法理解复杂 JD 的隐含要求 |
| 改写建议 | `lib/services/analysis/suggestion-generator.ts` | 模型优先，失败后确定性建议 | 模型输出若事实锚点不足，会被 verifier 标记风险 |
| 事实校验 | `lib/services/quality/resume-verifier.ts`、`fact-grounding.ts` | 确定性校验 | 目前是守门员，不是第二模型交叉审稿 |
| Snapshot | `lib/services/snapshot` | 确定性合成 | 依赖已确认建议和 `candidateId` 绑定准确性 |
| 面试准备 | `lib/services/interview/interview-prep-service.ts` | 模型优先，输入来自 Snapshot 与 JDInsight | 模型不可用时会退回模板题 |

## 三组真实 fixture 覆盖

| 样本 | 场景 | 预期能力 | generationMode 判定 | PDF 路径 |
|---|---|---|---|---|
| `aipm` | AIPM / AI 产品经理 | AI 产品、工作流、跨团队协作 | 有模型配置时应为 `model` 或 `model_repaired`；无配置时为 `deterministic_fallback` 并提示原因 | 由 `pnpm run test:pdf` 在临时目录生成；稳定人工产物可用 `pnpm run export:fixtures` 生成 |
| `product-ops` | 产品运营 / 业务分析 | 产品运营、数据分析、复盘 | 同上 | 同上 |
| `ai-content` | AI 应用或内容运营 | AI 内容、流程、模板化交付 | 同上 | 同上 |

## 质量门槛

- 真实模型可用时，核心建议必须出现 `generationMode=model` 或 `generationMode=model_repaired`。
- 模型不可用时，页面、报告和 Agent Run 都必须明确提示规则兜底。
- 每条改写建议必须绑定 `candidateId`，并保留 `beforeText`、`afterText`、`jdAbility`、`reason`、`factAnchors`。
- `verification.status=fail` 的建议不能作为普通可投递内容处理，必须编辑或重新微调。
- Snapshot 与 PDF 必须读取同一份最终草稿，避免预览与导出不一致。

## 距离 job-apply Skill 的差距

- job-apply Skill 更像一次完整 Agent 推理：先读懂材料，再规划，再生成最终简历和面试准备。OfferYou 目前已具备同样的分层结构，但仍受 Web 状态、结构化字段和确认流约束。
- job-apply Skill 可以直接利用会话中的强模型能力；OfferYou 需要通过模型网关、JSON 契约和事实校验把模型能力产品化，因此必须继续提高模型输出质量和错误恢复。
- 当前 verifier 主要是确定性检查，后续若要接近 Skill 体验，需要增加「第二模型审稿」或「模型 revise」链路，让低质量改写自动重写，而不是只提示风险。
