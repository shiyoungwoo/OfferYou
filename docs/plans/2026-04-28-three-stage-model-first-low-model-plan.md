# OfferYou 三段式模型主链路低模型执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 每完成一个批次必须运行该批验证命令；若任何验证失败，立即停止，不要继续后续批次。

**Goal:** 把 OfferYou 从「PDF 解析结果直接进入建议和 Snapshot」改成「解析层 -> 结构校准层 -> 终版生成层」的模型主导链路，并在界面上向用户说明不同模型能力差异。

**Architecture:** OpenDataLab PDF 仍作为解析入口，但解析结果只作为原始材料。新增「简历结构校准」服务，将解析文本恢复为可信结构化简历，并记录字段来源、置信度、待确认项。后续 JD 匹配、修改建议、Snapshot 和 PDF 导出优先消费校准后的结构化简历；多模态模型只作为可选增强，不作为硬依赖。

**Tech Stack:** Next.js App Router, TypeScript, React, Zod, Vitest, Testing Library, Playwright PDF export, OpenAI-Compatible/DeepSeek, Gemini optional provider, OpenDataLab PDF ingestion.

---

## 执行总原则

- 不要改动 PDF 导出版式模板，除非测试证明结构字段无法展示。
- 不要继续扩大正则规则；本轮重点是增加「结构校准台」和模型接口边界。
- 不要让 OCR / PDF 原文直接进入 Snapshot。必须先进入结构化校准结果。
- 所有模型输出必须有确定性兜底；没有模型 Key 时仍能进入「待确认结构」状态。
- 用户接受建议后，必须同步重建 Snapshot；不能只改变前端状态。
- 每个批次只修改允许文件范围。若必须额外改文件，先停止并汇报原因。
- 所有中文文案使用直角引号「」；避免「赋能、抓手、闭环、打通」等黑话。

## 当前问题定义

1. OpenDataLab PDF 能读出更多内容，但解析结果经常放不到正确模块。
2. DeepSeek 作为文本模型不能直接「看」JD 截图或 PDF 页面，因此需要解析文本质量闸门。
3. 当前 `snapshot-composer.ts` 过度承担结构识别职责，教育背景、项目边界、工作经历容易错位。
4. `suggestion-generator.ts` 生成的建议仍偏局部改句，缺少 Skill 式的「整体取舍和终版草稿」。
5. Web 端需要向用户解释：不同模型能力不同，视觉模型和文本模型的可用效果不同。

## 目标用户体验

用户上传原始 PDF 简历和 JD 后：

1. 系统先显示「解析完成，正在校准简历结构」。
2. 校准页展示姓名、联系方式、个人优势、工作经历、项目经历、教育背景、未归类内容。
3. 系统明确标记「确认」「低置信」「待补充」「疑似 OCR 错误」。
4. 用户可确认结构，或手动修正少量字段。
5. 只有确认后的结构进入 JD 匹配与简历改写。
6. 模型选择处显示：
   - 「文本模型」适合结构化文本改写，遇到图片 / 截图 / 复杂 PDF 需要先解析。
   - 「多模态模型」适合校准 JD 截图、PDF 页面截图和 OCR 错误。
   - 「确定性兜底」只能做基础规则整理，不能保证岗位定制质量。

## 新增核心数据模型

低模型实现时优先使用 TypeScript 类型和 Zod schema，不强制改数据库 schema；先存入现有 draft JSON。

```ts
export type ResumeCalibrationStatus = "pending" | "needs_review" | "confirmed";

export type ResumeFieldConfidence = "high" | "medium" | "low";

export type CalibratedResumeEntry = {
  id: string;
  section: "summary" | "work" | "project" | "education" | "other";
  title: string;
  organization?: string;
  role?: string;
  dateRange?: string;
  bullets: string[];
  sourceText: string;
  confidence: ResumeFieldConfidence;
  issues: string[];
};

export type CalibratedResumeProfile = {
  status: ResumeCalibrationStatus;
  personalInfo: {
    name?: string;
    phone?: string;
    email?: string;
    location?: string;
    portfolio?: string;
    github?: string;
    educationSummary?: string;
  };
  entries: CalibratedResumeEntry[];
  unclassifiedText: string[];
  parseWarnings: string[];
  modelNotes: string[];
  modelProvider: "gemini" | "openai_compatible" | "deterministic_fallback";
  updatedAt: string;
};
```

---

## 执行批次 34：建立结构校准类型与确定性兜底

**目标:** 新增简历结构校准的类型、schema 和确定性兜底服务。先不改 UI。

**允许修改文件:**

- Create: `lib/services/calibration/resume-calibration-types.ts`
- Create: `lib/services/calibration/resume-calibration-service.ts`
- Create: `tests/unit/calibration/resume-calibration-service.test.ts`

**禁止修改文件:**

- `lib/services/snapshot/snapshot-composer.ts`
- `components/**`
- `app/**`

- [ ] **Step 1: 写失败测试**

在 `tests/unit/calibration/resume-calibration-service.test.ts` 创建测试，覆盖：

```ts
import { describe, expect, it } from "vitest";
import { calibrateResumeStructureDeterministic } from "@/lib/services/calibration/resume-calibration-service";

describe("calibrateResumeStructureDeterministic", () => {
  it("keeps education in education section and suspicious OCR text in warnings", () => {
    const result = calibrateResumeStructureDeterministic({
      resumeText: [
        "示例候选人",
        "手机：13800000000 邮箱：candidate@example.com",
        "项目经历",
        "O\"erYou ) AI 岗位定制简历助手 2026.03 - 至今",
        "独立完成产品定义与 MVP 范围收敛。",
        "教育背景",
        "对外经济贸易大学 硕士 2017.09 - 2021.06"
      ].join("\\n")
    });

    expect(result.personalInfo.name).toBe("示例候选人");
    expect(result.personalInfo.phone).toBe("13800000000");
    expect(result.entries.some((entry) => entry.section === "education" && entry.title.includes("对外经济贸易大学"))).toBe(true);
    expect(result.parseWarnings.some((warning) => warning.includes("O\\\"erYou"))).toBe(true);
    expect(result.status).toBe("needs_review");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm exec vitest run tests/unit/calibration/resume-calibration-service.test.ts
```

Expected: FAIL，提示模块不存在。

- [ ] **Step 3: 新增类型文件**

在 `lib/services/calibration/resume-calibration-types.ts` 写入：

```ts
import { z } from "zod";
import type { ModelProviderKey } from "@/lib/ai/model-provider-config";

export const resumeEntrySectionSchema = z.enum(["summary", "work", "project", "education", "other"]);
export const resumeCalibrationStatusSchema = z.enum(["pending", "needs_review", "confirmed"]);
export const resumeFieldConfidenceSchema = z.enum(["high", "medium", "low"]);

export const calibratedResumeEntrySchema = z.object({
  id: z.string(),
  section: resumeEntrySectionSchema,
  title: z.string(),
  organization: z.string().optional(),
  role: z.string().optional(),
  dateRange: z.string().optional(),
  bullets: z.array(z.string()),
  sourceText: z.string(),
  confidence: resumeFieldConfidenceSchema,
  issues: z.array(z.string())
});

export const calibratedResumeProfileSchema = z.object({
  status: resumeCalibrationStatusSchema,
  personalInfo: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    location: z.string().optional(),
    portfolio: z.string().optional(),
    github: z.string().optional(),
    educationSummary: z.string().optional()
  }),
  entries: z.array(calibratedResumeEntrySchema),
  unclassifiedText: z.array(z.string()),
  parseWarnings: z.array(z.string()),
  modelNotes: z.array(z.string()),
  modelProvider: z.custom<ModelProviderKey>(),
  updatedAt: z.string()
});

export type ResumeEntrySection = z.infer<typeof resumeEntrySectionSchema>;
export type ResumeCalibrationStatus = z.infer<typeof resumeCalibrationStatusSchema>;
export type ResumeFieldConfidence = z.infer<typeof resumeFieldConfidenceSchema>;
export type CalibratedResumeEntry = z.infer<typeof calibratedResumeEntrySchema>;
export type CalibratedResumeProfile = z.infer<typeof calibratedResumeProfileSchema>;
```

- [ ] **Step 4: 新增确定性校准服务**

在 `lib/services/calibration/resume-calibration-service.ts` 实现：

```ts
import { randomUUID } from "crypto";
import type { CalibratedResumeEntry, CalibratedResumeProfile, ResumeEntrySection } from "@/lib/services/calibration/resume-calibration-types";

type CalibrationInput = {
  resumeText: string;
};

export function calibrateResumeStructureDeterministic(input: CalibrationInput): CalibratedResumeProfile {
  const lines = input.resumeText
    .split(/\\r?\\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const personalInfo = extractPersonalInfo(lines);
  const parseWarnings = collectParseWarnings(lines);
  const entries: CalibratedResumeEntry[] = [];
  const unclassifiedText: string[] = [];
  let currentSection: ResumeEntrySection = "other";
  let currentEntry: CalibratedResumeEntry | null = null;

  for (const line of lines) {
    const heading = detectSectionHeading(line);
    if (heading) {
      if (currentEntry) entries.push(currentEntry);
      currentEntry = null;
      currentSection = heading;
      continue;
    }

    if (isPersonalInfoLine(line, personalInfo)) continue;

    if (looksLikeEntryTitle(line)) {
      if (currentEntry) entries.push(currentEntry);
      currentEntry = {
        id: randomUUID(),
        section: currentSection,
        title: stripDateRange(line).trim() || line,
        dateRange: extractDateRange(line),
        bullets: [],
        sourceText: line,
        confidence: currentSection === "other" ? "low" : "medium",
        issues: currentSection === "other" ? ["无法确定该经历所属模块，请人工确认。"] : []
      };
      continue;
    }

    if (currentEntry) {
      currentEntry.bullets.push(line);
      currentEntry.sourceText = `${currentEntry.sourceText}\\n${line}`;
    } else {
      unclassifiedText.push(line);
    }
  }

  if (currentEntry) entries.push(currentEntry);

  const hasLowConfidence = entries.some((entry) => entry.confidence === "low" || entry.issues.length > 0);
  const missingRequired = !personalInfo.name || !personalInfo.phone || !personalInfo.email || !entries.some((entry) => entry.section === "education");

  return {
    status: hasLowConfidence || missingRequired || parseWarnings.length > 0 ? "needs_review" : "confirmed",
    personalInfo,
    entries,
    unclassifiedText,
    parseWarnings,
    modelNotes: ["当前结果来自确定性结构恢复，适合兜底，不等同于多模态校准。"],
    modelProvider: "deterministic_fallback",
    updatedAt: new Date().toISOString()
  };
}

function extractPersonalInfo(lines: string[]) {
  const text = lines.slice(0, 8).join(" ");
  return {
    name: lines.find((line) => /^[\\u4e00-\\u9fa5·]{2,8}$/.test(line)),
    phone: text.match(/1[3-9]\\d{9}/)?.[0],
    email: text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i)?.[0],
    location: text.match(/(?:所在地|居住地|城市)[:：]?\\s*([^|｜\\s]+)/u)?.[1],
    github: text.match(/github[:：]?\\s*([^|｜\\s]+)/i)?.[1],
    portfolio: text.match(/(?:作品集|portfolio)[:：]?\\s*([^|｜\\s]+)/i)?.[1]
  };
}

function detectSectionHeading(line: string): ResumeEntrySection | null {
  const compact = line.replace(/\\s+/g, "");
  if (/^(个人优势|自我评价|个人总结|核心优势)$/u.test(compact)) return "summary";
  if (/^(工作经历|工作经验|职业经历|任职经历|实习经历)$/u.test(compact)) return "work";
  if (/^(项目经历|项目经验|个人项目|代表项目)$/u.test(compact)) return "project";
  if (/^(教育背景|教育经历|学历背景|学习经历)$/u.test(compact)) return "education";
  return null;
}

function looksLikeEntryTitle(line: string) {
  return Boolean(extractDateRange(line)) || /(大学|学院|公司|项目|产品|经理|负责人|实习|本科|硕士|博士)/u.test(line);
}

function extractDateRange(line: string) {
  return line.match(/(?:\\d{4}[./]\\d{2}|\\d{4})\\s*[-—–至]\\s*(?:至今|Present|\\d{4}[./]\\d{2}|\\d{4})/i)?.[0];
}

function stripDateRange(line: string) {
  const dateRange = extractDateRange(line);
  return dateRange ? line.replace(dateRange, "") : line;
}

function collectParseWarnings(lines: string[]) {
  return lines
    .filter((line) => /O["“”']?erYou|\\$|�|\\uFFFD/.test(line))
    .map((line) => `疑似 OCR 识别异常：${line}`);
}

function isPersonalInfoLine(line: string, info: ReturnType<typeof extractPersonalInfo>) {
  return [info.name, info.phone, info.email, info.location, info.github, info.portfolio].filter(Boolean).some((item) => line.includes(item as string));
}
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```bash
pnpm exec vitest run tests/unit/calibration/resume-calibration-service.test.ts
pnpm exec tsc --noEmit
```

Expected: PASS。

---

## 执行批次 35：增加模型校准接口，保留多模态扩展位

**目标:** 新增模型校准入口。DeepSeek / OpenAI-Compatible 做文本结构恢复；Gemini 作为可选 provider；没有 Key 时降级到批次 34 的确定性结果。

**允许修改文件:**

- Modify: `lib/services/calibration/resume-calibration-service.ts`
- Modify: `lib/ai/model-task-config.ts`
- Modify: `lib/ai/model-provider-config.ts`
- Test: `tests/unit/calibration/resume-calibration-service.test.ts`

**禁止修改文件:**

- `components/**`
- `lib/services/snapshot/snapshot-composer.ts`

- [ ] **Step 1: 增加模型任务类型**

在 `lib/ai/model-task-config.ts` 中增加任务键：

```ts
export type ModelTaskKey =
  | "gap_analysis"
  | "suggestion_generation"
  | "resume_calibration";
```

若该文件已有不同定义，只追加 `resume_calibration`，不要重写其他逻辑。

- [ ] **Step 2: 在校准服务中新增导出函数**

在 `resume-calibration-service.ts` 新增：

```ts
import { callModelJSON } from "@/lib/ai/model-gateway";
import { calibratedResumeProfileSchema, type CalibratedResumeProfile } from "@/lib/services/calibration/resume-calibration-types";

export async function calibrateResumeStructure(input: CalibrationInput): Promise<CalibratedResumeProfile> {
  const fallback = calibrateResumeStructureDeterministic(input);

  const result = await callModelJSON<unknown>({
    task: "resume_calibration",
    systemPrompt: buildCalibrationSystemPrompt(),
    userPrompt: buildCalibrationUserPrompt(input.resumeText)
  });

  if (result.provider === "deterministic_fallback") {
    return {
      ...fallback,
      modelNotes: [...fallback.modelNotes, result.fallbackReason ?? "模型不可用，已使用确定性结构恢复。"]
    };
  }

  const parsed = calibratedResumeProfileSchema.safeParse(result.data);
  if (!parsed.success) {
    return {
      ...fallback,
      modelNotes: [...fallback.modelNotes, "模型返回结构无法通过校验，已使用确定性结构恢复。"]
    };
  }

  return {
    ...parsed.data,
    modelProvider: result.provider,
    updatedAt: new Date().toISOString()
  };
}

function buildCalibrationSystemPrompt() {
  return [
    "你是简历结构校准器，只负责从解析文本中恢复事实结构，不负责美化简历。",
    "必须保留事实，不得编造公司、学校、时间、职位、结果。",
    "如果字段不确定，confidence 写 low，并在 issues 中说明。",
    "如果发现 OCR 错误，例如 O\\\"erYou，应记录 parseWarnings，并在 title 中给出最可能的修正。",
    "输出必须是符合 CalibratedResumeProfile 的 JSON，不要输出 Markdown。"
  ].join("\\n");
}

function buildCalibrationUserPrompt(resumeText: string) {
  return `请校准以下简历解析文本，恢复为结构化简历。\\n\\n${resumeText}`;
}
```

- [ ] **Step 3: 补测试**

在测试中 mock `callModelJSON`：

```ts
vi.mock("@/lib/ai/model-gateway", () => ({
  callModelJSON: vi.fn()
}));
```

增加两个用例：

1. 模型不可用时返回确定性兜底，并写入 `modelNotes`。
2. 模型返回非法 JSON 结构时返回确定性兜底，并写入 `modelNotes`。

- [ ] **Step 4: 验证**

Run:

```bash
pnpm exec vitest run tests/unit/calibration/resume-calibration-service.test.ts
pnpm exec tsc --noEmit
```

Expected: PASS。

---

## 执行批次 36：把校准结果写入 Draft，并阻断未校准 Snapshot

**目标:** Draft 创建 / 读取时保存 `calibratedResume`。Snapshot 生成优先使用校准结果；如果状态为 `needs_review`，仍可生成，但必须带风险提示。

**允许修改文件:**

- Modify: `lib/services/analysis/workspace-repository.ts`
- Modify: `lib/services/analysis/workspace-data.ts`
- Modify: `lib/services/snapshot/snapshot-composer.ts`
- Create or Modify: `tests/unit/snapshot/snapshot-composer.test.ts`
- Create: `tests/integration/calibration/calibrated-draft-chain.test.ts`

**禁止修改文件:**

- `components/**`
- `app/**`

- [ ] **Step 1: 扩展持久化类型**

在 `workspace-repository.ts` 的 draft 类型中增加可选字段：

```ts
calibratedResume?: CalibratedResumeProfile;
```

注意：如果类型在其他文件定义，按实际位置修改，不要重复定义。

- [ ] **Step 2: Draft 读取映射加入校准结果**

在 `workspace-data.ts` 中读取 persisted draft 时，将 `calibratedResume` 暴露给工作台数据。

验收：没有校准结果时不报错。

- [ ] **Step 3: Snapshot 优先消费校准结果**

在 `snapshot-composer.ts` 中新增入口函数或内部适配：

```ts
function buildSectionsFromCalibratedResume(calibratedResume: CalibratedResumeProfile | undefined) {
  if (!calibratedResume) return null;
  return {
    summary: calibratedResume.entries.filter((entry) => entry.section === "summary"),
    work: calibratedResume.entries.filter((entry) => entry.section === "work"),
    projects: calibratedResume.entries.filter((entry) => entry.section === "project"),
    education: calibratedResume.entries.filter((entry) => entry.section === "education")
  };
}
```

然后在现有 `extractResumeSections(resumeText)` 之前判断：如果存在 `calibratedResume`，优先使用校准结构生成 `ResumeDocument`。

- [ ] **Step 4: 风险提示写入 Snapshot**

若 `calibratedResume.status === "needs_review"`，在 Snapshot 的内部风险提示或备注字段中写入：

```text
当前简历结构仍有低置信字段，建议确认后再投递。
```

如果 `ResumeDocument` 没有合适字段，不要硬改导出模板；先写入现有可承载风险提示的结构，或在测试中只验证 composer 返回的 warning 字段。

- [ ] **Step 5: 测试校准结果优先级**

新增测试：输入原始文本里教育背景被错误放在项目后，但 `calibratedResume.entries` 明确标为 `education`，最终 Snapshot 必须把学校放入教育背景模块。

Run:

```bash
pnpm exec vitest run tests/unit/snapshot/snapshot-composer.test.ts tests/integration/calibration/calibrated-draft-chain.test.ts
pnpm exec tsc --noEmit
```

Expected: PASS。

---

## 执行批次 37：新增结构校准台 UI

**目标:** 在工作台中展示校准结果，让用户知道哪些字段已确认、哪些字段需要人工确认。先只读展示，不做复杂编辑。

**允许修改文件:**

- Create: `components/applications/resume-calibration-panel.tsx`
- Modify: `app/applications/[draftId]/page.tsx`
- Modify: `lib/services/analysis/workspace-data.ts`
- Create: `tests/unit/applications/resume-calibration-panel.test.tsx`

**禁止修改文件:**

- `lib/services/snapshot/snapshot-composer.ts`
- `lib/services/export/**`

- [ ] **Step 1: 写组件测试**

测试内容：

1. 显示「简历结构校准」标题。
2. 显示 `needs_review` 状态为「需要确认」。
3. 显示低置信字段和 OCR 风险提示。
4. 没有 `calibratedResume` 时显示「尚未完成结构校准」。

- [ ] **Step 2: 创建组件**

组件文案要求：

```tsx
export function ResumeCalibrationPanel({ calibratedResume }: { calibratedResume?: CalibratedResumeProfile }) {
  if (!calibratedResume) {
    return <section>尚未完成结构校准。上传简历后，系统会先恢复简历结构，再进入岗位定制。</section>;
  }

  return (
    <section>
      <h2>简历结构校准</h2>
      <p>{calibratedResume.status === "confirmed" ? "结构已确认" : "需要确认"}</p>
      {/* 展示 personalInfo、entries、unclassifiedText、parseWarnings */}
    </section>
  );
}
```

样式跟随现有 OfferYou 工作台卡片，不引入新设计系统。

- [ ] **Step 3: 接入工作台页面**

在 `app/applications/[draftId]/page.tsx` 中把 `ResumeCalibrationPanel` 放在建议列表之前。

验收：用户能先看到结构质量，再看修改建议。

- [ ] **Step 4: 验证**

Run:

```bash
pnpm exec vitest run tests/unit/applications/resume-calibration-panel.test.tsx
pnpm exec tsc --noEmit
```

Expected: PASS。

---

## 执行批次 38：新增模型能力说明与选择提示

**目标:** 在「我的资料」或模型设置区域说明不同模型效果：文本模型、多模态模型、确定性兜底。先展示说明，不强制做完整设置页重构。

**允许修改文件:**

- Modify: `components/me/model-provider-status-card.tsx`
- Modify: `lib/ai/model-provider-config.ts`
- Modify: `tests/unit/me/model-provider-status-card.test.tsx`

**禁止修改文件:**

- `lib/services/analysis/**`
- `lib/services/snapshot/**`

- [ ] **Step 1: 增加 provider 能力元数据**

在 `model-provider-config.ts` 增加：

```ts
export type ModelCapabilityLevel = "text_only" | "vision_optional" | "fallback_only";

export function getModelProviderCapability(provider: ModelProviderKey): {
  level: ModelCapabilityLevel;
  title: string;
  description: string;
  bestFor: string[];
  limitations: string[];
} {
  if (provider === "openai_compatible") {
    return {
      level: "text_only",
      title: "文本模型",
      description: "适合 JD 文本匹配、中文改写和结构化输出。复杂 PDF 或截图需要先经过解析和校准。",
      bestFor: ["岗位匹配", "简历改写", "面试准备"],
      limitations: ["不能直接看 JD 截图", "不能直接校准 PDF 页面视觉结构"]
    };
  }

  if (provider === "gemini") {
    return {
      level: "vision_optional",
      title: "多模态模型",
      description: "适合校准 JD 截图、PDF 页面截图和 OCR 错误。若当前调用未传图片，则仍按文本模式工作。",
      bestFor: ["截图理解", "OCR 校准", "复杂版面恢复"],
      limitations: ["需要配置可用 Key", "成本和速度取决于模型"]
    };
  }

  return {
    level: "fallback_only",
    title: "确定性兜底",
    description: "只做基础规则整理，适合无 Key 时保底查看，不建议作为最终投递质量来源。",
    bestFor: ["离线兜底", "基础字段提取"],
    limitations: ["不能理解 JD 深层要求", "不能保证简历定制质量"]
  };
}
```

- [ ] **Step 2: UI 展示能力说明**

在 `model-provider-status-card.tsx` 中增加一块说明：

```text
模型能力会影响结果：文本模型适合改写，多模态模型适合看截图和校准 PDF，确定性兜底只适合基础整理。
```

并按当前 provider 展示 `bestFor` 和 `limitations`。

- [ ] **Step 3: 测试**

测试必须断言：

1. DeepSeek / OpenAI-Compatible 显示「文本模型」。
2. Gemini 显示「多模态模型」。
3. fallback 显示「确定性兜底」。

Run:

```bash
pnpm exec vitest run tests/unit/me/model-provider-status-card.test.tsx
pnpm exec tsc --noEmit
```

Expected: PASS。

---

## 执行批次 39：把建议生成改成基于校准结构

**目标:** `suggestion-generator.ts` 不再只从原始文本切片，而是优先从 `calibratedResume.entries` 生成建议上下文，避免「第一个项目内容改到第二个项目」。

**允许修改文件:**

- Modify: `lib/services/analysis/suggestion-generator.ts`
- Modify: `lib/services/analysis/gap-analysis-service.ts`
- Create or Modify: `tests/unit/services/suggestion-generator.test.ts`
- Modify: `tests/unit/analysis/gap-analysis-service.test.ts`

**禁止修改文件:**

- `components/**`
- `lib/services/snapshot/**`

- [ ] **Step 1: 扩展输入类型**

在 `SuggestionSeedInput` 或等价输入类型中增加：

```ts
calibratedResume?: CalibratedResumeProfile;
```

- [ ] **Step 2: 新增经历候选构建函数**

在 `suggestion-generator.ts` 新增：

```ts
function buildSuggestionCandidates(input: SuggestionSeedInput) {
  if (input.calibratedResume?.entries.length) {
    return input.calibratedResume.entries.map((entry) => ({
      id: entry.id,
      section: entry.section,
      title: entry.title,
      sourceText: entry.sourceText,
      confidence: entry.confidence,
      issues: entry.issues
    }));
  }

  return buildLegacyTextCandidates(input);
}
```

若没有 `buildLegacyTextCandidates`，将现有原始文本候选逻辑包成该函数。

- [ ] **Step 3: 调整 AI Prompt**

AI 生成建议时必须加入：

```text
每条建议只能改写一个 candidate。不得把 candidate A 的项目内容写入 candidate B。
如果 candidate.confidence 为 low，只能提出校准建议，不要直接生成投递版表述。
输出 suggestions 数组时必须带 candidateId。
```

返回结构增加 `candidateId?: string`，不破坏旧数据。

- [ ] **Step 4: 测试错位防护**

测试场景：

1. 两个项目 A、B。
2. A 命中 JD，B 弱相关。
3. 生成建议时 A 的 `afterText` 不得包含 B 的标题，B 的 `afterText` 不得包含 A 的核心内容。

Run:

```bash
pnpm exec vitest run tests/unit/services/suggestion-generator.test.ts tests/unit/analysis/gap-analysis-service.test.ts
pnpm exec tsc --noEmit
```

Expected: PASS。

---

## 执行批次 40：新增「终版草稿」生成，不再只拼接建议

**目标:** 增加 Skill 式终版生成服务：基于校准简历、JD、已接受建议，一次性生成完整 `ResumeDocument`，减少 Snapshot 拼装错位。

**允许修改文件:**

- Create: `lib/services/snapshot/final-resume-draft-service.ts`
- Modify: `lib/services/snapshot/snapshot-service.ts`
- Modify: `lib/services/snapshot/snapshot-composer.ts`
- Create: `tests/unit/snapshot/final-resume-draft-service.test.ts`

**禁止修改文件:**

- `components/**`
- `lib/services/export/**`

- [ ] **Step 1: 新增终版草稿服务测试**

测试：

1. 输入校准后的教育背景，输出必须保留教育背景。
2. 输入弱相关项目，输出可以压缩，但不能完全改变事实。
3. 输出模块顺序必须是个人信息、个人优势、工作经历、项目经历、教育背景。

- [ ] **Step 2: 实现服务**

服务接口：

```ts
export async function generateFinalResumeDraft(input: {
  calibratedResume: CalibratedResumeProfile;
  jdText: string;
  acceptedSuggestions: SnapshotSuggestion[];
}): Promise<ResumeDocument> {
  // 先用确定性方式组装 ResumeDocument。
  // 后续可以在这里接模型生成完整终版，但本批次不强制依赖模型。
}
```

低模型注意：本批次先做确定性实现，不要接复杂模型调用。目标是建立稳定入口。

- [ ] **Step 3: 接入 Snapshot Service**

在 `snapshot-service.ts` 中：

1. 如果 draft 有 `calibratedResume`，调用 `generateFinalResumeDraft`。
2. 如果没有，继续走旧 `composeSnapshotDocument`。
3. 生成结果继续走现有保存和页数测量。

- [ ] **Step 4: 验证**

Run:

```bash
pnpm exec vitest run tests/unit/snapshot/final-resume-draft-service.test.ts tests/unit/snapshot/snapshot-composer.test.ts
pnpm exec tsc --noEmit
```

Expected: PASS。

---

## 执行批次 41：端到端链路测试

**目标:** 固定完整链路：上传解析文本 -> 校准结构 -> JD 建议 -> 接受建议 -> 生成终版 Snapshot -> PDF 导出仍使用现有模板。

**允许修改文件:**

- Create: `tests/integration/job-apply/three-stage-resume-chain.test.ts`
- Modify: `scripts/check-vnext-mvp.mjs`
- Modify: `docs/quality/offeryou-beta-report.md`

**禁止修改文件:**

- `components/**`
- `lib/**`

- [ ] **Step 1: 新增集成测试**

测试必须覆盖：

1. PDF 解析文本中出现 `O"erYou`，校准结果写入 `parseWarnings`。
2. 教育背景进入 `education`，不进入项目经历。
3. JD 相关项目优先生成建议。
4. 接受建议后 Snapshot 包含该项目改写内容。
5. Snapshot 不回写 Master。

- [ ] **Step 2: 更新 check 脚本**

在 `scripts/check-vnext-mvp.mjs` 增加文件存在检查：

- `lib/services/calibration/resume-calibration-service.ts`
- `lib/services/calibration/resume-calibration-types.ts`
- `lib/services/snapshot/final-resume-draft-service.ts`
- `components/applications/resume-calibration-panel.tsx`

- [ ] **Step 3: 更新质量报告**

在 `docs/quality/offeryou-beta-report.md` 增加：

```md
## 三段式链路验收

- 解析层：OpenDataLab PDF 输出只作为原始材料。
- 校准层：结构化简历作为建议和 Snapshot 的主输入。
- 生成层：终版简历优先消费校准结构。
- 模型说明：界面解释文本模型、多模态模型和确定性兜底差异。
```

- [ ] **Step 4: 验证**

Run:

```bash
pnpm exec vitest run tests/integration/job-apply/three-stage-resume-chain.test.ts
pnpm run check:vnext
pnpm exec tsc --noEmit
```

Expected: PASS。

---

## 执行批次 42：人工体验验收脚本

**目标:** 给真实体验留一条手动验收路径，避免只靠单测假装完成。

**允许修改文件:**

- Create: `docs/quality/three-stage-manual-acceptance.md`
- Modify: `README.md`

**禁止修改文件:**

- `lib/**`
- `components/**`
- `app/**`

- [ ] **Step 1: 新增人工验收文档**

文档内容必须包含：

```md
# OfferYou 三段式链路人工验收

## 准备材料
- 一份真实 PDF 简历。
- 一份 JD 文本。
- 可选：JD 截图。

## 验收步骤
1. 上传 PDF 简历。
2. 查看「简历结构校准」是否识别姓名、电话、邮箱、教育背景。
3. 检查是否出现 OCR 风险提示。
4. 输入 JD。
5. 查看建议是否围绕 JD，而不是泛泛改句。
6. 接受一条建议。
7. 生成预览。
8. 确认教育背景、联系方式、工作经历、项目经历位置正确。
9. 导出 PDF。

## 通过标准
- 无乱码进入最终 PDF。
- 教育背景不进入项目经历。
- 弱相关经历被压缩，而不是被硬改成强相关。
- 接受建议后预览同步更新。
- PDF 与预览主要内容一致。
```

- [ ] **Step 2: README 增加模型能力说明入口**

增加一小节：

```md
## 模型能力说明

OfferYou 支持文本模型、多模态模型和确定性兜底。文本模型适合 JD 匹配和中文改写；多模态模型适合处理 JD 截图、PDF 页面截图和 OCR 校准；确定性兜底只用于无 Key 时基础整理。
```

- [ ] **Step 3: 验证**

Run:

```bash
pnpm run check:vnext
pnpm exec tsc --noEmit
```

Expected: PASS。

---

## 最终验收命令

全部批次完成后运行：

```bash
pnpm run check:vnext
pnpm exec tsc --noEmit
pnpm exec vitest run \
  tests/unit/calibration/resume-calibration-service.test.ts \
  tests/unit/applications/resume-calibration-panel.test.tsx \
  tests/unit/services/suggestion-generator.test.ts \
  tests/unit/analysis/gap-analysis-service.test.ts \
  tests/unit/snapshot/final-resume-draft-service.test.ts \
  tests/unit/snapshot/snapshot-composer.test.ts \
  tests/integration/calibration/calibrated-draft-chain.test.ts \
  tests/integration/job-apply/three-stage-resume-chain.test.ts
```

若当前沙盒无法启动 Chromium，不要运行 PDF 浏览器测试；只记录：

```text
PDF 浏览器测试需要在非沙盒环境执行，当前批次只验证 PDF 输入模型与 Snapshot 输出模型。
```

## 阻塞汇报格式

如果任一批次失败，按以下格式汇报：

```md
## 阻塞

批次：执行批次 XX
命令：`实际运行命令`
失败现象：粘贴关键错误，不超过 20 行
已确认：列出已经检查过的文件或假设
建议下一步：给出一个最小修复动作
```

## 完成后应达到的状态

- PDF / OCR 原文不会直接进入最终简历。
- OfferYou 有明确的「简历结构校准」中间层。
- 教育背景、工作经历、项目经历优先来自校准结构。
- 修改建议绑定到具体 candidate，降低项目串段风险。
- 模型能力差异对用户可见。
- DeepSeek 可继续作为文本改写模型；Gemini / OpenAI Vision 等多模态能力作为可选增强。
- 没有多模态模型时，系统会提示「需要确认」，而不是假装解析完全可靠。
