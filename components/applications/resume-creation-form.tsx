"use client";

import React, { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import type { CalibratedResumeProfile, CalibratedResumeEntry } from "@/lib/services/calibration/resume-calibration-types";
import { uploadSourceFile } from "./upload-card";

type EducationEntry = { id: string; school: string; degree: string; major: string; dateRange: string };
type WorkEntry = { id: string; company: string; role: string; dateRange: string; industry: string; bullets: string };
type ProjectEntry = { id: string; name: string; role: string; dateRange: string; link: string; bullets: string };

function newId() { return `local-${crypto.randomUUID()}`; }

const fieldCls = "w-full rounded-xl border border-black/5 bg-paper px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-accent";
const sectionCls = "rounded-[1.8rem] border border-black/5 bg-white/90 p-6 shadow-card";

export function ResumeCreationForm({
  showUpload,
  initialProfile
}: {
  showUpload: boolean;
  initialProfile?: CalibratedResumeProfile | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const uploadRequestIdRef = useRef(0);

  // Basic info
  const [name, setName] = useState(initialProfile?.personalInfo.name ?? "");
  const [targetTitle, setTargetTitle] = useState("");
  const [phone, setPhone] = useState(initialProfile?.personalInfo.phone ?? "");
  const [email, setEmail] = useState(initialProfile?.personalInfo.email ?? "");
  const [city, setCity] = useState(initialProfile?.personalInfo.location ?? "");
  const [yearsExp, setYearsExp] = useState("");
  const [summary, setSummary] = useState(
    initialProfile?.entries.find((e) => e.section === "summary")?.bullets.join("\n") ?? ""
  );

  // Repeatable entries
  const [educations, setEducations] = useState<EducationEntry[]>(() => {
    if (!initialProfile) return [{ id: newId(), school: "", degree: "", major: "", dateRange: "" }];
    return initialProfile.entries.filter((e) => e.section === "education").map(mapEducationEntry);
  });

  const [works, setWorks] = useState<WorkEntry[]>(() => {
    if (!initialProfile) return [{ id: newId(), company: "", role: "", dateRange: "", industry: "", bullets: "" }];
    return initialProfile.entries.filter((e) => e.section === "work").map(mapWorkEntry);
  });

  const [projects, setProjects] = useState<ProjectEntry[]>(() => {
    if (!initialProfile) return [{ id: newId(), name: "", role: "", dateRange: "", link: "", bullets: "" }];
    return initialProfile.entries.filter((e) => e.section === "project").map((e) => ({
      id: e.id, name: e.title, role: e.role ?? "", dateRange: e.dateRange ?? "", link: "", bullets: e.bullets.join("\n")
    }));
  });

  const [skills, setSkills] = useState(
    initialProfile?.entries.filter((e) => e.section === "credential").map((e) => e.title).join("、") ?? ""
  );
  const submitLabel = showUpload ? "保存并开始 AI 优化" : "保存简历";
  const pendingLabel = showUpload ? "正在保存并生成优化建议..." : "正在保存简历...";

  // Upload handler
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const requestId = uploadRequestIdRef.current + 1;
    uploadRequestIdRef.current = requestId;
    setUploadName(file.name);
    setUploadState("正在上传并解析简历...");
    setIsParsing(true);
    resetParsedResumeFields();

    const result = await uploadSourceFile({ file, kind: "resume_source" });
    if (requestId !== uploadRequestIdRef.current) return;
    if (!result) {
      setUploadState("上传失败，请重试。");
      setIsParsing(false);
      return;
    }

    setUploadState("正在 AI 结构化解析...");
    try {
      const resp = await fetch("/api/calibrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: result.extractedText })
      });
      if (!resp.ok) throw new Error("calibrate failed");
      const profile: CalibratedResumeProfile = await resp.json();
      if (requestId !== uploadRequestIdRef.current) return;

      // Pre-fill form
      setName(profile.personalInfo.name ?? "");
      setPhone(profile.personalInfo.phone ?? "");
      setEmail(profile.personalInfo.email ?? "");
      setCity(profile.personalInfo.location ?? "");
      setSummary(profile.entries.find((e) => e.section === "summary")?.bullets.join("\n") ?? "");

      const eduEntries = profile.entries.filter((e) => e.section === "education");
      if (eduEntries.length > 0) {
        setEducations(eduEntries.map(mapEducationEntry));
      }
      const workEntries = profile.entries.filter((e) => e.section === "work");
      if (workEntries.length > 0) {
        setWorks(workEntries.map(mapWorkEntry));
      }
      const projEntries = profile.entries.filter((e) => e.section === "project");
      if (projEntries.length > 0) {
        setProjects(projEntries.map((e) => ({
          id: e.id, name: e.title, role: e.role ?? "", dateRange: e.dateRange ?? "", link: "", bullets: e.bullets.join("\n")
        })));
      }
      setSkills(profile.entries.filter((e) => e.section === "credential").map((e) => e.title).join("、"));

      const sourceLabel = profile.modelProvider === "deterministic_fallback" ? "当前为规则兜底，需重点核对工作经历和项目经验。" : "已使用 AI 校准结构，请核对低置信字段。";
      setUploadState(`解析完成，已自动填充表单。${sourceLabel}`);
    } catch {
      if (requestId !== uploadRequestIdRef.current) return;
      setUploadState("AI 解析失败，已提取文本，请手动填写。");
    }
    setIsParsing(false);
  }

  // Submit
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!targetTitle.trim()) {
      setError("请先填写求职意向，再保存简历。");
      return;
    }

    const profile = buildProfile();
    startTransition(async () => {
      try {
        const resp = await fetch("/api/drafts/from-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile, jobTitle: targetTitle, company: "" })
        });
        const result = (await resp.json()) as { id?: string; error?: string };
        if (!resp.ok || !result.id) {
          setError(result.error ?? "创建失败，请检查表单。");
          return;
        }
        router.push(`/applications/${result.id}`);
      } catch {
        setError("网络错误，请重试。");
      }
    });
  }

  function resetParsedResumeFields() {
    setSummary("");
    setEducations([{ id: newId(), school: "", degree: "", major: "", dateRange: "" }]);
    setWorks([{ id: newId(), company: "", role: "", dateRange: "", industry: "", bullets: "" }]);
    setProjects([{ id: newId(), name: "", role: "", dateRange: "", link: "", bullets: "" }]);
    setSkills("");
  }

  function buildProfile(): CalibratedResumeProfile {
    const entries: CalibratedResumeEntry[] = [];

    if (summary.trim()) {
      entries.push({
        id: newId(), section: "summary", title: "个人优势",
        bullets: summary.split("\n").filter((l) => l.trim()),
        sourceText: summary, confidence: "high", issues: []
      });
    }

    for (const w of works) {
      if (!w.company.trim()) continue;
      entries.push({
        id: w.id, section: "work", title: w.company, organization: w.company,
        role: w.role, dateRange: w.dateRange,
        bullets: w.bullets.split("\n").filter((l) => l.trim()),
        sourceText: `${w.company} ${w.role}`, confidence: "high", issues: []
      });
    }

    for (const p of projects) {
      if (!p.name.trim()) continue;
      entries.push({
        id: p.id, section: "project", title: p.name,
        role: p.role, dateRange: p.dateRange,
        bullets: p.bullets.split("\n").filter((l) => l.trim()),
        sourceText: p.name, confidence: "high", issues: []
      });
    }

    for (const ed of educations) {
      if (!ed.school.trim()) continue;
      entries.push({
        id: ed.id, section: "education", title: ed.school,
        role: ed.degree, organization: ed.major, dateRange: ed.dateRange,
        bullets: [], sourceText: ed.school, confidence: "high", issues: []
      });
    }

    if (skills.trim()) {
      entries.push({
        id: newId(), section: "credential", title: skills.trim(),
        bullets: [], sourceText: skills, confidence: "high", issues: []
      });
    }

    return {
      status: "confirmed",
      personalInfo: { name, phone, email, location: city },
      entries,
      unclassifiedText: [],
      parseWarnings: [],
      modelNotes: []
    };
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      {/* Upload zone */}
      {showUpload && (
        <div className={sectionCls}>
          <p className="text-sm uppercase tracking-[0.24em] text-accent mb-2">上传已有简历</p>
          <p className="text-sm text-slate-600 mb-4">支持 PDF、Word、图片、TXT，AI 自动解析并填充下方表单。</p>
          <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-[1.4rem] border-2 border-dashed border-slate-200 bg-paper px-6 py-8 text-center">
            <FileText className="text-blue-600 mb-3" size={32} />
            <span className="text-sm font-semibold text-slate-950">{uploadName ?? "点击选择文件"}</span>
            {uploadState && <span className="mt-2 text-xs text-slate-500">{uploadState}</span>}
            <input accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg" className="sr-only" onChange={handleFileUpload} type="file" />
          </label>
        </div>
      )}

      {/* Basic info */}
      <div className={sectionCls}>
        <p className="text-sm uppercase tracking-[0.24em] text-accent mb-4">基本信息</p>
        <div className="grid gap-4 md:grid-cols-2">
          <FieldInput label="姓名" value={name} onChange={setName} placeholder="张三" />
          <FieldInput label="求职意向" value={targetTitle} onChange={setTargetTitle} placeholder="AI 产品经理" required />
          <FieldInput label="手机号码" value={phone} onChange={setPhone} placeholder="13800138000" />
          <FieldInput label="电子邮箱" value={email} onChange={setEmail} placeholder="zhangsan@example.com" />
          <FieldInput label="所在城市" value={city} onChange={setCity} placeholder="北京" />
          <FieldSelect label="工作年限" value={yearsExp} onChange={setYearsExp} options={["应届毕业生", "1年以下", "1-3年", "3-5年", "5-10年", "10年以上"]} />
        </div>
        <label className="mt-4 grid gap-1.5 text-sm font-medium text-slate-700">
          <span>个人简介</span>
          <textarea className={`${fieldCls} min-h-[100px] resize-y`} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="简要描述你的核心优势和职业方向..." />
        </label>
      </div>

      {/* Education */}
      <div className={sectionCls}>
        <SectionHeader title="教育经历" count={educations.length} onAdd={() => setEducations([...educations, { id: newId(), school: "", degree: "", major: "", dateRange: "" }])} />
        {educations.map((edu, i) => (
          <EntryBlock key={edu.id} index={i} canRemove={educations.length > 1} onRemove={() => setEducations(educations.filter((e) => e.id !== edu.id))}>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldInput label="学校名称" value={edu.school} onChange={(v) => updateEntry(educations, setEducations, edu.id, { school: v })} placeholder="北京大学" />
              <FieldSelect label="学历" value={edu.degree} onChange={(v) => updateEntry(educations, setEducations, edu.id, { degree: v })} options={["高中", "大专", "本科", "硕士", "博士"]} />
              <FieldInput label="专业" value={edu.major} onChange={(v) => updateEntry(educations, setEducations, edu.id, { major: v })} placeholder="计算机科学" />
              <FieldInput label="就读时间" value={edu.dateRange} onChange={(v) => updateEntry(educations, setEducations, edu.id, { dateRange: v })} placeholder="2018.09 - 2022.06" />
            </div>
          </EntryBlock>
        ))}
      </div>

      {/* Work */}
      <div className={sectionCls}>
        <SectionHeader title="工作经历" count={works.length} onAdd={() => setWorks([...works, { id: newId(), company: "", role: "", dateRange: "", industry: "", bullets: "" }])} />
        {works.map((w, i) => (
          <EntryBlock key={w.id} index={i} canRemove={works.length > 1} onRemove={() => setWorks(works.filter((e) => e.id !== w.id))}>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldInput label="公司名称" value={w.company} onChange={(v) => updateEntry(works, setWorks, w.id, { company: v })} placeholder="字节跳动" />
              <FieldInput label="职位名称" value={w.role} onChange={(v) => updateEntry(works, setWorks, w.id, { role: v })} placeholder="产品经理" />
              <FieldInput label="在职时间" value={w.dateRange} onChange={(v) => updateEntry(works, setWorks, w.id, { dateRange: v })} placeholder="2020.07 - 至今" />
              <FieldInput label="公司行业" value={w.industry} onChange={(v) => updateEntry(works, setWorks, w.id, { industry: v })} placeholder="互联网/电子商务" />
              <div className="md:col-span-2">
                <FieldTextarea label="工作描述（每行一条）" value={w.bullets} onChange={(v) => updateEntry(works, setWorks, w.id, { bullets: v })} placeholder={"负责产品规划与需求分析\n主导用户增长项目，DAU 提升 30%"} />
              </div>
            </div>
          </EntryBlock>
        ))}
      </div>

      {/* Projects */}
      <div className={sectionCls}>
        <SectionHeader title="项目经验" count={projects.length} onAdd={() => setProjects([...projects, { id: newId(), name: "", role: "", dateRange: "", link: "", bullets: "" }])} />
        {projects.map((p, i) => (
          <EntryBlock key={p.id} index={i} canRemove={projects.length > 1} onRemove={() => setProjects(projects.filter((e) => e.id !== p.id))}>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldInput label="项目名称" value={p.name} onChange={(v) => updateEntry(projects, setProjects, p.id, { name: v })} placeholder="智能推荐系统" />
              <FieldInput label="担任角色" value={p.role} onChange={(v) => updateEntry(projects, setProjects, p.id, { role: v })} placeholder="前端负责人" />
              <FieldInput label="项目时间" value={p.dateRange} onChange={(v) => updateEntry(projects, setProjects, p.id, { dateRange: v })} placeholder="2021.03 - 2021.10" />
              <FieldInput label="项目链接" value={p.link} onChange={(v) => updateEntry(projects, setProjects, p.id, { link: v })} placeholder="https://..." />
              <div className="md:col-span-2">
                <FieldTextarea label="项目描述（每行一条）" value={p.bullets} onChange={(v) => updateEntry(projects, setProjects, p.id, { bullets: v })} placeholder={"设计并实现推荐算法，准确率提升 20%\n搭建 A/B 测试框架，支撑日均千万级流量"} />
              </div>
            </div>
          </EntryBlock>
        ))}
      </div>

      {/* Skills */}
      <div className={sectionCls}>
        <p className="text-sm uppercase tracking-[0.24em] text-accent mb-4">技能特长</p>
        <FieldTextarea label="专业技能（逗号或换行分隔）" value={skills} onChange={setSkills} placeholder="Python, React, 项目管理, 数据分析, 用户研究" />
      </div>

      {/* Submit */}
      <button
        className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white transition ${isPending || isParsing ? "bg-slate-400" : "bg-ink hover:bg-slate-900"}`}
        disabled={isPending || isParsing}
        type="submit"
      >
        {isPending ? <><Loader2 className="animate-spin" size={18} />{pendingLabel}</> : submitLabel}
      </button>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    </form>
  );
}

// --- Helper components ---

function FieldInput({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>{label}{required ? <span className="ml-1 text-rose-500">*</span> : null}</span>
      <input className={fieldCls} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} />
    </label>
  );
}

function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <select className={fieldCls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">请选择</option>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

function FieldTextarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <textarea className={`${fieldCls} min-h-[100px] resize-y`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function SectionHeader({ title, count, onAdd }: { title: string; count: number; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <p className="text-sm uppercase tracking-[0.24em] text-accent">{title}</p>
      <button className="inline-flex items-center gap-1 text-sm text-[#1677ff] hover:underline" onClick={(e) => { e.preventDefault(); onAdd(); }} type="button">
        <Plus size={14} /> 添加
      </button>
    </div>
  );
}

function EntryBlock({ index, canRemove, onRemove, children }: { index: number; canRemove: boolean; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="relative rounded-xl border border-gray-100 bg-gray-50/50 p-5 mb-4">
      {canRemove && (
        <button className="absolute top-3 right-3 text-slate-400 hover:text-rose-500" onClick={(e) => { e.preventDefault(); onRemove(); }} type="button">
          <Trash2 size={16} />
        </button>
      )}
      <p className="text-xs text-slate-400 mb-3">#{index + 1}</p>
      {children}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function updateEntry<T extends { id: string }>(list: T[], setter: (v: T[]) => void, id: string, patch: Partial<T>) {
  setter(list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
}

function mapEducationEntry(entry: CalibratedResumeEntry): EducationEntry {
  const parsed = parseEducationEntryTitle(entry.title);
  return {
    id: entry.id,
    school: parsed?.school ?? entry.title,
    degree: entry.role ?? parsed?.degree ?? "",
    major: entry.organization ?? parsed?.major ?? "",
    dateRange: entry.dateRange ?? ""
  };
}

function mapWorkEntry(entry: CalibratedResumeEntry): WorkEntry {
  const parsed = parseWorkEntryTitle(entry.title);
  const company = entry.organization ?? parsed?.organization ?? entry.title;
  return {
    id: entry.id,
    company,
    role: entry.role ?? parsed?.role ?? (company === entry.title ? "" : entry.title),
    dateRange: entry.dateRange ?? "",
    industry: "",
    bullets: entry.bullets.join("\n")
  };
}

function parseEducationEntryTitle(title: string) {
  const parts = title.split(/[|｜]/u).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  return {
    school: parts[0],
    degree: parts[1],
    major: parts.slice(2).join(" | ")
  };
}

function parseWorkEntryTitle(title: string) {
  const parts = title.split(/\s+[—–-]\s+|[|｜]/u).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2 || !/(公司|银行|集团|分行|支行|科技|网络|中心|有限公司|股份有限公司)/u.test(parts[0] ?? "")) {
    return null;
  }
  return {
    organization: parts[0],
    role: parts.slice(1).join(" / ")
  };
}
