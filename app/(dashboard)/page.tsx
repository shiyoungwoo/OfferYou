import Link from "next/link";
import type { Route } from "next";

const quickCards = [
  {
    title: "修改简历",
    body: "先上传 JD 和初版简历，马上看到岗位匹配度、优势点和修改建议，再进入正式改写工作台。",
    href: "/applications/new",
    cta: "开始修改"
  },
  {
    title: "面试准备",
    body: "基于已投递的岗位快照，快速整理面试问题、自我介绍和答案草稿，不再重复输入公司和岗位。",
    href: "/prep",
    cta: "去准备"
  },
  {
    title: "发现自己",
    body: "通过一系列问题挖掘自己的隐藏优势、工作方式和更适合的发展方向，再沉淀为长期资料。",
    href: "/talent",
    cta: "去发现"
  },
  {
    title: "我的",
    body: "查看自己的资料库、发现自己结果、职业方向、历史简历和申请记录，让产品从一次性工具变成长期陪伴。",
    href: "/me",
    cta: "查看我的"
  }
] satisfies Array<{
  title: string;
  body: string;
  href: Route;
  cta: string;
}>;

export default function DashboardPage() {
  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-card backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-accent">OfferYou Restart</p>
          <div className="mt-4 grid gap-6 md:grid-cols-[1.6fr_1fr]">
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
                先把简历改到能投，再把面试准备和天赋发现接上。
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-700">
                OfferYou 的第一价值是先把简历修改做到合格，再把面试准备、天赋发现和长期资料沉淀接进来。
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  className="inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
                  href="/applications/new"
                >
                  先修改简历
                </Link>
                <Link
                  className="inline-flex rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
                  href="/prep"
                >
                  面试准备
                </Link>
                <Link
                  className="inline-flex rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
                  href="/talent"
                >
                  发现自己
                </Link>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-line bg-paper p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">产品主线</p>
              <p className="mt-4 text-2xl font-semibold">岗位定制 {"->"} 面试准备 {"->"} 天赋发现</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                不先用复杂系统教育用户，先让人上手获得结果。面试准备和自我探索是增强价值，但要在首页保留入口，不能被藏起来。
              </p>
            </div>
          </div>
        </div>

        <section className="grid gap-5 md:grid-cols-4">
          {quickCards.map((card) => (
            <article key={card.title} className="rounded-[1.5rem] border border-line bg-white/85 p-6 shadow-card">
              <h2 className="text-xl font-semibold">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">{card.body}</p>
              <Link
                className="mt-5 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
                href={card.href}
              >
                {card.cta}
              </Link>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
