import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { runCommand } from "@/lib/services/ingestion/command-runner";
import { normalizeOcrResumeText } from "@/lib/services/analysis/text-cleaner";
import { callModelJSON } from "@/lib/ai/model-gateway";
import type { TextItem } from "@llamaindex/liteparse";

type UploadTextInput = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
};

export type UploadedTextExtraction = {
  extractedText: string;
  extractionState: "full_text" | "partial_text" | "stored_only";
  extractionEngine?: PdfExtractionEngine;
  parseQualityReview?: ResumeParseQualityReview;
};

type PdfExtractionEngine = "liteparse" | "opendataloader" | "pdf_parse" | "raw_fallback";

export type ResumeParseQualityReview = {
  status: "pass" | "needs_review" | "fail";
  completeness: "high" | "medium" | "low";
  detectedSections: Array<"personal_info" | "summary" | "work" | "project" | "education" | "credential">;
  missingCriticalSections: string[];
  suspectedMisplacements: string[];
  evidence: string[];
  nextAction: "continue_to_calibration" | "ask_user_confirm" | "try_alternative_parser" | "ask_user_upload_text";
  reviewedBy: "model" | "hard_signal";
  fallbackReason?: string;
};

type PdfExtractionCandidate = {
  engine: PdfExtractionEngine;
  text: string;
  textItems?: TextItem[];
  pageCount?: number;
};

export async function extractTextFromResumeSource(input: { content?: string; rawReference?: string }) {
  if (input.content) {
    return input.content;
  }

  if (input.rawReference?.startsWith("/")) {
    const extraction = await extractTextFromStoredAsset({
      assetPath: input.rawReference,
      mimeType: inferMimeTypeFromFilename(input.rawReference),
      filename: input.rawReference
    });

    if (extraction.extractedText.trim()) {
      return extraction.extractedText;
    }
  }

  return "";
}

export async function extractTextFromStoredAsset(input: {
  assetPath: string;
  mimeType: string;
  filename: string;
}): Promise<UploadedTextExtraction> {
  const normalizedMimeType = input.mimeType.toLowerCase();
  const filename = input.filename.toLowerCase();

  if (isWordDocument(normalizedMimeType, filename)) {
    const extractedText = await extractWordText(input.assetPath);

    return extractedText
      ? {
          extractedText: normalizeOcrResumeText(extractedText),
          extractionState: "full_text"
        }
      : {
          extractedText: "",
          extractionState: "stored_only"
      };
  }

  if (isImageFile(normalizedMimeType, filename)) {
    const extractedText = await extractImageText(input.assetPath);

    return extractedText
      ? {
          extractedText: normalizeOcrResumeText(extractedText),
          extractionState: "partial_text"
        }
      : {
          extractedText: "",
          extractionState: "stored_only"
        };
  }

  const buffer = await readFile(input.assetPath);
  return extractTextFromUploadedBuffer({
    buffer,
    mimeType: input.mimeType,
    filename: input.filename
  });
}

export async function extractTextFromUploadedBuffer(input: UploadTextInput): Promise<UploadedTextExtraction> {
  const normalizedMimeType = input.mimeType.toLowerCase();
  const filename = input.filename.toLowerCase();

  if (normalizedMimeType.startsWith("text/") || filename.endsWith(".txt") || filename.endsWith(".md")) {
    return {
      extractedText: normalizeOcrResumeText(input.buffer.toString("utf8")),
      extractionState: "full_text"
    };
  }

  if (normalizedMimeType === "application/pdf" || filename.endsWith(".pdf")) {
    return extractPdfTextFromBuffer(input.buffer, input.filename);
  }

  return {
    extractedText: "",
    extractionState: "stored_only"
  };
}

async function extractWordText(assetPath: string) {
  try {
    const { stdout } = await runCommand("/usr/bin/textutil", ["-convert", "txt", "-stdout", assetPath]);
    return stdout.trim();
  } catch {
    return "";
  }
}

async function extractImageText(assetPath: string) {
  try {
    const scriptPath = path.join(process.cwd(), "scripts", "ocr_image.swift");
    const { stdout } = await runCommand("/usr/bin/swift", [scriptPath, assetPath]);
    return stdout.trim();
  } catch {
    return "";
  }
}

function isGibberish(text: string): boolean {
  if (text.length < 50) return false;
  // Many PDF CID font mapping errors output Cyrillic or special characters
  const cyrillicCount = (text.match(/[\u0400-\u04FF]/g) || []).length;
  if (cyrillicCount > 10) return true;

  // Normal text should have a reasonable amount of CJK or Latin characters
  const validCount = (text.match(/[\u4e00-\u9fa5a-zA-Z0-9]/g) || []).length;
  if (validCount < text.length * 0.2) return true;

  return false;
}

async function extractPdfTextFromBuffer(buffer: Buffer, filename: string): Promise<UploadedTextExtraction> {
  if (!isLikelyCompletePdfBuffer(buffer)) {
    const fallbackText = extractPdfTextRawFallback(buffer);
    if (fallbackText && !isGibberish(fallbackText)) {
      return {
        extractedText: normalizeOcrResumeText(fallbackText),
        extractionState: "partial_text",
        extractionEngine: "raw_fallback"
      };
    }

    return {
      extractedText: "",
      extractionState: "stored_only",
      extractionEngine: "raw_fallback"
    };
  }

  const liteParseCandidate = await extractPdfTextWithLiteParse(buffer);
  if (liteParseCandidate) {
    const review = await reviewPdfExtractionCandidate(liteParseCandidate);
    if (review.status === "pass") {
      return {
        extractedText: normalizeOcrResumeText(liteParseCandidate.text),
        extractionState: "full_text",
        extractionEngine: "liteparse",
        parseQualityReview: review
      };
    }

    if (process.env.OFFERYOU_DEBUG_INGESTION === "1") {
      console.error(`[OfferYou] LiteParse quality review requested fallback: ${review.nextAction}`, review.evidence);
    }
  }

  const openDataLoaderExtraction = await extractPdfTextWithOpenDataLoader(buffer, filename);
  if (openDataLoaderExtraction && !isGibberish(openDataLoaderExtraction.text)) {
    const review = await reviewPdfExtractionCandidate(openDataLoaderExtraction);
    if (review.status === "pass" || review.nextAction === "ask_user_confirm") {
      return {
        extractedText: normalizeOcrResumeText(openDataLoaderExtraction.text),
        extractionState: review.status === "pass" ? "full_text" : "partial_text",
        extractionEngine: "opendataloader",
        parseQualityReview: review
      };
    }
  }

  try {
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
    const data = await pdfParse(buffer);
    const text = data.text?.trim();
    if (text && text.length > 20 && !isGibberish(text)) {
      const candidate: PdfExtractionCandidate = {
        engine: "pdf_parse",
        text,
        pageCount: data.numpages
      };
      const review = await reviewPdfExtractionCandidate(candidate);
      if (process.env.OFFERYOU_DEBUG_INGESTION === "1") {
        console.log(`[OfferYou] pdf-parse extracted ${text.length} chars from ${data.numpages} pages`);
      }
      if (review.status === "pass" || review.nextAction === "ask_user_confirm") {
        return {
          extractedText: normalizeOcrResumeText(text),
          extractionState: review.status === "pass" ? "full_text" : "partial_text",
          extractionEngine: "pdf_parse",
          parseQualityReview: review
        };
      }
    }
  } catch (error) {
    console.error("[OfferYou] pdf-parse failed:", error);
  }

  const fallbackText = extractPdfTextRawFallback(buffer);
  if (fallbackText && !isGibberish(fallbackText)) {
    return {
      extractedText: normalizeOcrResumeText(fallbackText),
      extractionState: "partial_text",
      extractionEngine: "raw_fallback"
    };
  }

  return {
    extractedText: "",
    extractionState: "stored_only",
    extractionEngine: "raw_fallback"
  };
}

async function extractPdfTextWithLiteParse(buffer: Buffer): Promise<PdfExtractionCandidate | null> {
  try {
    const { LiteParse } = await import("@llamaindex/liteparse");
    const parser = new LiteParse({
      ocrEnabled: false,
      quiet: true,
      outputFormat: "json"
    });
    const result = await parser.parse(buffer);
    const text = result.text?.trim();

    if (!text || text.length < 20 || isGibberish(text)) {
      return null;
    }

    return {
      engine: "liteparse",
      text,
      pageCount: result.pages.length,
      textItems: result.pages.flatMap((page) => page.textItems)
    };
  } catch (error) {
    if (process.env.OFFERYOU_DEBUG_INGESTION === "1") {
      console.error("[OfferYou] LiteParse failed:", error);
    }
    return null;
  }
}

async function extractPdfTextWithOpenDataLoader(buffer: Buffer, filename: string): Promise<PdfExtractionCandidate | null> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-opendataloader-"));
  const inputPath = path.join(tempDir, path.basename(filename || "document.pdf"));
  const outputDir = path.join(tempDir, "output");
  const cliPath = resolveOpenDataLoaderCliPath();

  if (!cliPath) {
    if (process.env.OFFERYOU_DEBUG_INGESTION === "1") {
      console.error("[OfferYou] OpenDataLoader CLI is unavailable.");
    }
    return null;
  }

  try {
    await mkdir(outputDir, { recursive: true });
    await writeFile(inputPath, buffer);

    // Default to Fast Mode (Java), but allow Hybrid if configured
    const args = [
      inputPath,
      "--output-dir", outputDir,
      "--format", "markdown,text",
      "--use-struct-tree",
      "--quiet"
    ];

    // If you want to enable hybrid mode for higher accuracy (needs backend server running)
    if (process.env.OFFERYOU_PDF_HYBRID === "1") {
      args.push("--hybrid", "docling-fast");
      args.push("--hybrid-url", process.env.OFFERYOU_PDF_HYBRID_URL || "http://localhost:5002");
      args.push("--hybrid-fallback");
    }

    await runCommand(cliPath, args, {
      timeout: 120_000, // Hybrid mode might need more time
      maxBuffer: 10 * 1024 * 1024
    });

    const extractedFile = await findFirstTextOutputFile(outputDir);
    if (!extractedFile) {
      return null;
    }

    const extractedText = normalizeOcrResumeText(await readFile(extractedFile, "utf-8"));
    if (!extractedText) {
      return null;
    }

    return {
      engine: "opendataloader",
      text: extractedText
    };
  } catch (error) {
    if (process.env.OFFERYOU_DEBUG_INGESTION === "1") {
      console.error("[OfferYou] OpenDataLoader failed:", error);
    }
    return null;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function reviewPdfExtractionCandidate(candidate: PdfExtractionCandidate): Promise<ResumeParseQualityReview> {
  const hardSignals = buildParseHardSignals(candidate);
  if (hardSignals.mustReject) {
    return {
      status: "fail",
      completeness: "low",
      detectedSections: hardSignals.detectedSections,
      missingCriticalSections: hardSignals.missingCriticalSections,
      suspectedMisplacements: hardSignals.suspectedMisplacements,
      evidence: hardSignals.evidence,
      nextAction: candidate.engine === "raw_fallback" ? "ask_user_upload_text" : "try_alternative_parser",
      reviewedBy: "hard_signal"
    };
  }

  const result = await callModelJSON<Omit<ResumeParseQualityReview, "reviewedBy" | "fallbackReason">>({
    task: "resume_calibration",
    systemPrompt: buildParseQualityReviewSystemPrompt(),
    userPrompt: buildParseQualityReviewUserPrompt(candidate, hardSignals),
    fallbackFactory: () => null
  });

  const modelReview = normalizeModelParseQualityReview(result.data);

  if (!modelReview) {
    return {
      status: "needs_review",
      completeness: "medium",
      detectedSections: hardSignals.detectedSections,
      missingCriticalSections: hardSignals.missingCriticalSections,
      suspectedMisplacements: hardSignals.suspectedMisplacements,
      evidence: [
        ...hardSignals.evidence,
        result.fallbackReason ?? "模型不可用或返回结构无效，无法确认解析质量。"
      ],
      nextAction: candidate.engine === "liteparse" ? "try_alternative_parser" : "ask_user_confirm",
      reviewedBy: "hard_signal",
      fallbackReason: result.fallbackReason ?? "模型不可用或返回结构无效，无法确认解析质量。"
    };
  }

  return {
    ...modelReview,
    reviewedBy: "model",
    fallbackReason: result.fallbackReason
  };
}

export function buildParseHardSignals(candidate: PdfExtractionCandidate) {
  const text = normalizeOcrResumeText(candidate.text);
  const sections = {
    personal_info: /1[3-9]\d{9}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu.test(text),
    summary: /(个人优势|自我评价|个人总结|优势|profile|summary)/iu.test(text),
    work: /(工作经历|实习经历|任职|公司|银行|科技|有限公司|岗位)/iu.test(text),
    project: /(项目经历|项目经验|项目名称|项目|产品|系统|平台)/iu.test(text),
    education: /(教育背景|教育经历|本科|硕士|博士|大学|学院|专业)/iu.test(text),
    credential: /(CET|英语|六级|四级|雅思|托福|证书|资格|技能)/iu.test(text)
  };
  const detectedSections = Object.entries(sections)
    .filter(([, matched]) => matched)
    .map(([section]) => section) as ResumeParseQualityReview["detectedSections"];
  const missingCriticalSections = ["personal_info", "education"].filter((section) => !sections[section as keyof typeof sections]);
  const lineCount = text.split(/\n/).filter((line) => line.trim()).length;
  const evidence = [
    `解析引擎：${candidate.engine}`,
    `文本长度：${text.length}`,
    `有效行数：${lineCount}`,
    candidate.pageCount ? `页数：${candidate.pageCount}` : "",
    candidate.textItems ? `坐标文本块：${candidate.textItems.length}` : "",
    `检测到模块：${detectedSections.join("、") || "无"}`
  ].filter(Boolean);
  const suspectedMisplacements: string[] = [];

  if (/(教育背景|本科|硕士|大学).{0,80}(工作经历|项目经历)|(?:工作经历|项目经历).{0,80}(本科|硕士|大学)/u.test(text)) {
    suspectedMisplacements.push("教育背景与工作/项目经历疑似粘连。");
  }

  return {
    textLength: text.length,
    lineCount,
    detectedSections,
    missingCriticalSections,
    suspectedMisplacements,
    evidence,
    mustReject: text.length < 80 || isGibberish(text)
  };
}

function buildParseQualityReviewSystemPrompt() {
  return `你是 OfferYou 的简历 PDF 解析质量评审器。
目标：判断 PDF 工具提取出的文本是否足够进入简历结构校准。
注意：
1. 规则信号只能作为证据，最终质量判断由你做。
2. 不要求简历必须包含所有模块；不同用户简历结构可能不同。
3. 重点判断是否出现关键信息丢失、模块粘连、教育/证书流入工作经历、项目与工作经历串位、明显乱码。
4. 如果文本大体可读但存在疑点，返回 needs_review，而不是 pass。
5. 如果需要换解析器，nextAction 选 try_alternative_parser。
只返回 JSON。`;
}

function buildParseQualityReviewUserPrompt(candidate: PdfExtractionCandidate, hardSignals: ReturnType<typeof buildParseHardSignals>) {
  return JSON.stringify(
    {
      requiredSchema: {
        status: "pass | needs_review | fail",
        completeness: "high | medium | low",
        detectedSections: ["personal_info", "summary", "work", "project", "education", "credential"],
        missingCriticalSections: ["string"],
        suspectedMisplacements: ["string"],
        evidence: ["string"],
        nextAction: "continue_to_calibration | ask_user_confirm | try_alternative_parser | ask_user_upload_text"
      },
      parser: candidate.engine,
      hardSignals,
      textPreview: normalizeOcrResumeText(candidate.text).slice(0, 6000)
    },
    null,
    2
  );
}

function normalizeModelParseQualityReview(data: unknown): Omit<ResumeParseQualityReview, "reviewedBy" | "fallbackReason"> | null {
  if (!isRecord(data)) return null;

  const status = data.status;
  const completeness = data.completeness;
  const nextAction = data.nextAction;

  if (status !== "pass" && status !== "needs_review" && status !== "fail") return null;
  if (completeness !== "high" && completeness !== "medium" && completeness !== "low") return null;
  if (
    nextAction !== "continue_to_calibration" &&
    nextAction !== "ask_user_confirm" &&
    nextAction !== "try_alternative_parser" &&
    nextAction !== "ask_user_upload_text"
  ) {
    return null;
  }

  return {
    status,
    completeness,
    detectedSections: normalizeDetectedSections(data.detectedSections),
    missingCriticalSections: normalizeStringArray(data.missingCriticalSections),
    suspectedMisplacements: normalizeStringArray(data.suspectedMisplacements),
    evidence: normalizeStringArray(data.evidence),
    nextAction
  };
}

function normalizeDetectedSections(value: unknown): ResumeParseQualityReview["detectedSections"] {
  const allowed = new Set(["personal_info", "summary", "work", "project", "education", "credential"]);
  return normalizeStringArray(value).filter((section) => allowed.has(section)) as ResumeParseQualityReview["detectedSections"];
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveOpenDataLoaderCliPath() {
  const candidates = [
    process.env.OFFERYOU_OPENDATALOADER_PDF,
    path.join(process.cwd(), ".venv", "bin", "opendataloader-pdf"),
    "opendataloader-pdf"
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (candidate === "opendataloader-pdf" || existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function findFirstTextOutputFile(rootDir: string): Promise<string | null> {
  const queue = [rootDir];

  while (queue.length > 0) {
    const currentDir = queue.shift();
    if (!currentDir) {
      continue;
    }

    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }

      if (entry.isFile() && isExtractedTextFile(entry.name)) {
        return absolutePath;
      }
    }
  }

  return null;
}

function isExtractedTextFile(filename: string) {
  const normalized = filename.toLowerCase();
  return normalized.endsWith(".md") || normalized.endsWith(".markdown") || normalized.endsWith(".txt");
}

function isLikelyCompletePdfBuffer(buffer: Buffer): boolean {
  const head = buffer.subarray(0, Math.min(buffer.length, 2048)).toString("latin1");
  const tail = buffer.subarray(Math.max(0, buffer.length - 8192)).toString("latin1");

  return head.includes("%PDF-") && tail.includes("%%EOF");
}

function extractPdfTextRawFallback(buffer: Buffer): string {
  const latin1 = buffer.toString("latin1");
  const fragments: string[] = [];
  const matches = latin1.matchAll(/\(([^()]*)\)\s*Tj/g);

  for (const match of matches) {
    const decoded = match[1]
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\n/g, " ")
      .replace(/\\r/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\\\\/g, "\\")
      .replace(/\\([0-7]{3})/g, (_m, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)))
      .replace(/\s+/g, " ")
      .trim();
    if (decoded.length >= 3) {
      fragments.push(decoded);
    }
  }

  return fragments.join(" ").replace(/\s+/g, " ").trim();
}

function inferMimeTypeFromFilename(filename: string) {
  const normalized = filename.toLowerCase();

  if (normalized.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (normalized.endsWith(".md")) {
    return "text/markdown";
  }

  if (normalized.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  if (normalized.endsWith(".doc")) {
    return "application/msword";
  }

  return "text/plain";
}

function isWordDocument(mimeType: string, filename: string) {
  return (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    filename.endsWith(".docx") ||
    filename.endsWith(".doc")
  );
}

function isImageFile(mimeType: string, filename: string) {
  return (
    mimeType.startsWith("image/") ||
    filename.endsWith(".png") ||
    filename.endsWith(".jpg") ||
    filename.endsWith(".jpeg") ||
    filename.endsWith(".webp")
  );
}
