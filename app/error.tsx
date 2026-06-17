"use client";

import React from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-white text-slate-900">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
          <p className="text-sm font-semibold tracking-[0.24em] text-slate-500">页面加载失败</p>
          <h1 className="mt-4 text-3xl font-bold">当前页面加载失败</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            当前页面暂时无法正常展示。可以稍后重试，或者返回首页继续操作。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              className="w-fit rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
              onClick={reset}
              type="button"
            >
              重新加载
            </button>
            <Link
              className="w-fit rounded-full border border-line bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              href="/"
            >
              返回首页
            </Link>
          </div>
          {error.digest ? <p className="mt-4 text-xs text-slate-400">错误标识：{error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
