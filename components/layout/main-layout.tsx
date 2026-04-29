"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  Database,
  FolderKanban,
  House,
  Sparkles,
  Workflow
} from "lucide-react";

const primaryNav = [
  {
    href: "/",
    label: "总览",
    description: "回到产品主线与当前入口",
    icon: House
  },
  {
    href: "/applications/new",
    label: "岗位定制",
    description: "JD 对齐、建议清单与快照简历",
    icon: BriefcaseBusiness
  },
  {
    href: "/talent",
    label: "天赋发现",
    description: "优势档案与职业方向探索",
    icon: Sparkles
  },
  {
    href: "/prep",
    label: "面试准备",
    description: "问题准备、自我介绍与答案草稿",
    icon: Workflow
  },
  {
    href: "/me",
    label: "我的资料",
    description: "查看长期资料与投递记录",
    icon: FolderKanban
  },
  {
    href: "/master",
    label: "事实主档",
    description: "确认可复用的真实事实",
    icon: Database
  }
] as const;

const principles = [
  "事实层：只收录真实、可追问验证的一手经历。",
  "洞察层：AI 提出优势与方向，必须经过人工确认。",
  "表达层：针对 JD 的改写只进入快照，不回污染主档。"
];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-slate-800">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-80 shrink-0 border-r border-black/5 bg-[#f8f4ec] px-6 py-8 lg:flex lg:flex-col">
          <Link href="/" className="rounded-[1.75rem] border border-black/5 bg-white/90 p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1f4fd6] text-white shadow-sm">
                <Workflow size={22} />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">OfferYou</p>
                <h1 className="text-2xl font-semibold text-slate-950">重启工作台</h1>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-700">
              先完成一条可靠的岗位定制链路，再把天赋发现和长期资料沉淀接回主流程。
            </p>
          </Link>

          <nav className="mt-6 grid gap-3">
            {primaryNav.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-[1.4rem] border p-4 transition ${
                    isActive
                      ? "border-accent/20 bg-accent/5 shadow-card"
                      : "border-black/5 bg-white/80 hover:border-accent/20 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${
                        isActive ? "bg-accent text-white" : "bg-paper text-slate-600"
                      }`}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-950">{item.label}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>

          <section className="mt-6 rounded-[1.6rem] border border-black/5 bg-white/90 p-5 shadow-card">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">重启锚点</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">job-apply 原型</h2>
            <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
              {principles.map((item) => (
                <li key={item} className="rounded-[1rem] bg-paper px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-auto rounded-[1.4rem] border border-dashed border-black/10 bg-white/70 px-4 py-4 text-sm leading-6 text-slate-600">
            当前不再把「社区」「积分」「假资料卡」作为 MVP 主界面的一部分，优先保证岗位定制、面试准备、事实确认和导出链路可信。
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="border-b border-black/5 bg-[#f8f4ec] px-4 py-4 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1f4fd6] text-white shadow-sm">
                <Workflow size={20} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">OfferYou</p>
                <p className="text-lg font-semibold text-slate-950">岗位定制优先</p>
              </div>
            </div>
            <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {primaryNav.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-accent text-white"
                        : "border border-black/5 bg-white text-slate-700"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
