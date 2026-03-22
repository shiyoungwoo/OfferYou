"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationDraftDefaults } from "@/lib/services/talent/application-draft-defaults";
import { buildDraftInputPreview } from "@/lib/services/applications/draft-input-preview";

const fieldClassName =
  "w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-accent";

type NewApplicationFormProps = {
  selectedLane?: string;
  draftDefaults: ApplicationDraftDefaults;
};

export function NewApplicationForm({ selectedLane, draftDefaults }: NewApplicationFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [company, setCompany] = useState(draftDefaults.company);
  const [jobTitle, setJobTitle] = useState(draftDefaults.jobTitle);
  const [jdContent, setJdContent] = useState(draftDefaults.jdContent);
  const [resumeAssetRef, setResumeAssetRef] = useState(draftDefaults.resumeAssetRef);
  const [profilePhotoAssetRef, setProfilePhotoAssetRef] = useState("");
  const [resumeContent, setResumeContent] = useState("");
  const [jdUploadName, setJdUploadName] = useState<string | null>(null);
  const [resumeUploadName, setResumeUploadName] = useState<string | null>(null);
  const [photoUploadName, setPhotoUploadName] = useState<string | null>(null);
  const [jdUploadState, setJdUploadState] = useState<string | null>(null);
  const [resumeUploadState, setResumeUploadState] = useState<string | null>(null);
  const [photoUploadState, setPhotoUploadState] = useState<string | null>(null);

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
      setJdUploadName(null);
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
        `已上传 JD 文件：${file.name}。当前无法完整提取正文，请手动补充或粘贴 JD 文字后再生成分析。`
    );
    setJdUploadState(
      uploaded.extractionState === "stored_only"
        ? "JD 文件已上传；如果是图片或复杂版式文件，请手动补充关键文字内容。"
        : uploaded.extractionState === "partial_text"
          ? "JD 文件已上传，并完成了初步提取；请检查并修正识别结果。"
          : "JD 文件已上传，并生成了可编辑文本。"
    );
  }

  async function handleResumeFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setResumeUploadName(null);
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
        ? "简历文件已上传，已进入流程；如果内容没有自动提取完整，建议补充粘贴关键经历。"
        : uploaded.extractionState === "partial_text"
          ? "简历文件已上传，并完成了初步提取；建议检查识别结果后再进入正式分析。"
          : "简历文件已上传，并生成了可继续编辑的文本。"
    );
  }

  async function handlePhotoFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setPhotoUploadName(null);
      setProfilePhotoAssetRef("");
      return;
    }

    setPhotoUploadName(file.name);
    setPhotoUploadState("正在上传照片...");

    const uploaded = await uploadSourceFile({
      file,
      kind: "profile_photo"
    });

    if (!uploaded) {
      setPhotoUploadState("照片上传失败，请重试。");
      return;
    }

    setProfilePhotoAssetRef(uploaded.assetRef);
    setPhotoUploadState("照片已上传，会直接进入最终简历预览和 PDF。");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      company: company.trim(),
      jobTitle: jobTitle.trim(),
      language: "en",
      masterResumeId: "default-master",
      careerDirectionSlug: selectedLane || undefined,
      jdContent: jdContent.trim(),
      resumeAssetRef: resumeAssetRef.trim(),
      resumeContent: resumeContent.trim() || undefined,
      profilePhotoAssetRef: profilePhotoAssetRef.trim() || undefined
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
        setError("生成分析工作台失败，请检查 JD 和简历内容后重试。");
        return;
      }

      router.push(`/applications/${result.id}`);
    });
  }

  return (
    <form className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]" onSubmit={handleSubmit}>
      <section className="grid gap-6 rounded-[2rem] border border-line bg-white/90 p-8 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">修改简历</p>
            <h2 className="mt-3 text-3xl font-semibold">先上传岗位和初版简历，马上开始匹配分析。</h2>
          </div>
          <div className="rounded-[1.2rem] border border-line bg-paper px-4 py-3 text-sm leading-6 text-slate-700">
            支持文字粘贴，也支持 PDF / Word / 图片上传。现在 PDF、Word、图片都会尝试提取正文；文本粘贴仍然是最稳定的输入方式。
          </div>
        </div>

        <div className="grid gap-6 rounded-[1.6rem] border border-line bg-paper p-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold">JD 窗口</h3>
            {jdUploadName ? <span className="text-sm text-slate-600">已上传：{jdUploadName}</span> : null}
          </div>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            上传 JD 文件
            <input accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.doc,.docx" className={fieldClassName} onChange={handleJdFileChange} type="file" />
          </label>
          {jdUploadState ? <p className="text-sm text-slate-600">{jdUploadState}</p> : null}
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            或直接粘贴 JD
            <textarea
              className={`${fieldClassName} min-h-52 resize-y`}
              name="jdContent"
              onChange={(event) => setJdContent(event.target.value)}
              value={jdContent}
            />
          </label>
        </div>

        <div className="grid gap-6 rounded-[1.6rem] border border-line bg-paper p-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold">客户初版简历</h3>
            {resumeUploadName ? <span className="text-sm text-slate-600">已上传：{resumeUploadName}</span> : null}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              上传初版简历
              <input accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.doc,.docx" className={fieldClassName} onChange={handleResumeFileChange} type="file" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              或新建简历标题
              <input className={fieldClassName} onChange={(event) => setJobTitle(event.target.value)} value={jobTitle} />
            </label>
          </div>
          {resumeUploadState ? <p className="text-sm text-slate-600">{resumeUploadState}</p> : null}

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            上传简历照片
            <input accept=".png,.jpg,.jpeg,.webp" className={fieldClassName} onChange={handlePhotoFileChange} type="file" />
          </label>
          {photoUploadName ? <p className="text-sm text-slate-600">已上传照片：{photoUploadName}</p> : null}
          {photoUploadState ? <p className="text-sm text-slate-600">{photoUploadState}</p> : null}

          <div className="grid gap-6 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              公司
              <input className={fieldClassName} onChange={(event) => setCompany(event.target.value)} value={company} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              简历来源标记
              <input className={fieldClassName} onChange={(event) => setResumeAssetRef(event.target.value)} value={resumeAssetRef} />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            粘贴初版简历文本，或先上传文件
            <textarea
              className={`${fieldClassName} min-h-56 resize-y`}
              onChange={(event) => setResumeContent(event.target.value)}
              placeholder="把客户现有简历、项目经历，或者先写一个基础版本贴进来。"
              value={resumeContent}
            />
          </label>
        </div>
      </section>

      <aside className="grid gap-6 rounded-[2rem] border border-line bg-white/90 p-8 shadow-card">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">岗位匹配度与建议</p>
          <h2 className="mt-3 text-3xl font-semibold">右侧先看匹配判断，再决定怎么改。</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            这是当前输入下的即时分析预览。客户可以继续补充 JD 或简历，再点击生成分析工作台进入正式改写流程。
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-accent/20 bg-accent/5 px-5 py-5">
          <p className="text-xs uppercase tracking-[0.24em] text-accent">匹配度</p>
          <p className="mt-3 text-4xl font-semibold text-ink">{preview.fitScore}</p>
          <p className="mt-3 text-sm leading-6 text-slate-700">这不是最终结论，而是帮助客户决定“先补材料还是直接进入修改”。</p>
        </div>

        <SummaryPanel items={preview.strengths} title="优势点" />
        <SummaryPanel items={preview.gaps} title="还需要补的点" />
        <SummaryPanel items={preview.suggestions} title="修改建议" />

        <div className="rounded-[1.5rem] border border-line bg-paper px-5 py-4">
          <p className="text-sm leading-6 text-slate-700">
            客户确认方向后，点击下方按钮进入正式分析工作台。接受建议后，再生成优化简历并进入预览页导出 PDF。
          </p>
        </div>

        <button
          className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "生成中..." : "生成分析工作台"}
        </button>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </aside>
    </form>
  );
}

function SummaryPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[1.5rem] border border-line bg-paper p-5">
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">{title}</h3>
      <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item} className="rounded-[1.1rem] bg-white px-4 py-3">
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
  };

  return {
    ...result,
    extractedText: result.extractedText || textFallback
  };
}
