"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
  X
} from "lucide-react";
import type { ApplicationDraftDefaults } from "@/lib/services/talent/application-draft-defaults";
import { buildDraftInputPreview } from "@/lib/services/applications/draft-input-preview";

type NewApplicationFormProps = {
  selectedLane?: string;
  draftDefaults: ApplicationDraftDefaults;
};

type InputMode = "text" | "file";

export function NewApplicationForm({ selectedLane, draftDefaults }: NewApplicationFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [company, setCompany] = useState(draftDefaults.company);
  const [jobTitle, setJobTitle] = useState(draftDefaults.jobTitle);
  const [jdContent, setJdContent] = useState(draftDefaults.jdContent);
  const [resumeAssetRef, setResumeAssetRef] = useState(draftDefaults.resumeAssetRef);
  const [resumeContent, setResumeContent] = useState("");
  const [jdUploadName, setJdUploadName] = useState<string | null>(null);
  const [resumeUploadName, setResumeUploadName] = useState<string | null>(null);
  const [jdUploadState, setJdUploadState] = useState<string | null>(null);
  const [resumeUploadState, setResumeUploadState] = useState<string | null>(null);
  const [resumeMode, setResumeMode] = useState<InputMode>("text");
  const [jdMode, setJdMode] = useState<InputMode>("text");

  const preview = useMemo(
    () =>
      buildDraftInputPreview({
        jdContent,
        resumeContent,
        hasResumeFile: Boolean(resumeUploadName)
      }),
    [jdContent, resumeContent, resumeUploadName]
  );

  async function handleJdFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      clearJdUpload();
      return;
    }

    setJdUploadName(file.name);
    setJdUploadState("正在上传并提取 JD 内容...");

    const uploaded = await uploadSourceFile({
      file,
      kind: "jd_source"
    });

    if (!uploaded) {
      setJdUploadState("JD 上传失败，请重试。");
      return;
    }

    setJdContent(
      uploaded.extractedText ||
        `已上传 JD 文件：${file.name}。当前无法完整提取正文，请手动补充关键要求后再继续。`
    );

    if (uploaded.company && (!company || company === "OfferYou 示例岗位")) {
      setCompany(uploaded.company);
    }
    if (uploaded.jobTitle && (!jobTitle || jobTitle === "客户成功经理")) {
      setJobTitle(uploaded.jobTitle);
    }

    const hasExtractedInfo = !!(uploaded.company || uploaded.jobTitle);
    const suffix = hasExtractedInfo ? "已自动识别并填充岗位信息，请核对后继续。" : "请在上方手动填写公司和岗位名称后再继续。";

    setJdUploadState(
      uploaded.extractionState === "stored_only"
        ? "JD 文件已保存，但正文提取不完整，建议手动补充关键要求。"
        : uploaded.extractionState === "partial_text"
          ? `JD 文件已提取出部分内容，${suffix}`
          : `JD 文件已提取完成，${suffix}`
    );
  }

  async function handleResumeFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      clearResumeUpload();
      return;
    }

    setResumeUploadName(file.name);
    setResumeUploadState("正在上传并提取简历内容...");

    const uploaded = await uploadSourceFile({
      file,
      kind: "resume_source"
    });

    if (!uploaded) {
      setResumeUploadState("简历上传失败，请重试。");
      return;
    }

    setResumeAssetRef(uploaded.assetRef);
    if (uploaded.extractedText) {
      setResumeContent(uploaded.extractedText);
    }
    setResumeUploadState(
      uploaded.extractionState === "stored_only"
        ? "简历文件已保存，但正文提取不完整，建议补充关键经历。"
        : uploaded.extractionState === "partial_text"
          ? "简历已提取出部分内容，请先核对再进入分析。"
          : "简历已提取完成，可以继续编辑文本。"
    );
  }

  function clearResumeUpload() {
    setResumeUploadName(null);
    setResumeUploadState(null);
    setResumeAssetRef("");
  }

  function clearJdUpload() {
    setJdUploadName(null);
    setJdUploadState(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      company: company.trim(),
      jobTitle: jobTitle.trim(),
      language: "zh" as const,
      masterResumeId: "default-master",
      careerDirectionSlug: selectedLane || undefined,
      jdContent: jdContent.trim(),
      resumeAssetRef: resumeAssetRef.trim() || undefined,
      resumeContent: resumeContent.trim() || undefined
    };

    startTransition(async () => {
      setError(null);

      const response = await fetch("/api/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = (await response.json()) as {
        id?: string;
        error?: unknown;
      };

      if (!response.ok || !result.id) {
        console.error("Submission failed:", result.error);
        if (result.error && typeof result.error === "object" && "fieldErrors" in result.error) {
          const errs = result.error as { fieldErrors: Record<string, string[]> };
          const msg = Object.entries(errs.fieldErrors)
            .map(([k, v]) => `${k}: ${v.join(", ")}`)
            .join("; ");
          setError(`验证失败: ${msg}`);
          return;
        }
        setError("生成分析工作台失败，请先确认岗位信息、JD 与简历正文都已补充完整。");
        return;
      }

      router.push(`/applications/${result.id}`);
    });
  }

  return (
    <form className="flex flex-col gap-8 xl:flex-row" onSubmit={handleSubmit}>
      <div className="flex min-w-0 flex-1 flex-col gap-6 xl:max-w-3xl">
        <section className="rounded-[1.8rem] border border-black/5 bg-white/90 p-6 shadow-card">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-accent">岗位信息</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">先把目标岗位说清楚，再判断是否值得投。</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                岗位标题、公司和 JD 越完整，后面的差距分析与改写建议就越可靠。
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-black/5 bg-paper px-4 py-3 text-sm leading-6 text-slate-700">
              当前策略：先出建议清单，再进入正式分析工作台。
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="目标岗位">
              <input
                className={fieldClassName}
                onChange={(event) => setJobTitle(event.target.value)}
                placeholder="例如：AI 产品经理"
                value={jobTitle}
                required
                minLength={2}
              />
            </Field>
            <Field label="目标公司">
              <input
                className={fieldClassName}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="例如：某某科技"
                value={company}
                required
                minLength={2}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-[1.8rem] border border-black/5 bg-white/90 p-6 shadow-card">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-accent">简历来源</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">输入当前简历，系统只会在快照层做岗位表达。</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                支持直接粘贴，也支持上传 PDF、Word、TXT 与图片。图片和复杂 PDF 可能只能抽取部分文本，建议检查后再继续。
              </p>
            </div>
            <ModeSwitcher
              activeMode={resumeMode}
              fileLabel="上传文件"
              onChange={setResumeMode}
              textLabel="直接粘贴"
            />
          </div>

          {resumeMode === "text" ? (
            <div className="mt-6">
              <textarea
                className={`${fieldClassName} min-h-60 resize-y`}
                onChange={(event) => setResumeContent(event.target.value)}
                placeholder="粘贴当前简历正文，建议保留尽可能完整的事实材料。"
                value={resumeContent}
              />
            </div>
          ) : (
            <div className="mt-6">
              <UploadCard
                accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.doc,.docx"
                helper="支持 PDF、Word、TXT、图片。"
                icon={<FileText className="text-blue-600" size={24} />}
                onChange={handleResumeFileChange}
                title="上传现有简历"
                uploadName={resumeUploadName}
                uploadState={resumeUploadState}
                onClear={clearResumeUpload}
              />
            </div>
          )}

          {resumeUploadState && resumeMode === "text" ? (
            <p className="mt-4 text-sm leading-6 text-slate-600">{resumeUploadState}</p>
          ) : null}
        </section>

        <section className="rounded-[1.8rem] border border-black/5 bg-white/90 p-6 shadow-card">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-accent">岗位 JD</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">把招聘方真正看重的要求贴进来。</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                差距分析会优先比对 JD 对成果、职责、协作方式和关键词的要求，不做黑盒改写。
              </p>
            </div>
            <ModeSwitcher
              activeMode={jdMode}
              fileLabel="上传文件"
              onChange={setJdMode}
              textLabel="直接粘贴"
            />
          </div>

          {jdMode === "text" ? (
            <div className="mt-6">
              <textarea
                className={`${fieldClassName} min-h-52 resize-y`}
                onChange={(event) => setJdContent(event.target.value)}
                placeholder="粘贴岗位描述、职责、要求与关键词。"
                value={jdContent}
              />
            </div>
          ) : (
            <div className="mt-6">
              <UploadCard
                accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.doc,.docx"
                helper="支持 PDF、图片、Word、TXT。"
                icon={<ImageIcon className="text-indigo-600" size={24} />}
                onChange={handleJdFileChange}
                title="上传 JD 文件或截图"
                uploadName={jdUploadName}
                uploadState={jdUploadState}
                onClear={clearJdUpload}
              />
            </div>
          )}
        </section>

        <section className="rounded-[1.8rem] border border-black/5 bg-[#fff9ec] p-6 shadow-card">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 text-amber-600" size={22} />
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-amber-700">绝对防失真</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">表达可以重写，事实不能乱写。</h2>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                <li className="rounded-[1rem] bg-white/80 px-4 py-3">岗位建议会逐条展示，采纳之前不会直接覆盖原始简历。</li>
                <li className="rounded-[1rem] bg-white/80 px-4 py-3">如果发现了新事实，会先进待确认队列，再决定是否进入主档。</li>
                <li className="rounded-[1rem] bg-white/80 px-4 py-3">最终导出的是岗位快照，不会污染长期资料。</li>
              </ul>
            </div>
          </div>
        </section>

        <button
          className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white transition ${
            isPending ? "bg-slate-400" : "bg-ink hover:bg-slate-900"
          }`}
          disabled={isPending}
          type="submit"
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              正在生成分析工作台...
            </>
          ) : (
            <>进入差距分析与建议清单</>
          )}
        </button>

        {error ? (
          <div className="rounded-[1.2rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </div>

      <aside className="h-fit flex-1 xl:sticky xl:top-6">
        <div className="rounded-[1.8rem] border border-black/5 bg-white/90 shadow-card">
          <div className="border-b border-black/5 bg-paper/80 px-6 py-5">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
              <Sparkles className="text-amber-500" size={18} />
              即时预判
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              这里只做输入前的轻量预估。正式工作台会给出完整差距分析、建议清单和可生成的岗位快照。
            </p>
          </div>

          <div className="grid gap-6 px-6 py-6">
            <div className="rounded-[1.5rem] border border-indigo-100 bg-indigo-50/70 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-indigo-600">预计匹配度</p>
              <div className="mt-3 flex items-end gap-3">
                <span className="text-5xl font-semibold tracking-tight text-slate-950">{preview.fitScore}</span>
                <span className="pb-2 text-sm text-slate-600">/ 100</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                这只是基于当前文本的快速估算，不能替代正式差距分析结果。
              </p>
            </div>

            <SummaryPanel
              icon={<CheckCircle className="text-emerald-500" size={16} />}
              items={preview.strengths}
              title="已经具备的信号"
            />
            <SummaryPanel
              icon={<AlertCircle className="text-orange-500" size={16} />}
              items={preview.gaps}
              title="还需要补强的地方"
            />
            <SummaryPanel
              icon={<Lightbulb className="text-amber-500" size={16} />}
              items={preview.suggestions}
              title="进入正式工作台后会发生什么"
            />
          </div>
        </div>
      </aside>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ModeSwitcher({
  activeMode,
  onChange,
  textLabel,
  fileLabel
}: {
  activeMode: InputMode;
  onChange: (mode: InputMode) => void;
  textLabel: string;
  fileLabel: string;
}) {
  return (
    <div className="inline-flex rounded-full border border-black/5 bg-paper p-1">
      <button
        className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
          activeMode === "text" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"
        }`}
        onClick={() => onChange("text")}
        type="button"
      >
        {textLabel}
      </button>
      <button
        className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
          activeMode === "file" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"
        }`}
        onClick={() => onChange("file")}
        type="button"
      >
        {fileLabel}
      </button>
    </div>
  );
}

function UploadCard({
  title,
  helper,
  icon,
  uploadName,
  uploadState,
  onChange,
  onClear,
  accept
}: {
  title: string;
  helper: string;
  icon: React.ReactNode;
  uploadName: string | null;
  uploadState: string | null;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  accept: string;
}) {
  return (
    <div className="relative flex min-h-[220px] flex-col items-center justify-center rounded-[1.4rem] border-2 border-dashed border-slate-200 bg-paper px-6 py-8 text-center">
      {uploadName ? (
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">{title}</p>
            <p className="mt-2 max-w-[280px] break-all text-sm text-slate-700">{uploadName}</p>
            {uploadState ? <p className="mt-2 text-xs leading-5 text-slate-500">{uploadState}</p> : null}
          </div>
          <button
            className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600"
            onClick={onClear}
            type="button"
          >
            <X size={14} />
            清除
          </button>
        </div>
      ) : (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
            {icon}
          </div>
          <p className="mt-4 text-base font-semibold text-slate-950">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
          <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900">
            <Upload size={16} />
            选择文件
            <input accept={accept} className="sr-only" onChange={onChange} type="file" />
          </label>
        </>
      )}
    </div>
  );
}

function SummaryPanel({
  title,
  items,
  icon
}: {
  title: string;
  items: string[];
  icon?: React.ReactNode;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[1.4rem] border border-black/5 bg-paper/70 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </h3>
      <ul className="mt-4 grid gap-3">
        {items.map((item) => (
          <li key={item} className="rounded-[1rem] border border-black/5 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

async function readFileAsText(file: File) {
  const textTypes = ["text/plain", "text/markdown", "application/json"];

  if (textTypes.includes(file.type) || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
    return file.text();
  }

  return "";
}

async function uploadSourceFile({
  file,
  kind
}: {
  file: File;
  kind: "resume_source" | "jd_source" | "profile_photo";
}) {
  const textFallback = await readFileAsText(file);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", kind);

  const response = await fetch("/api/uploads/ingest", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    return null;
  }

  const result = (await response.json()) as {
    assetRef: string;
    extractedText: string;
    extractionState: "full_text" | "partial_text" | "stored_only";
    company?: string;
    jobTitle?: string;
  };

  return {
    ...result,
    extractedText: result.extractedText || textFallback
  };
}

const fieldClassName =
  "w-full rounded-[1.2rem] border border-black/5 bg-paper px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-accent";
