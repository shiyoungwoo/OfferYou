# OfferYou V3.1 交接文档

## 当前状态
项目已完成一轮链路收口，核心产品路径已经从「分析 -> 接受建议 -> 同步预览稿 -> 最终导出 PDF」连起来了。  
当前工作区仍有未提交修改，适合直接交给后续模型继续做细节收尾和稳定性排查。

## 已完成
1. AI 失败态已收口为中文可读原因。
   - `lib/ai/model-gateway.ts` 已补强失败归因。
   - `components/applications/analysis-summary-panel.tsx` 会显式展示「本次分析没有直接返回 AI 结果，已切换到确定性回退」。
2. 接受修改建议后会自动同步预览稿。
   - `lib/services/analysis/suggestion-action-service.ts` 在 `accept` 后会重建 snapshot。
   - 预览页读取的是最新 snapshot，不再只停留在旧稿。
3. 确认与导出语义已收拢。
   - `components/applications/snapshot-generate-button.tsx` 已改成「同步到预览稿」。
   - `components/preview/export-pdf-button.tsx` 保留唯一的最终导出确认。
4. 相关测试已补齐并通过。
   - AI 错误归类测试。
   - 建议接受后快照同步测试。
   - 分析状态提示测试。
   - 同步按钮与导出按钮测试。

## 已验证
```bash
pnpm exec tsc --noEmit
pnpm exec vitest run tests/unit/ai/model-gateway.test.ts tests/integration/suggestions/suggestion-action-service.test.ts tests/unit/applications/analysis-summary-panel.test.tsx tests/unit/applications/snapshot-generate-button.test.tsx tests/unit/preview/export-pdf-button.test.tsx
```

## 未完成
1. `playwright` 的 e2e 主链路仍卡住。
   - 命令：`pnpm exec playwright test tests/e2e/vnext-create-preview-export.spec.ts`
   - 现象：进程长时间无返回，像是浏览器或页面加载层面卡住。
2. `app/applications/new/page.tsx` 的文案还保留「先同步到预览稿，再在预览页确认无误后导出 PDF」。
   - 这句是当前流程的真实描述，但如果继续收口，可以再压缩成更短的动作文案。
3. 仍有本地运行产物未提交。
   - `dev.log`
   - `server.log`
   - `offeryou.sqlite`

## 关键文件
- `lib/ai/model-gateway.ts`
- `lib/services/analysis/suggestion-action-service.ts`
- `components/applications/analysis-summary-panel.tsx`
- `components/applications/snapshot-generate-button.tsx`
- `components/preview/export-pdf-button.tsx`
- `tests/unit/ai/model-gateway.test.ts`
- `tests/integration/suggestions/suggestion-action-service.test.ts`
- `tests/unit/applications/analysis-summary-panel.test.tsx`
- `tests/unit/applications/snapshot-generate-button.test.tsx`
- `tests/unit/preview/export-pdf-button.test.tsx`

## 建议下一步
1. 先排查 `playwright` 卡住原因，确认主链路 e2e 能稳定跑完。
2. 再决定是否把「同步到预览稿」按钮继续弱化成纯状态同步，减少用户对“确认”语义的误解。
3. 如果要继续收口，再看是否需要把 AI 失败态写得更轻一点，避免分析面板首屏过重。

## 备注
- 当前改动已经足够支撑本地使用，但还不是一个完全稳定的发布点。
- 后续接手时，优先沿着「链路稳定性」而不是「视觉细节」推进。
