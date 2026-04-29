# OfferYou 项目进度审查

## 审查时间
2026-04-26

## 当前进度
- 主链路已跑通：创建 Draft、生成建议、接受建议、生成 Snapshot、预览、导出 PDF、生成投递记录。
- PDF 导出当前可用，昨晚已生成过可检查 PDF，并完成视觉检查。
- 简历排版暂定，不继续在当前轮次大改。
- job-apply 质量样本链路仍通过测试。
- 昨晚收口记录已保存到 `docs/plans/2026-04-25-vnext-wrap-up.md`。
- 2026-04-26 的低模型修复计划已经执行完成，结果记录在 `docs/plans/2026-04-26-low-model-fix-report.md`。

## 已验证命令
```bash
pnpm exec tsc --noEmit
pnpm exec vitest run tests/unit/snapshot/snapshot-composer.test.ts tests/unit/preview/preview-renderer.test.tsx tests/unit/preview/export-pdf-button.test.tsx tests/unit/preview/resume-template-switch.test.tsx tests/unit/me/model-provider-status-card.test.tsx tests/unit/ingestion/extract-text.test.ts tests/unit/analysis/gap-analysis-service.test.ts tests/integration/job-apply/job-apply-quality.test.ts
pnpm run check:vnext
```

## 代码问题
- `lib/services/export/preview-renderer.ts` 的服务端页数估算仍按 section item 数量粗估，不是真实渲染高度。预览端已有真实高度测量，但服务端导出前仍缺少真实页高校验。
- PDF 解析成功日志已放到 `OFFERYOU_DEBUG_INGESTION=1` 调试开关后面，原先终端噪音问题已处理。
- 昨晚临时加入的照片展示仍在代码里，但最新产品结论是后续不要照片。下一轮需要移除上传照片入口、预览照片框、PDF 导出照片框。
- 修改建议目前偏弱相关，下一轮要重点修建议筛选、排序和强相关经历优先策略。

## 保存状态
- 代码文件均保留在当前工作区。
- 当前改动尚未提交为 git commit。
- 若需要长期保存和跨会话迁移，下一步应先做一次提交或打包当前工作区。

## 下一轮建议顺序
1. 移除照片链路，确保预览和 PDF 都不再出现照片框。
2. 修复修改建议偏弱相关的问题，让建议更贴近目标 JD。
3. 将服务端页数估算升级为真实渲染高度检测。
4. 再做一次完整 PDF 导出和视觉检查。
