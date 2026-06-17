import { NextResponse } from "next/server";
import { getDefaultUserContext } from "@/lib/default-user";
import { getStorageRoot } from "@/lib/runtime/storage-root";
import { extractTextFromStoredAsset } from "@/lib/services/ingestion/extract-text";
import { LocalStorageAdapter } from "@/lib/storage/local-storage-adapter";
import type { StorageAssetKind } from "@/lib/storage/storage-adapter";
import { callModelJSON } from "@/lib/ai/model-gateway";
import { isAllowedUploadType } from "@/lib/services/ingestion/upload-type";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
function getStorageAdapter() { return new LocalStorageAdapter(getStorageRoot()); }

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  // Support JSON body for text-only extraction (no file upload)
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { text?: string; kind?: string };
    const text = (body.text ?? "").slice(0, 200_000); // 上限 ~200KB 文本
    const kind = body.kind ?? "jd_source";

    if (kind === "jd_source" && text.length >= 10) {
      try {
        const response = await callModelJSON<{ company: string; jobTitle: string }>({
          systemPrompt: `You extract the company name and job title from a Job Description (JD).
The input may contain OCR artifacts, garbled characters, random symbols (like #, $, %, |, ~), line number prefixes, or fragmented text from poor scanning/copying.
Your job:
1. First mentally clean/denoise the text — ignore random symbols, line noise, and OCR garbage.
2. Identify the real company name and job title from the meaningful Chinese/English words that remain.
3. If the text is too corrupted to confidently extract, return empty strings.
Return a JSON object with strictly two string fields: 'company' and 'jobTitle'.`,
          userPrompt: text.slice(0, 5000),
          fallbackFactory: () => ({ company: "", jobTitle: "" })
        });
        if (response.data) {
          return NextResponse.json({
            assetRef: "",
            extractedText: text,
            extractionState: "full_text",
            company: response.data.company || "",
            jobTitle: response.data.jobTitle || ""
          });
        }
      } catch (error) {
        console.error("[Ingest] Failed to extract company/jobTitle from text:", error);
      }
    }

    return NextResponse.json({ assetRef: "", extractedText: text, extractionState: "full_text", company: "", jobTitle: "" });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const rawKind = String(formData.get("kind") ?? "other");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请上传文件。" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "文件大小超过 10MB 限制。" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";

  if (!isAllowedUploadType(file.name, mimeType)) {
    return NextResponse.json({ error: "不支持的文件类型，请上传 PDF、DOCX、TXT 或图片文件。" }, { status: 400 });
  }

  const kind = normalizeKind(rawKind);
  const { userId } = getDefaultUserContext();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const stored = await getStorageAdapter().put({
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

  let company = "";
  let jobTitle = "";

  if (kind === "jd_source" && extraction.extractedText) {
    try {
      const response = await callModelJSON<{ company: string; jobTitle: string }>({
        systemPrompt: `You extract the company name and job title from a Job Description (JD).
The input may contain OCR artifacts, garbled characters, random symbols (like #, $, %, |, ~), line number prefixes, or fragmented text from poor scanning/copying.
Your job:
1. First mentally clean/denoise the text — ignore random symbols, line noise, and OCR garbage.
2. Identify the real company name and job title from the meaningful Chinese/English words that remain.
3. If the text is too corrupted to confidently extract, return empty strings.
Return a JSON object with strictly two string fields: 'company' and 'jobTitle'.`,
        userPrompt: extraction.extractedText.slice(0, 5000),
        fallbackFactory: () => ({ company: "", jobTitle: "" })
      });
      if (response.data) {
        company = response.data.company || "";
        jobTitle = response.data.jobTitle || "";
      }
    } catch (error) {
      console.error("[Ingest] Failed to extract company/jobTitle from JD:", error);
    }
  }

  return NextResponse.json({
    assetRef: stored.storagePath,
    filename: stored.originalFilename,
    mimeType: stored.mimeType,
    extractedText: extraction.extractedText,
    extractionState: extraction.extractionState,
    company,
    jobTitle
  });
}

function normalizeKind(value: string): StorageAssetKind {
  if (value === "resume_source" || value === "jd_source" || value === "profile_photo") {
    return value;
  }

  return "other";
}
