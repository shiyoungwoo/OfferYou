# OfferYou 低模型执行结果

## 已完成
1. 照片链路已移除。
   - 新建投递页不再显示照片上传入口。
   - 预览模板和 PDF 导出模板都不再渲染照片框。
   - Snapshot 不再写入 `header.photo`。
2. 修改建议 fallback 已按 JD 相关性排序。
   - `generateSeedSuggestions` 现在先打分再取前 4 条。
   - 强相关的 `OfferYou / Prompt / AI 产品` 经历会优先排在前面。
3. 服务端页数估算已改为真实渲染高度优先。
   - `generateSnapshotForDraft` 的 `pageEstimate` 改为基于 HTML 渲染测量。
   - `renderPdfFromHtml` 现在返回真实 `pageCount`。

## 已验证
```bash
pnpm exec tsc --noEmit
pnpm exec vitest run tests/unit/snapshot/snapshot-composer.test.ts tests/unit/analysis/gap-analysis-service.test.ts tests/unit/services/suggestion-generator.test.ts tests/unit/preview/preview-renderer.test.tsx tests/unit/preview/export-pdf-button.test.tsx tests/unit/preview/resume-template-switch.test.tsx tests/unit/me/model-provider-status-card.test.tsx tests/unit/ingestion/extract-text.test.ts
pnpm run check:vnext
```

## 直接验证
- 通过本机脚本直接生成过 Snapshot 和 PDF。
- 结果显示 `snapshotPageEstimate = 1`，`exportPageCount = 1`。
- 说明页数测量链路已接回真实渲染页面。

## 保留风险
- 服务端页数估算依赖 Chromium；如果浏览器启动失败，会回退旧的粗估逻辑。
- 当前工作区仍是本地修改状态，尚未做 git commit。

## 下一步
- 如果要继续，建议先看弱相关建议是否还需要更强的排序策略，再决定是否收紧其它经历的文本长度。
