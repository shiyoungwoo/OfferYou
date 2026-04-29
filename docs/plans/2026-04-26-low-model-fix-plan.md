# OfferYou 低模型精确执行计划

## 执行目标
本计划只处理 3 个已确认问题：

1. 去掉照片链路：后续简历不要照片，预览和 PDF 都不能出现照片框。
2. 修复修改建议偏弱相关：fallback 建议必须优先选与目标 JD 更相关的经历。
3. 修复服务端页数粗估：导出前和 Snapshot 返回的 `pageEstimate` 不能继续只按条目数估算。

## 总规则
- 严格按批次顺序执行。
- 每批只能修改该批「允许修改文件」里列出的文件。
- 每批完成后必须运行该批验证命令。
- 任一验证失败，立即停止，不继续后续批次。
- 不要改 Obsidian 原始知识库文件。
- 不要重构无关页面，不要改视觉主题，不要改数据库结构。
- 不要删除已有历史记录字段；可保留兼容字段，但 UI、预览和 PDF 不能再展示照片。

## 批次 1：移除照片展示和上传入口

### 目标
- 新建投递页不再出现「上传照片」入口。
- Snapshot 不再生成 `header.photo`。
- `Professional CN`、`ATS Clean` 预览模板不再展示照片框。
- PDF 导出 HTML 不再渲染照片框。
- 旧数据里即使有 `header.photo`，也不会显示在预览或 PDF 中。

### 允许修改文件
- `components/applications/new-application-form.tsx`
- `components/preview/template-professional-cn.tsx`
- `components/preview/template-ats-clean.tsx`
- `lib/services/export/preview-renderer.ts`
- `lib/services/snapshot/snapshot-composer.ts`
- `tests/unit/snapshot/snapshot-composer.test.ts`
- `tests/unit/preview/preview-renderer.test.tsx`
- `tests/unit/preview/resume-template-switch.test.tsx`

### 具体步骤
1. 在 `components/applications/new-application-form.tsx`：
   - 删除 `Camera` import。
   - 删除 `profilePhotoAssetRef`、`photoUploadName`、`photoUploadState` 三个 state。
   - 删除 `handlePhotoFileChange` 函数。
   - 删除 `clearPhotoUpload` 函数。
   - `handleSubmit` 的 payload 删除 `profilePhotoAssetRef`。
   - 简历上传区域删除第二个 `UploadCard`，只保留「上传现有简历」。
   - 简历上传区域容器从双列改为单列，例如 `className="mt-6"`。
2. 在 `lib/services/snapshot/snapshot-composer.ts`：
   - 删除 `const photo = await buildPhotoPayload(...)`。
   - `header` 中删除 `photo` 字段。
   - 删除 `buildPhotoPayload` 和 `inferPhotoMimeType` 函数。
   - 保留 `profilePhotoAssetRef` 在 draft 类型里的兼容性，不要改数据库。
3. 在 `components/preview/template-professional-cn.tsx`：
   - 删除 `<PhotoFrame document={document} />`。
   - 删除 `PhotoFrame` 函数。
   - header 可保留 `flex`，但不要留右侧空白照片位。
4. 在 `components/preview/template-ats-clean.tsx`：
   - 删除 `<PhotoFrame document={document} />`。
   - 删除 `PhotoFrame` 函数。
5. 在 `lib/services/export/preview-renderer.ts`：
   - 删除 `const photo = renderPhoto(document)`。
   - 删除 `${photo}`。
   - 删除 `.photo-frame` 和 `.photo-frame img` CSS。
   - 删除 `renderPhoto` 函数。
6. 更新测试：
   - 删除 `tests/unit/snapshot/snapshot-composer.test.ts` 中对 `document.header.photo?.label` 的断言。
   - 如预览测试依赖照片框，改成断言姓名、岗位、联系人和 section 仍正常渲染。

### 验证命令
```bash
pnpm exec tsc --noEmit
pnpm exec vitest run tests/unit/snapshot/snapshot-composer.test.ts tests/unit/preview/preview-renderer.test.tsx tests/unit/preview/resume-template-switch.test.tsx
rg -n "PhotoFrame|photo-frame|上传照片|照片已上传|header\\.photo|renderPhoto" components lib tests
```

### 验收标准
- `tsc` 通过。
- 相关测试通过。
- `rg` 结果中不能再出现可见照片展示、上传入口、照片框函数。
- `lib/document/resume-document.ts` 中允许暂时保留 `photo?` 类型字段作为历史兼容。
- `app/api/uploads/ingest/route.ts` 中允许暂时保留 `profile_photo`，但本轮不再有 UI 调用它。

## 批次 2：修复 fallback 修改建议弱相关

### 目标
- fallback 建议不再直接取前 4 条。
- 候选经历必须按 JD 相关性排序。
- 强相关项目、工作经历优先进入建议列表。
- 弱相关经历可以保留，但必须排后，且输出短建议。

### 允许修改文件
- `lib/services/analysis/suggestion-generator.ts`
- `tests/unit/analysis/gap-analysis-service.test.ts`
- 可新增：`tests/unit/services/suggestion-generator.test.ts`

### 具体步骤
1. 在 `lib/services/analysis/suggestion-generator.ts`：
   - 将 `scoreFactRelevance` 从 `rewriteFactForJd` 附近提到可被 `generateSeedSuggestions` 使用的位置，保持函数不导出也可以。
   - 新增函数：
     ```ts
     function rankSuggestionCandidate(
       fact: SuggestionSeedInput["facts"][number],
       jdText: string,
       index: number
     ) {
       const relevance = scoreFactRelevance(fact.text, jdText);
       const sectionScore =
         fact.section === "project" ? 2 :
         fact.section === "experience" ? 1 :
         fact.section === "summary" ? 0.5 : 0;
       return {
         fact,
         score: relevance * 10 + sectionScore - index * 0.01
       };
     }
     ```
   - 修改 `generateSeedSuggestions`：
     - 先 `const candidates = buildSuggestionCandidates(input)`。
     - `candidates.map(rank...).sort((a,b)=>b.score-a.score).slice(0,4).map(...)`。
     - `id` 仍按最终排序后的 index 生成。
   - 不要改变 AI 模型成功返回时的逻辑，本批只修 deterministic fallback。
2. 加测试：
   - 优先新增 `tests/unit/services/suggestion-generator.test.ts`。
   - 测试输入包含 3 段：
     - 第一段弱相关，例如银行柜员常规柜面操作。
     - 第二段强相关，例如 OfferYou、Prompt、AI 产品、JD 对齐。
     - 第三段中相关，例如数据分析或客户协作。
   - JD 写 `AI 产品经理，需要 Prompt 迭代、需求拆解、AI 工作流、产品方案`。
   - 断言 `generateSeedSuggestions(input)[0].beforeText` 或 `title` 命中 OfferYou/Prompt/AI 产品相关段落。
   - 断言弱相关段落如果进入列表，其 `afterText` 包含「相关性较弱」或明显短于强相关 afterText。
3. 如已有 `gap-analysis-service.test.ts` 断言被排序影响，按新排序更新断言。

### 验证命令
```bash
pnpm exec tsc --noEmit
pnpm exec vitest run tests/unit/analysis/gap-analysis-service.test.ts tests/unit/services/suggestion-generator.test.ts tests/integration/job-apply/job-apply-quality.test.ts
```

### 验收标准
- 强相关经历在 fallback 建议中排第一。
- job-apply 三组质量样本仍通过。
- 不新增任何虚构经历。
- `beforeText` 仍来自原始事实块。

## 批次 3：服务端页数估算改为真实渲染高度

### 目标
- 不再只用 `section.items.length` 作为服务端页数估算。
- 导出 PDF 前能够基于同一份 HTML 真实测量页面高度。
- `generateSnapshotForDraft` 返回的 `pageEstimate` 尽量使用真实渲染测量。
- 保留原 `estimateResumePageCount` 作为无浏览器环境兜底，不直接删除。

### 允许修改文件
- `lib/services/export/preview-renderer.ts`
- `lib/services/export/pdf-export-service.ts`
- `lib/services/export/resume-export-service.ts`
- `lib/services/snapshot/snapshot-service.ts`
- `tests/unit/preview/preview-renderer.test.tsx`
- `tests/integration/export/resume-export-service.test.ts`
- `tests/integration/job-apply/job-apply-pdf-export.test.ts`

### 具体步骤
1. 在 `lib/services/export/pdf-export-service.ts`：
   - 新增导出函数 `measureResumeHtmlPageCount(html: string): Promise<number>`。
   - 复用 Playwright Chromium。
   - viewport 使用 `{ width: 794, height: 1123 }`。
   - `page.emulateMedia({ media: "print" })`。
   - `page.setContent(html, { waitUntil: "load" })`。
   - 用 `page.evaluate` 读取：
     ```ts
     const height = document.documentElement.scrollHeight;
     return Math.max(1, Math.ceil(height / 1123));
     ```
   - 如需要更准确，可优先读取 `article.getBoundingClientRect().height`，取 `documentElement.scrollHeight` 和 `articleHeight` 的较大值。
   - 确保 browser 在 finally 中关闭。
2. 修改 `renderPdfFromHtml`：
   - 在生成 PDF 前调用同样的高度测量逻辑，返回结果中增加 `pageCount`。
   - `RenderPdfInput` 返回对象增加 `pageCount: number`。
   - 不改变 PDF 文件保存逻辑。
3. 在 `lib/services/export/resume-export-service.ts`：
   - 接收 `renderPdfFromHtml` 返回的 `pageCount`。
   - 返回 API payload 时带上 `pageCount`。
4. 在 `lib/services/snapshot/snapshot-service.ts`：
   - 新增异步函数：
     ```ts
     async function estimateSnapshotPageCount(document: ResumeDocument) {
       try {
         const html = renderResumeDocumentHtml(document);
         return await measureResumeHtmlPageCount(html);
       } catch {
         return estimateResumePageCount(document);
       }
     }
     ```
   - `generateSnapshotForDraft` 的 `pageEstimate` 改用该异步函数。
   - 需要从 `preview-renderer` import `renderResumeDocumentHtml`，从 `pdf-export-service` import `measureResumeHtmlPageCount`。
5. 测试更新：
   - `preview-renderer.test.tsx` 保留 `estimateResumePageCount` 的兜底测试，但文案说明它是 fallback。
   - `resume-export-service.test.ts` 和 `job-apply-pdf-export.test.ts` 若断言返回字段，增加 `pageCount` 或 `pageEstimate` 断言。

### 验证命令
```bash
pnpm exec tsc --noEmit
pnpm exec vitest run tests/unit/preview/preview-renderer.test.tsx tests/integration/export/resume-export-service.test.ts tests/integration/job-apply/job-apply-pdf-export.test.ts tests/unit/snapshot/snapshot-composer.test.ts
```

### 验收标准
- `generateSnapshotForDraft` 的 `pageEstimate` 优先来自真实 HTML 渲染高度。
- PDF export API 返回真实测量后的 `pageCount`。
- 浏览器无法启动时仍能 fallback 到旧估算，不让主链路崩溃。
- 旧的 `paginateDocument` 可以保留，但需要在注释或测试名里标明它是 fallback 粗估。

## 批次 4：最终回归和留档

### 目标
- 确认三项修复没有破坏主链路。
- 更新项目留档，方便下一次继续。

### 允许修改文件
- `docs/plans/2026-04-26-project-progress-audit.md`
- 可新增：`docs/plans/2026-04-26-low-model-fix-report.md`

### 具体步骤
1. 跑完整关键检查。
2. 新增或更新执行报告，写清：
   - 去照片是否完成。
   - fallback 建议是否按 JD 相关性排序。
   - 服务端页数估算是否变成真实渲染高度。
   - 哪些命令通过。
   - 哪些风险保留。

### 验证命令
```bash
pnpm exec tsc --noEmit
pnpm exec vitest run tests/unit/snapshot/snapshot-composer.test.ts tests/unit/analysis/gap-analysis-service.test.ts tests/unit/preview/preview-renderer.test.tsx tests/unit/preview/export-pdf-button.test.tsx tests/unit/preview/resume-template-switch.test.tsx tests/unit/ingestion/extract-text.test.ts tests/integration/job-apply/job-apply-quality.test.ts
pnpm run check:vnext
rg -n "PhotoFrame|photo-frame|上传照片|照片已上传|renderPhoto" components lib tests
```

### 验收标准
- 所有验证命令通过。
- `rg` 不再命中照片 UI 和照片渲染。
- 留档文件写清本次执行结果。
- 不要求本批生成 git commit，但必须在最终汇报中说明工作区仍未提交。

## 阻塞汇报格式
如果任一批失败，停止后按下面格式汇报：

```md
## 阻塞批次
批次 X：名称

## 失败命令
`这里写命令`

## 失败原因
用 3-5 句话说明报错和判断。

## 已修改文件
- 文件 1
- 文件 2

## 建议下一步
只写一个最小下一步。
```
