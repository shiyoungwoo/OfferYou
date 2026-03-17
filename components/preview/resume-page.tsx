import React from "react";

type ResumePageProps = {
  pageNumber: number;
  children: React.ReactNode;
};

export function ResumePage({ pageNumber, children }: ResumePageProps) {
  return (
    <article className="mx-auto w-full max-w-[794px] rounded-[1.5rem] border border-slate-300 bg-white p-10 shadow-[0_30px_60px_rgba(18,32,47,0.16)] print:shadow-none">
      <div className="grid gap-8">
        {children}
        <footer className="border-t border-line pt-4 text-right text-xs uppercase tracking-[0.24em] text-slate-400">
          Page {pageNumber}
        </footer>
      </div>
    </article>
  );
}
