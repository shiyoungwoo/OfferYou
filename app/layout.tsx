import type { Metadata } from "next";
import "./globals.css";
import { MainLayout } from "@/components/layout/main-layout";

export const metadata: Metadata = {
  title: "OfferYou",
  description: "AI 智能求职助手，助力更高效地准备简历、面试与职业规划。",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased text-slate-800">
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
