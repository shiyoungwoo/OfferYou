import Link from "next/link";
import { getDefaultUserContext } from "@/lib/default-user";
import { getApplicationDraftDefaults } from "@/lib/services/talent/application-draft-defaults";
import {
  getLatestConfirmedCareerNavigationForTalentProfile,
  getLatestConfirmedTalentProfile
} from "@/lib/services/talent/talent-profile-service";
import { NewApplicationForm } from "@/components/applications/new-application-form";

export const dynamic = "force-dynamic";

type JdCustomizeFlowProps = {
  searchParams?: {
    lane?: string;
    role?: string;
    mode?: string;
  };
};

export async function JdCustomizeFlow({ searchParams }: JdCustomizeFlowProps) {
  const lane = searchParams?.lane;
  const role = searchParams?.role;
  const { userId } = getDefaultUserContext();
  const talentProfile = await getLatestConfirmedTalentProfile(userId);
  const careerNavigation = talentProfile
    ? await getLatestConfirmedCareerNavigationForTalentProfile(userId, talentProfile.id)
    : null;
  const draftDefaults = getApplicationDraftDefaults({
    lane,
    role,
    talentProfile,
    careerNavigation
  });

  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto max-w-4xl">
        <header className="mb-6">
          <Link href="/applications/new" className="text-sm text-[#1677ff] hover:underline mb-3 inline-block">
            &larr; 返回简历准备
          </Link>
          <h1 className="text-3xl font-bold text-[#1f1f1f] mb-2">JD 定制简历</h1>
          <p className="text-[#666]">输入目标岗位 JD 和你的简历，AI 分析差距并生成定制简历。</p>
        </header>

        <NewApplicationForm draftDefaults={draftDefaults} selectedLane={lane} />
      </section>
    </main>
  );
}
