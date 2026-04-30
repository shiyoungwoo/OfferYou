# OfferYou 2026-04-30 收口交接

## 当前状态

本轮已经把 OfferYou Web 端重新收回到可自用的主链路：

- 简历 PDF / 原始简历解析进入结构校准。
- 模型优先使用 OpenAI 兼容接口，小米 MiMo 可通过 `MIMO_API_KEY`、`MIMO_BASE_URL`、`MIMO_MODEL` 配置。
- 岗位分析页保留顶部匹配度、岗位匹配优势、同步预览入口。
- 简历优化建议采用 T 型结构：左侧原始证据，右侧 AI 根据 JD 和个人优势改写。
- 建议确认后进入快照，预览页读取确认后的简历稿。
- `Professional CN` 与 `ATS Clean` 两套模板均可用。

## 当前冻结结论

- 当前所有主链路逻辑和简历模板暂时冻结。
- 除非用户明确要求，不要再主动调整简历模板、颜色、页头结构、正文排版。
- 后续重点不在 UI 模板，而在 AI 改写质量、解析准确率和确认链路稳定性。

## 模板现状

- `Professional CN`：居中页头，深蓝主色，统一圆点条目，适合更有设计感的互联网 / AI 岗位投递。
- `ATS Clean`：左侧姓名与岗位，右侧个人信息两列，颜色保持克制灰黑，适合简洁 ATS 风格。
- 页头过滤规则：`GitHub`、`作品集`、`居住地` 等字段未填写时不显示；填写后才显示。

## 已知保留问题

- AI 改写质量仍未达到单独运行 `job-apply` Skill 的理想水平。
- 解析、校准、改写已经可用，但复杂 PDF 仍需要人工确认。
- 当前 SQLite、上传文件、导出 PDF 属于本地运行数据，不作为版本资产提交。

## 下次继续建议

1. 不要先改模板。
2. 优先做真实样本对照评测：同一份 JD + 简历，比较 `job-apply` Skill 输出和 Web 端输出。
3. 把差距集中到提示词、模型选择、结构化输入，而不是继续堆 UI。
4. 修改后必须验证预览和导出 PDF 一致。

## 验证命令

```bash
pnpm exec tsc --noEmit
pnpm run check:vnext
pnpm exec vitest run tests/unit/preview/preview-renderer.test.tsx tests/unit/preview/resume-template-switch.test.tsx tests/unit/preview/preview-workspace.test.tsx
```
