import path from "node:path";
import { chromium } from "playwright";
import { LocalStorageAdapter } from "@/lib/storage/local-storage-adapter";

type RenderPdfInput = {
  userId: string;
  draftId: string;
  html: string;
};

export async function renderPdfFromHtml(input: RenderPdfInput) {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(input.html, { waitUntil: "load" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "12mm",
        right: "10mm",
        bottom: "12mm",
        left: "10mm"
      }
    });

    const storage = new LocalStorageAdapter(path.join(process.cwd(), "storage"));
    const stored = await storage.put({
      userId: input.userId,
      kind: "export_pdf",
      filename: `${input.draftId}.pdf`,
      buffer: Buffer.from(pdfBuffer),
      mimeType: "application/pdf"
    });

    return {
      assetType: "export_pdf" as const,
      ...stored
    };
  } finally {
    await browser.close();
  }
}
