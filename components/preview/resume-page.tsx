import React from "react";

type ResumePageProps = {
  pageNumber: number;
  children: React.ReactNode;
};

export function ResumePage({ pageNumber, children }: ResumePageProps) {
  return (
    <article className="mx-auto w-[794px] rounded-2xl bg-white px-[52px] py-[44px] shadow-[0_2px_24px_rgba(0,0,0,0.10)] print:w-auto print:rounded-none print:px-0 print:py-0 print:shadow-none">
      {children}
      <footer className="mt-6 border-t border-slate-200 pt-3 text-right text-[10px] tracking-[0.2em] text-slate-400 print:mt-4">
        第 {pageNumber} 页
      </footer>
    </article>
  );
}
