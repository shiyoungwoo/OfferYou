"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";

type SnapshotGenerateButtonProps = {
  draftId: string;
};

export function SnapshotGenerateButton({ draftId }: SnapshotGenerateButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function generateSnapshot() {
    startTransition(async () => {
      await fetch(`/api/drafts/${draftId}/snapshot`, {
        method: "POST"
      });

      router.push(`/applications/${draftId}/preview`);
    });
  }

  return (
    <button
      className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      disabled={isPending}
      onClick={generateSnapshot}
      type="button"
    >
      Generate Snapshot
    </button>
  );
}
