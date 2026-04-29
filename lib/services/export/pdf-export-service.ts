import path from "node:path";
import { chromium } from "@playwright/test";
import { LocalStorageAdapter } from "@/lib/storage/local-storage-adapter";

type RenderPdfInput = {
  userId: string;
  draftId: string;
  html: string;
  filename?: string;
};

const A4_PAGE_HEIGHT_PX = 1123;
const A4_PAGE_WIDTH_PX = 794;

async function createResumePdfPage(html: string) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch({ headless: true, timeout: 10_000 });
    const page = await browser.newPage({
      viewport: { width: A4_PAGE_WIDTH_PX, height: A4_PAGE_HEIGHT_PX }
    });
    page.setDefaultTimeout(10_000);

    await page.emulateMedia({ media: "print" });
    await page.setContent(html, { waitUntil: "load", timeout: 10_000 });

    return { browser, page };
  } catch (error) {
    await browser?.close().catch(() => undefined);
    throw error;
  }
}

async function measurePageCountFromPage(page: Awaited<ReturnType<typeof createResumePdfPage>>["page"]) {
  return page.evaluate(({ pageHeight }) => {
    const article = document.querySelector("article") as HTMLElement | null;
    const shell = document.querySelector(".print-shell") as HTMLElement | null;
    const bodyHeight = document.documentElement.scrollHeight;
    const articleHeight = article?.getBoundingClientRect().height ?? 0;
    const shellHeight = shell?.getBoundingClientRect().height ?? 0;
    const totalHeight = Math.max(bodyHeight, articleHeight, shellHeight, pageHeight);
    return Math.max(1, Math.ceil(totalHeight / pageHeight));
  }, { pageHeight: A4_PAGE_HEIGHT_PX });
}

export async function measureResumeHtmlPageCount(html: string) {
  const { browser, page } = await createResumePdfPage(html);

  try {
    return await measurePageCountFromPage(page);
  } finally {
    await browser.close();
  }
}

export async function renderPdfFromHtml(input: RenderPdfInput) {
  const { browser, page } = await createResumePdfPage(input.html);

  try {
    const pageCount = await measurePageCountFromPage(page);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0"
      }
    });

    const storage = new LocalStorageAdapter(path.join(process.cwd(), "storage"));
    const stored = await storage.put({
      userId: input.userId,
      kind: "export_pdf",
      filename: input.filename ?? `${input.draftId}.pdf`,
      buffer: Buffer.from(pdfBuffer),
      mimeType: "application/pdf"
    });

    return {
      assetType: "export_pdf" as const,
      pageCount,
      ...stored
    };
  } finally {
    await browser.close();
  }
}
