import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { composeSnapshotDocument } from "@/lib/services/snapshot/snapshot-composer";
import { readWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import type { ResumeDocument } from "@/lib/document/resume-document";

function getSnapshotPath(draftId: string) {
  return path.join(process.cwd(), "storage", "snapshots", `${draftId}.json`);
}

export async function generateSnapshotForDraft(draftId: string) {
  const draft = await readWorkspaceDraft(draftId);

  if (!draft) {
    throw new Error("Draft not found.");
  }

  const document = composeSnapshotDocument(draft);
  const snapshotPath = getSnapshotPath(draftId);

  await mkdir(path.dirname(snapshotPath), { recursive: true });
  await writeFile(snapshotPath, JSON.stringify(document, null, 2), "utf8");

  return {
    draftId,
    templateKey: document.templateKey,
    snapshotPath,
    pageEstimate: Math.max(1, Math.ceil(document.sections.reduce((sum, section) => sum + section.items.length, 0) / 6)),
    document
  };
}

export async function readSnapshotForDraft(draftId: string): Promise<ResumeDocument | null> {
  try {
    const contents = await readFile(getSnapshotPath(draftId), "utf8");
    return JSON.parse(contents) as ResumeDocument;
  } catch {
    return null;
  }
}
