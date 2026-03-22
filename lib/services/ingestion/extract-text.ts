import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

  if (input.rawReference) {
    return `Extracted placeholder text from ${input.rawReference}`;
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

export function extractTextFromUploadedBuffer(input: UploadTextInput): UploadedTextExtraction {
  const normalizedMimeType = input.mimeType.toLowerCase();
  const filename = input.filename.toLowerCase();

  if (normalizedMimeType.startsWith("text/") || filename.endsWith(".txt") || filename.endsWith(".md")) {
    return {
      extractedText: input.buffer.toString("utf8").trim(),
      extractionState: "full_text"
    };
  }

  if (normalizedMimeType === "application/pdf" || filename.endsWith(".pdf")) {
    const extractedText = extractPdfText(input.buffer);

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

  return {
    extractedText: "",
    extractionState: "stored_only"
  };
}

async function extractWordText(assetPath: string) {
  try {
    const { stdout } = await execFileAsync("/usr/bin/textutil", ["-convert", "txt", "-stdout", assetPath]);
    return stdout.trim();
  } catch {
    return "";
  }
}

async function extractImageText(assetPath: string) {
  try {
    const scriptPath = path.join(process.cwd(), "scripts", "ocr_image.swift");
    const { stdout } = await execFileAsync("/usr/bin/swift", [scriptPath, assetPath]);
    return stdout.trim();
  } catch {
    return "";
  }
}

function extractPdfText(buffer: Buffer) {
  const latin1 = buffer.toString("latin1");
  const fragments: string[] = [];
  const matches = latin1.matchAll(/\(([^()]*)\)\s*Tj/g);

  for (const match of matches) {
    const decoded = decodePdfTextFragment(match[1]);
    if (decoded.length >= 3) {
      fragments.push(decoded);
    }
  }

  if (fragments.length === 0) {
    const fallback = latin1
      .replace(/[^\x20-\x7E]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4)
      .slice(0, 120);

    return fallback.join(" ").trim();
  }

  return fragments.join(" ").replace(/\s+/g, " ").trim();
}

function decodePdfTextFragment(fragment: string) {
  return fragment
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\\/g, "\\")
    .replace(/\\([0-7]{3})/g, (_match, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)))
    .replace(/\s+/g, " ")
    .trim();
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
