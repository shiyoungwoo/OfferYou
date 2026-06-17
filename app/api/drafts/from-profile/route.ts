import { z } from "zod";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDefaultUserContext } from "@/lib/default-user";
import { getStorageRoot } from "@/lib/runtime/storage-root";
import { saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import type { PersistedWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { LocalStorageAdapter } from "@/lib/storage/local-storage-adapter";
import type { CalibratedResumeProfile } from "@/lib/services/calibration/resume-calibration-types";
import { listMasterFacts } from "@/lib/services/master/master-service";
import { getLatestConfirmedTalentProfile } from "@/lib/services/talent/talent-profile-service";
import { generateResumeOnlyOptimizationSuggestions } from "@/lib/services/analysis/resume-only-optimizer";

function getStorageAdapter() { return new LocalStorageAdapter(getStorageRoot()); }

const fromProfileSchema = z.object({
  profile: z.record(z.unknown()),
  jobTitle: z.string().max(200).optional(),
  company: z.string().max(200).optional()
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON。" }, { status: 400 });
  }

  const parsed = fromProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const profile = parsed.data.profile as unknown as CalibratedResumeProfile;
  if (!profile?.personalInfo || !Array.isArray(profile.entries)) {
    return NextResponse.json({ error: "简历数据格式不正确，缺少 personalInfo 或 entries。" }, { status: 400 });
  }

  try {
    const { userId } = getDefaultUserContext();
    const draftId = randomUUID();
    const jobTitle = parsed.data.jobTitle?.trim() || "";
    const company = parsed.data.company || "";

    const resumeExtractedText = profileToText(profile);

    const jdAsset = await getStorageAdapter().put({
      userId,
      kind: "jd_source",
      filename: `${company}-${jobTitle}-${draftId}.txt`,
      buffer: Buffer.from(""),
      mimeType: "text/plain"
    });

    const masterFacts = await listMasterFacts(userId);
    const talentProfile = await getLatestConfirmedTalentProfile(userId);
    const optimization = await generateResumeOnlyOptimizationSuggestions({
      profile,
      targetTitle: jobTitle,
      talentHeadline: talentProfile?.profile.headline
    });
    const riskNotes = optimization.fallbackReason ? [optimization.fallbackReason] : [];

    const draft: PersistedWorkspaceDraft = {
      id: draftId,
      userId,
      company,
      jobTitle,
      language: "zh",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "",
      jdAsset,
      resumeExtractedText,
      calibratedResume: profile,
      analysis: {
        fitScore: 0,
        optimizationMode: "baseline_jd_match",
        strengths: optimization.suggestions.length > 0 ? ["已生成通用简历优化建议，需人工确认后进入预览。"] : [],
        gaps: [],
        riskNotes
      },
      talentProfileUsed: talentProfile
        ? { id: talentProfile.id, headline: talentProfile.profile.headline, confidenceNote: talentProfile.profile.confidenceNote }
        : undefined,
      masterFactsUsed: masterFacts,
      suggestions: optimization.suggestions,
      factSubmissions: []
    };

    await saveWorkspaceDraft(draft);

    return NextResponse.json({ id: draftId }, { status: 201 });
  } catch (error) {
    console.error("[API /drafts/from-profile] unexpected error:", error);
    return NextResponse.json(
      { error: "从简历档案创建草稿失败，请稍后重试。" },
      { status: 500 }
    );
  }
}

function profileToText(profile: CalibratedResumeProfile): string {
  const lines: string[] = [];

  if (profile.personalInfo.name) lines.push(profile.personalInfo.name);
  if (profile.personalInfo.phone) lines.push(`手机：${profile.personalInfo.phone}`);
  if (profile.personalInfo.email) lines.push(`邮箱：${profile.personalInfo.email}`);
  if (profile.personalInfo.location) lines.push(`城市：${profile.personalInfo.location}`);
  lines.push("");

  const sections: Record<string, string> = {
    summary: "个人优势",
    work: "工作经历",
    project: "项目经历",
    education: "教育背景",
    credential: "技能证书"
  };

  for (const [section, title] of Object.entries(sections)) {
    const entries = profile.entries.filter((e) => e.section === section);
    if (entries.length === 0) continue;
    lines.push(`## ${title}`);
    for (const entry of entries) {
      const parts = [entry.title];
      if (entry.role) parts.push(entry.role);
      if (entry.dateRange) parts.push(entry.dateRange);
      lines.push(parts.join(" | "));
      for (const bullet of entry.bullets) {
        lines.push(`- ${bullet}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
