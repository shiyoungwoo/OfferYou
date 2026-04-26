# OfferYou 交接文档：预览主链路修复与后续打磨

生成时间：2026-04-25
当前工作区：`/tmp/superpowers/worktrees/OfferYou/phase3-batch28`
当前可测链接：`http://127.0.0.1:3000/applications/5b6a1196-61c9-4433-ac34-bf1523b316cc/preview`

## 1. 当前目标

OfferYou 当前优先目标不是继续扩功能，而是把「上传简历 → 识别原简历 → 根据 JD 生成建议 → 接受建议 → 生成新简历预览 → 导出 PDF」这条主链路做到可信、可投递。

用户的核心判断标准：

- 上传 PDF 后，原简历里的姓名、联系方式、教育、工作、项目必须进入新简历。
- 接受 AI 修改建议后，建议必须同步到新简历，不允许只停留在建议列表。
- 新简历不能出现系统占位文案，例如「定制化经历表达」「简历快照」等。
- 中文简历不能出现不该出现的英文天赋句。
- PDF 排版要接近 job-apply Skill 的可投递质量，目标 1 页 A4，最多 2 页。

## 2. 已修复内容

### 2.1 PDF 识别链路

文件：`lib/services/ingestion/extract-text.ts`

已修复：

- 原先 PDF 完整性判断只看文件头部，导致很多正常 PDF 被误判为不可解析。
- 现在改为检查头部 `%PDF-` 和尾部 `%%EOF`，避免误杀正常 PDF。
- `pdf-parse` 成功日志已改为仅在 `OFFERYOU_DEBUG_INGESTION=1` 时输出。

状态：

- Review finding 2 里的 `console.log` 问题已处理。
- 如果 reviewer 仍报同一行，属于旧行号或旧 diff，需要重新确认文件现状。

### 2.2 Snapshot 同步原简历信息

文件：`lib/services/snapshot/snapshot-composer.ts`

已修复：

- OCR/PDF 提取出的「吴 世 阳」会规范成「吴世阳」。
- 带空格标题如「项 目 经 历」「工 作 经 历」「教 育 经 历」可以识别。
- 原简历中的工作经历、项目经历、教育背景会进入新简历。
- 当前测试 draft 已确认识别到：
  - 姓名：吴世阳
  - 手机：18513449520
  - 邮箱：434995517@qq.com
  - 学历：对外经济贸易大学 · 硕士
  - 工作经历：陕西怡阳医疗科技有限公司、广发银行北京分行、北京金山云网络技术有限公司
  - 项目经历：OfferYou、AI 工具自媒体内容运营

### 2.3 接受建议同步到新简历

文件：`lib/services/snapshot/snapshot-composer.ts`

已修复：

- AI 返回的中文 section，例如「项目经历」「工作经历」「个人优势」，现在会归一到内部 section。
- 接受建议后，项目建议和工作建议会进入 Snapshot。
- 不再出现「定制化经历表达」这种占位标题。
- 同一项目的原始版和改写版会去重，保留改写版，再保留另一个不同项目。

### 2.4 当前预览细节修复

已修复：

- 姓名下目标职位不再固定为表单残留的「客户成功经理」。
- 当 JD 明显是 Prompt、AI 对话、数据生成类岗位时，当前 Snapshot 会推断为「AI Prompt 产品专员」。
- 个人优势里的纯英文天赋句已过滤。
- AI 建议里的 Markdown 符号如 `**`、反引号、`$` 会在写入简历前清洗。

当前 draft 重新生成后的摘要：

```json
{
  "title": "AI Prompt 产品专员",
  "work": [
    "陕西怡阳医疗科技有限公司",
    "广发银行北京分行",
    "北京金山云网络技术有限公司"
  ],
  "project": [
    "OfferYou｜AI 岗位定制简历助手",
    "AI 工具自媒体内容运营 （个人项目）"
  ]
}
```

## 3. 已验证命令

已通过：

```bash
pnpm test -- tests/unit/snapshot/snapshot-composer.test.ts
```

实际运行结果：

- 38 个测试文件通过。
- 79 个测试通过。

当前预览链接已验证返回 200：

```bash
curl -I http://127.0.0.1:3000/applications/5b6a1196-61c9-4433-ac34-bf1523b316cc/preview
```

注意：

- 上一次 `pnpm build` 在停掉 dev server 后通过。
- 如果 dev server 正在运行，再跑 `pnpm build` 可能因为 `.next` 被占用或热更新冲突失败。

## 4. 仍未完成的问题

### 4.1 页数估算仍不可靠

Review finding 1 仍成立。

当前 `lib/services/export/preview-renderer.ts` 的页数估算仍基于 section item 数量，而不是浏览器真实渲染高度。

风险：

- 预览提示可能显示「一页版，适合投递」。
- 实际 PDF 如果某条经历很长，浏览器仍可能分页。

建议下一步：

- 不要再用 item 数粗估。
- 用 Playwright 或 Chromium 对实际 HTML 进行渲染测量。
- 最少要在导出前计算每个 A4 页容器的真实高度，超过阈值时显示「可能超过一页」。
- 更理想是导出服务返回真实页数，并把真实页数写回预览状态。

### 4.2 简历内容还需要产品级裁剪

当前能同步原简历和接受建议，但内容仍偏满。

风险：

- 工作经历现在可能出现 3 段，项目 2 段，个人优势 2 段。
- 对 1 页 A4 来说，真实用户简历可能过长。

建议下一步：

- 建立「一页 A4 简历裁剪策略」。
- 根据目标 JD 给工作经历排序，最多保留 2 段。
- 项目经历最多保留 2 段。
- 每段最多 2-3 条 bullet。
- 个人优势最多 2 条，每条不超过 2 行。

### 4.3 JD 岗位名推断仍是规则版

当前规则能处理这份 Prompt/AI 对话 JD，但不是完整职位抽取器。

风险：

- 如果 JD 文本没有标题，只贴职责，系统只能用关键词推断。
- 当前会推断为「AI Prompt 产品专员」，但更精确的岗位名可能是「AI Prompt 运营」「AI 数据生成专员」等。

建议下一步：

- 新建 `target-title-extractor` 服务。
- 优先从用户表单显式岗位名读取。
- 如果岗位名是默认值或明显与 JD 不匹配，再从 JD 文本抽取。
- 抽取结果要显示给用户确认，而不是静默覆盖。

## 5. 建议 Antigravity 接手顺序

1. 先刷新当前预览链接，肉眼检查页面是否已出现「AI Prompt 产品专员」、中文个人优势、真实工作经历和真实项目标题。
2. 若页面仍旧，点击重新生成快照，或执行：

```bash
node --experimental-transform-types --import ./scripts/register-alias.mjs -e "import { generateSnapshotForDraft } from './lib/services/snapshot/snapshot-service.ts'; await generateSnapshotForDraft('5b6a1196-61c9-4433-ac34-bf1523b316cc');"
```

3. 下一步优先处理「真实页高测量」，解决一页提示不准的问题。
4. 再做「一页 A4 裁剪策略」，避免简历内容虽然同步了但过满。
5. 最后再微调工作、项目、教育模块的字体、时间对齐和视觉密度。

## 6. 关键文件

- `lib/services/snapshot/snapshot-composer.ts`：当前最关键，负责从 draft 组装新简历。
- `lib/services/export/preview-renderer.ts`：PDF HTML 渲染、页数估算，目前页数估算仍需重做。
- `lib/services/ingestion/extract-text.ts`：上传 PDF/Word/image/text 的文本提取。
- `components/preview/template-professional-cn.tsx`：前端预览模板。
- `components/preview/template-ats-clean.tsx`：ATS 预览模板。
- `components/preview/preview-workspace.tsx`：预览编辑器和导出入口。
- `tests/unit/snapshot/snapshot-composer.test.ts`：新增了 OCR PDF 简历、中文 section 建议同步、目标职位推断相关覆盖。

## 7. 给接手者的判断

当前主链路已经从「看起来像 demo」推进到「能看到真实简历信息并能生成一份新简历」。

但距离「可直接投递」还有两个关键缺口：

- 真实页数和一页 A4 裁剪。
- 简历内容压缩与 JD 相关性排序。

这两件事比继续调 UI 更重要。
