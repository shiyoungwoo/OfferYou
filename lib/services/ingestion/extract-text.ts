import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCommand } from "@/lib/services/ingestion/command-runner";

type UploadTextInput = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
};

export type UploadedTextExtraction = {
  extractedText: string;
  extractionState: "full_text" | "partial_text" | "stored_only";
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
          extractedText,
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
          extractedText,
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
      extractedText: input.buffer.toString("utf8").trim(),
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
        extractedText: fallbackText,
        extractionState: "partial_text"
      };
    }

    return {
      extractedText: "",
      extractionState: "stored_only"
    };
  }

  const openDataLoaderExtraction = await extractPdfTextWithOpenDataLoader(buffer, filename);
  if (openDataLoaderExtraction && !isGibberish(openDataLoaderExtraction.extractedText)) {
    return openDataLoaderExtraction;
  }

  try {
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
    const data = await pdfParse(buffer);
    const text = data.text?.trim();
    if (text && text.length > 20 && !isGibberish(text)) {
      if (process.env.OFFERYOU_DEBUG_INGESTION === "1") {
        console.log(`[OfferYou] pdf-parse extracted ${text.length} chars from ${data.numpages} pages`);
      }
      return {
        extractedText: text,
        extractionState: "full_text"
      };
    }
  } catch (error) {
    console.error("[OfferYou] pdf-parse failed:", error);
  }

  const fallbackText = extractPdfTextRawFallback(buffer);
  if (fallbackText && !isGibberish(fallbackText)) {
    return {
      extractedText: fallbackText,
      extractionState: "partial_text"
    };
  }

  return {
    extractedText: "",
    extractionState: "stored_only"
  };
}

async function extractPdfTextWithOpenDataLoader(buffer: Buffer, filename: string): Promise<UploadedTextExtraction | null> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-opendataloader-"));
  const inputPath = path.join(tempDir, path.basename(filename || "document.pdf"));
  const outputDir = path.join(tempDir, "output");
  const venvPath = path.join(process.cwd(), ".venv", "bin", "opendataloader-pdf");

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

    await runCommand(venvPath, args, {
      timeout: 120_000, // Hybrid mode might need more time
      maxBuffer: 10 * 1024 * 1024
    });

    const extractedFile = await findFirstTextOutputFile(outputDir);
    if (!extractedFile) {
      return null;
    }

    const extractedText = (await readFile(extractedFile, "utf-8")).trim();
    if (!extractedText) {
      return null;
    }

    return {
      extractedText,
      extractionState: extractedText.length > 20 ? "full_text" : "partial_text"
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
