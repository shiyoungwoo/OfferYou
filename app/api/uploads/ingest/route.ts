import path from "node:path";
import { NextResponse } from "next/server";
import { getDefaultUserContext } from "@/lib/default-user";
import { extractTextFromStoredAsset } from "@/lib/services/ingestion/extract-text";
import { LocalStorageAdapter } from "@/lib/storage/local-storage-adapter";
import type { StorageAssetKind } from "@/lib/storage/storage-adapter";

const storageAdapter = new LocalStorageAdapter(path.join(process.cwd(), "storage"));

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const rawKind = String(formData.get("kind") ?? "other");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const kind = normalizeKind(rawKind);
  const { userId } = getDefaultUserContext();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const stored = await storageAdapter.put({
    userId,
    kind,
    filename: file.name,
    buffer,
    mimeType: file.type || "application/octet-stream"
  });

  const extraction = await extractTextFromStoredAsset({
    assetPath: stored.storagePath,
    mimeType: stored.mimeType,
    filename: stored.originalFilename
  });

  return NextResponse.json({
    assetRef: stored.storagePath,
    filename: stored.originalFilename,
    mimeType: stored.mimeType,
    extractedText: extraction.extractedText,
    extractionState: extraction.extractionState
  });
}

function normalizeKind(value: string): StorageAssetKind {
  if (value === "resume_source" || value === "jd_source" || value === "profile_photo") {
    return value;
  }

  return "other";
}
