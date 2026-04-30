# OfferYou 项目执行约束

## 当前冻结规则

- 当前主链路已经收口为「上传简历 / JD → 简历结构校准 → JD 定制改写建议 → 人工确认 → 同步预览 → 导出 PDF」。
- 当前简历模板视为稳定资产：`Professional CN` 与 `ATS Clean` 的结构、颜色、导出一致性默认不再修改。
- 后续除非用户明确要求「修改模板 / 改排版 / 改颜色 / 改导出样式」，不要主动调整简历模板。
- 后续优化优先放在 AI 改写质量、PDF 解析稳定性、字段识别准确率、建议接受后的同步一致性。

## 验证要求

- 修改预览或导出链路后，至少运行 `pnpm exec tsc --noEmit`。
- 修改模板后，至少运行预览相关测试，并用真实浏览器截图确认 `Professional CN` 与 `ATS Clean`。
- 不提交 `.env.local`、`storage/`、`.next/`、`node_modules/`、日志、SQLite 数据库和导出 PDF。
