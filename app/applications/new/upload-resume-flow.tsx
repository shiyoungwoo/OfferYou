import Link from "next/link";
import { ResumeCreationForm } from "@/components/applications/resume-creation-form";

export default function UploadResumeFlow() {
  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto max-w-4xl">
        <header className="mb-8">
          <Link href="/applications/new" className="text-sm text-[#1677ff] hover:underline mb-3 inline-block">
            &larr; 返回简历准备
          </Link>
          <h1 className="text-3xl font-bold text-[#1f1f1f] mb-2">已有简历 AI 优化</h1>
          <p className="text-[#666]">上传已有简历，AI 自动解析并填充表单，编辑确认后生成优化简历。</p>
        </header>
        <ResumeCreationForm showUpload={true} />
      </section>
    </main>
  );
}
