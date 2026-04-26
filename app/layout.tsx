import type { Metadata } from "next";
import "./globals.css";
import { MainLayout } from "@/components/layout/main-layout";

export const metadata: Metadata = {
  title: "OfferYou",
  description: "基于真实经历的岗位定制助手：差距分析、建议清单、快照简历与长期资料沉淀。",
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
