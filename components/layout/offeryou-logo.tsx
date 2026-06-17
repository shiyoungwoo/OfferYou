import React from "react";

type OfferYouLogoProps = {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
};

const sizeClass = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14"
};

const wordmarkClass = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl"
};

export function OfferYouLogo({ size = "md", showWordmark = true }: OfferYouLogoProps) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark className={sizeClass[size]} />
      {showWordmark ? (
        <span className={`${wordmarkClass[size]} font-bold tracking-[-0.03em] leading-none`}>
          <span className="text-[#111827]">Offer</span>
          <span className="text-[#1f7ae0]">You</span>
        </span>
      ) : null}
    </div>
  );
}

function LogoMark({ className }: { className: string }) {
  return (
    <span className={`${className} block drop-shadow-[0_12px_28px_rgba(31,122,224,0.22)]`}>
      <svg aria-hidden="true" viewBox="0 0 80 80" className="h-full w-full">
        <rect width="80" height="80" rx="18" fill="#1f7ae0" />
        <circle cx="48" cy="26" r="16" stroke="white" strokeWidth="2.5" fill="none" />
        <circle cx="48" cy="26" r="10" stroke="white" strokeWidth="2" fill="none" />
        <circle cx="48" cy="26" r="4" fill="white" />
        <line x1="30" y1="64" x2="30" y2="48" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <line x1="30" y1="48" x2="20" y2="32" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <line x1="30" y1="48" x2="42" y2="32" stroke="white" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
