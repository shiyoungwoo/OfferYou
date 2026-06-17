import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold tracking-[0.24em] text-slate-500">404</p>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">未找到内容</h1>
      <p className="mt-4 text-base leading-7 text-slate-600">
        当前页面不存在或已被移除。
      </p>
      <Link
        className="mt-8 w-fit rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        href="/"
      >
        返回首页
      </Link>
    </main>
  );
}
