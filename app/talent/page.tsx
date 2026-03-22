import Link from "next/link";
import { TalentProfileWorkbench } from "@/components/talent/talent-profile-workbench";
import { getDefaultUserContext } from "@/lib/default-user";
import {
  getLatestConfirmedCareerNavigationForTalentProfile,
  getLatestConfirmedTalentProfile
} from "@/lib/services/talent/talent-profile-service";

export const dynamic = "force-dynamic";

export default async function TalentPage() {
  const { userId } = getDefaultUserContext();
  const initialConfirmedTalentProfile = await getLatestConfirmedTalentProfile(userId);
  const initialConfirmedCareerNavigation = initialConfirmedTalentProfile
    ? await getLatestConfirmedCareerNavigationForTalentProfile(userId, initialConfirmedTalentProfile.id)
    : null;

  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="grid gap-5 rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-card lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">发现自己</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
              发现自己，比急着给自己贴标签更重要。
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">
              这里不是让你立刻给自己下定义，而是先从真实经历出发，重新看见自己更擅长什么、隐藏的优点是什么，以及下一步更值得认真尝试哪些方向。你可以先做 5 分钟的初步挖掘，也可以进入更完整的深度挖掘。
            </p>
          </div>

          <div className="rounded-[1.6rem] border border-line bg-paper p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">这个模块的作用</p>
            <p className="mt-4 text-2xl font-semibold">先看见自己，再沉淀长期资料</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              发现自己不会阻塞修改简历主流程，但会帮助你更长期地理解自己的优势、方向和更适合的工作方式。现在已经拆成初步挖掘和深度挖掘两档。
            </p>
            <Link
              className="mt-5 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
              href="/applications/new"
            >
              回到修改简历
            </Link>
          </div>
        </header>
        <TalentProfileWorkbench
          initialConfirmedCareerNavigation={initialConfirmedCareerNavigation}
          initialConfirmedTalentProfile={initialConfirmedTalentProfile}
        />
      </section>
    </main>
  );
}
