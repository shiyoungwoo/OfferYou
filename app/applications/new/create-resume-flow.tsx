import Link from "next/link";
import { ResumeCreationForm } from "@/components/applications/resume-creation-form";

export default function CreateResumeFlow() {
  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto max-w-4xl">
        <header className="mb-8">
          <Link href="/applications/new" className="text-sm text-[#1677ff] hover:underline mb-3 inline-block">
            &larr; 返回简历准备
          </Link>
          <h1 className="text-3xl font-bold text-[#1f1f1f] mb-2">创建简历</h1>
          <p className="text-[#666]">从零填写各模块信息，AI 帮你生成一份专业简历。</p>
        </header>
        <ResumeCreationForm showUpload={false} />
      </section>
    </main>
  );
}
