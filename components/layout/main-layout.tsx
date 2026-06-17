"use client";

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  Brain,
  FileText,
  Home,
  MessageSquare,
  User
} from "lucide-react";
import { ModelSwitcher } from "@/components/model/model-switcher";
import { OfferYouLogo } from "@/components/layout/offeryou-logo";

const navItems = [
  {
    href: "/",
    label: "首页",
    icon: Home,
    matchPattern: (pathname: string) => pathname === "/"
  },
  {
    href: "/applications/new",
    label: "简历准备",
    icon: FileText,
    matchPattern: (pathname: string) => pathname.startsWith("/applications")
  },
  {
    href: "/prep",
    label: "面试准备",
    icon: MessageSquare,
    matchPattern: (pathname: string) => pathname.startsWith("/prep")
  },
  {
    href: "/talent",
    label: "天赋发掘",
    icon: Brain,
    matchPattern: (pathname: string) => pathname.startsWith("/talent")
  }
] as const;

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 z-40">
        <div className="flex items-center justify-between h-full px-6">
          <Link href="/" aria-label="OfferYou 首页" className="flex items-center">
            <OfferYouLogo size="sm" />
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/me"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${
                pathname.startsWith("/me") ? "bg-[#1677ff]/10" : "hover:bg-gray-50"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <User size={16} className="text-gray-500" />
              </div>
              <span className="text-sm text-[#1f1f1f] hidden sm:inline">个人中心</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Fixed Sidebar */}
      <aside className="fixed left-0 top-16 w-64 h-[calc(100%-4rem)] bg-white border-r border-gray-100 z-30">
        <nav className="py-4 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = item.matchPattern(pathname);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href as Route}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-[#1677ff]/10 text-[#1677ff] font-medium"
                        : "text-[#666] hover:bg-gray-50 hover:text-[#1677ff]"
                    }`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 px-4">
            <ModelSwitcher />
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="pt-16 pl-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
