import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRight,
  FileText,
  Sparkles,
  Target,
  Upload
} from "lucide-react";
import { getDefaultUserContext } from "@/lib/default-user";
import { getApplicationDraftDefaults } from "@/lib/services/talent/application-draft-defaults";
import { getCareerLaneCallout } from "@/lib/services/talent/career-lane-callout";
import {
  getLatestConfirmedCareerNavigationForTalentProfile,
  getLatestConfirmedTalentProfile
} from "@/lib/services/talent/talent-profile-service";

export const dynamic = "force-dynamic";

type NewApplicationPageProps = {
  searchParams?: Promise<{
    lane?: string;
    role?: string;
    mode?: string;
  }>;
};

export default async function NewApplicationPage({ searchParams }: NewApplicationPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const mode = resolvedSearchParams?.mode;

  if (mode === "create") {
    const { default: CreateResumeFlow } = await import("./create-resume-flow");
    return <CreateResumeFlow />;
  }

  if (mode === "upload") {
    const { default: UploadResumeFlow } = await import("./upload-resume-flow");
    return <UploadResumeFlow />;
  }

  if (mode === "jd") {
    const { JdCustomizeFlow } = await import("./jd-customize-flow");
    return <JdCustomizeFlow searchParams={resolvedSearchParams} />;
  }

  return (
    <main className="p-8 max-w-6xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1f1f1f] mb-2">简历准备</h1>
        <p className="text-[#666]">选择一种方式开始准备你的求职简历</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: 创建简历 */}
        <Link
          href={"/applications/new?mode=create" as Route}
          className="group bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6 hover:shadow-lg transition-all border-2 border-transparent hover:border-[#1677ff]/30"
        >
          <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-5">
            <FileText className="text-[#1677ff]" size={28} />
          </div>
          <h2 className="text-xl font-semibold text-[#1f1f1f] mb-3">简历创建</h2>
          <p className="text-sm text-[#666] mb-6 leading-relaxed">
            从零开始填写基本信息、教育经历、工作经历、项目经历，AI 帮你生成一份专业简历。
          </p>
          <div className="flex items-center gap-2 text-[#1677ff] text-sm font-medium">
            <span>开始创建</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Card 2: 已有简历 AI 优化 */}
        <Link
          href={"/applications/new?mode=upload" as Route}
          className="group bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6 hover:shadow-lg transition-all border-2 border-transparent hover:border-[#1677ff]/30"
        >
          <div className="w-14 h-14 bg-purple-50 rounded-xl flex items-center justify-center mb-5">
            <Upload className="text-purple-500" size={28} />
          </div>
          <h2 className="text-xl font-semibold text-[#1f1f1f] mb-3">已有简历 AI 优化</h2>
          <p className="text-sm text-[#666] mb-6 leading-relaxed">
            上传 PDF / DOCX / 图片简历，AI 自动解析并优化语言表达，突出核心优势。
          </p>
          <div className="flex items-center gap-2 text-[#1677ff] text-sm font-medium">
            <span>上传简历</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Card 3: JD 定制简历 */}
        <Link
          href={"/applications/new?mode=jd" as Route}
          className="group bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6 hover:shadow-lg transition-all border-2 border-transparent hover:border-[#1677ff]/30"
        >
          <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center mb-5">
            <Target className="text-green-600" size={28} />
          </div>
          <h2 className="text-xl font-semibold text-[#1f1f1f] mb-3">JD 定制简历</h2>
          <p className="text-sm text-[#666] mb-6 leading-relaxed">
            输入或上传目标岗位 JD，AI 分析差距并给出改写建议，生成针对性定制简历。
          </p>
          <div className="flex items-center gap-2 text-[#1677ff] text-sm font-medium">
            <span>开始定制</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* AI Optimization Hint */}
      <div className="mt-8 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#1677ff]/10 flex items-center justify-center shrink-0">
            <Sparkles className="text-[#1677ff]" size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-[#1f1f1f] mb-1">AI 小助手</h3>
            <p className="text-sm text-[#666] leading-relaxed">
              无论选择哪种方式，AI 都会在简历生成过程中帮你优化语言表达，突出核心优势，提高简历通过率。
              如果你已有天赋画像，AI 还会结合你的优势特质进行个性化推荐。
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
