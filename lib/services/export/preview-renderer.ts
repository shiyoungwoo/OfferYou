import { normalizeResumeTemplateKey, type ResumeDocument, type ResumeDocumentSection } from "@/lib/document/resume-document";

const MAX_ITEMS_PER_PAGE = 14;
const PDF_FILENAME_FORBIDDEN_CHARS = /[\/\\:*?"<>|]/g;

export function paginateDocument(document: ResumeDocument): ResumeDocument[] {
  const sections = getContentSections(getRenderableSections(document.sections));

  if (sections.length === 0) {
    return [document];
  }

  const pages: ResumeDocument[] = [];
  let currentSections: ResumeDocument["sections"] = [];
  let currentCount = 0;

  for (const section of sections) {
    const sectionCount = Math.max(section.items.length, 1);

    if (currentSections.length > 0 && currentCount + sectionCount > MAX_ITEMS_PER_PAGE) {
      pages.push({
        ...document,
        sections: currentSections
      });
      currentSections = [];
      currentCount = 0;
    }

    currentSections.push(section);
    currentCount += sectionCount;
  }

  if (currentSections.length > 0) {
    pages.push({
      ...document,
      sections: currentSections
    });
  }

  return pages.length > 0 ? pages : [document];
}

export function estimateResumePageCount(document: ResumeDocument) {
  return paginateDocument(document).length;
}

export function getResumePageWaterLabel(pageCount: number) {
  if (pageCount <= 1) {
    return "一页版，适合投递";
  }

  if (pageCount === 2) {
    return "两页版本，建议保留重点";
  }

  return "建议删减后再导出";
}

export function buildResumePdfFilename(document: ResumeDocument) {
  const safeName = sanitizeFilenamePart(document.header.name || "offeryou");
  const safeTitle = sanitizeFilenamePart(document.header.title || "resume");
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  return `${safeName}-${safeTitle}-可投递版-${dateStamp}.pdf`;
}

export function renderResumeDocumentHtml(document: ResumeDocument) {
  const templateKey = normalizeResumeTemplateKey(document.templateKey);
  return templateKey === "ats-clean" ? renderAtsCleanHtml(document) : renderProfessionalCnHtml(document);
}

function renderProfessionalCnHtml(document: ResumeDocument) {
  const renderableSections = getContentSections(getRenderableSections(document.sections));
  const headerInfo = getHeaderInfo(document);
  const sections = renderableSections.map((section) => renderSection(section)).join("");

  const body = `
      <article data-template-key="professional-cn">
        <header class="resume-header">
          <h2>${escapeHtml(document.header.name)}</h2>
          ${headerInfo.length > 0 ? `<div class="contact-bar">${headerInfo.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
          ${document.header.title ? `<div class="role">求职意向：${escapeHtml(document.header.title)}</div>` : ""}
        </header>
        <div class="resume-sections">${sections}</div>
      </article>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(document.header.name)}</title>
    <style>
      :root {
        --main-blue: #1E3A70;
        --text-dark: #1F2430;
        --text-gray: #5B6472;
        --divider-blue: #D9E2F2;
        color-scheme: light;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        margin: 0;
        background: #f3f6fb;
        color: var(--text-dark);
        font-family: "Source Han Sans SC", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
        font-size: 10pt;
      }
      .print-shell {
        padding: 24px 16px;
      }
      article {
        width: 794px;
        min-height: 1123px;
        margin: 0 auto;
        background: white;
        border: 1px solid #dce0e5;
        border-radius: 6px;
        padding: 28px 36px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
      }

      /* ── Header ── */
      .resume-header {
        padding-bottom: 7px;
        border-bottom: 2px solid var(--text-dark);
        margin-bottom: 10px;
        text-align: center;
      }
      h2 {
        font-size: 24pt;
        font-weight: 800;
        line-height: 1;
        color: var(--text-dark);
        letter-spacing: 0.08em;
      }
      .role {
        width: fit-content;
        margin: 8px auto 0 auto;
        padding: 0 30px 4px 30px;
        border-bottom: 2px solid var(--main-blue);
        font-size: 13pt;
        font-weight: 700;
        color: var(--main-blue);
      }
      .contact-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 0 8px;
        margin-top: 7px;
        font-size: 8.8pt;
        line-height: 1.3;
        color: var(--text-gray);
      }
      .contact-bar span {
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
      }
      .contact-bar span:not(:last-child)::after {
        content: "|";
        color: #CCC;
        margin-left: 8px;
        font-weight: 300;
      }
      /* ── Sections ── */
      .resume-sections {
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      section {
        break-inside: avoid;
        padding-bottom: 5px;
      }
      h3 {
        display: flex;
        align-items: center;
        font-size: 10.5pt;
        font-weight: 700;
        color: var(--main-blue);
        margin-bottom: 3px;
        padding-bottom: 2px;
        border-bottom: 1px solid var(--divider-blue);
      }
      h3::before {
        content: "";
        display: inline-block;
        width: 4px;
        height: 12px;
        background: var(--main-blue);
        margin-right: 5px;
        border-radius: 2px;
        flex-shrink: 0;
      }
      section ul {
        display: flex;
        flex-direction: column;
        gap: 4px;
        list-style: none;
      }

      /* ── Text items ── */
      .text-item {
        position: relative;
        padding-left: 12px;
        font-size: 9.2pt;
        line-height: 1.38;
        color: var(--text-dark);
      }
      .text-item::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0.62em;
        width: 4px;
        height: 4px;
        border-radius: 999px;
        background: var(--text-gray);
      }
      .text-item strong {
        color: var(--primary);
        font-weight: 700;
      }

      /* ── Entry items ── */
      .entry {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .entry-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .flex.items-baseline {
        display: flex;
        align-items: baseline;
      }
      .entry-title {
        font-size: 9.8pt;
        font-weight: 700;
        color: var(--text-dark);
      }
      .entry-subtitle {
        font-size: 8.9pt;
        color: var(--text-gray);
      }
      .entry-subtitle::before {
        content: " | ";
        color: #CCC;
        margin: 0 3px;
        font-weight: 300;
      }
      .entry-meta {
        flex-shrink: 0;
        font-size: 8.8pt;
        font-weight: 400;
        color: var(--text-gray);
        white-space: nowrap;
      }
      .entry-summary {
        font-size: 9.3pt;
        line-height: 1.35;
        color: var(--text-dark);
      }
      .entry-bullets {
        margin: 1px 0 0 0;
        padding-left: 14px;
        display: flex;
        flex-direction: column;
        gap: 1px;
        list-style: disc;
      }
      .entry-bullets li {
        font-size: 9.1pt;
        line-height: 1.32;
        color: var(--text-dark);
      }
      .entry-bullets li::marker {
        color: var(--text-gray);
        font-size: 8pt;
      }

      /* ── Print ── */
      @page {
        size: A4;
        margin: 0;
      }
      @media print {
        html, body {
          width: 210mm;
          min-height: 297mm;
          background: white;
          font-size: 9.5pt;
        }
        .print-shell { padding: 0; }
        article {
          width: 210mm;
          min-height: 297mm;
          margin: 0;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          padding: 10mm 13mm 10mm 13mm;
        }
      }
    </style>
  </head>
  <body>
    <div class="print-shell">${body}</div>
  </body>
</html>`;
}

function renderAtsCleanHtml(document: ResumeDocument) {
  const renderableSections = getContentSections(getRenderableSections(document.sections));
  const headerInfo = getHeaderInfo(document);
  const sections = renderableSections.map((section, index) => renderSection(section, index === 0 ? "first" : "standard")).join("");

  const body = `
      <article data-template-key="ats-clean">
        <header class="resume-header">
          <div class="identity-block">
            <h2>${escapeHtml(document.header.name)}</h2>
            ${document.header.title ? `<div class="role">${escapeHtml(document.header.title)}</div>` : ""}
          </div>
          ${
            headerInfo.length > 0
              ? `<div class="contact-grid">${headerInfo.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
              : ""
          }
        </header>
        <div class="resume-sections">${sections}</div>
      </article>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(document.header.name)}</title>
    <style>
      :root {
        --text-dark: #111827;
        --text-gray: #4B5563;
        --text-soft: #64748B;
        --divider: #CBD5E1;
        --divider-soft: #E2E8F0;
        color-scheme: light;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        margin: 0;
        background: #f8fafc;
        color: var(--text-dark);
        font-family: "Source Han Sans SC", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
        font-size: 10pt;
      }
      .print-shell {
        padding: 24px 16px;
      }
      article {
        width: 794px;
        min-height: 1123px;
        margin: 0 auto;
        background: white;
        border: 1px solid #dce0e5;
        border-radius: 6px;
        padding: 28px 34px;
        box-shadow: 0 8px 32px rgba(15, 23, 42, 0.08);
      }

      .resume-header {
        display: grid;
        grid-template-columns: minmax(190px, 0.45fr) minmax(500px, 1fr);
        gap: 24px;
        padding-bottom: 12px;
        border-bottom: 2px solid var(--text-dark);
        margin-bottom: 12px;
        text-align: left;
      }
      h2 {
        font-size: 29px;
        font-weight: 800;
        line-height: 1;
        color: var(--text-dark);
        letter-spacing: 0.04em;
      }
      .role {
        width: fit-content;
        margin-top: 16px;
        padding: 0 64px 4px 0;
        border-bottom: 1px solid var(--divider);
        font-size: 20px;
        font-weight: 700;
        line-height: 1.15;
        color: #334155;
      }
      .contact-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-content: start;
        justify-items: start;
        gap: 6px 20px;
        border-left: 1px solid var(--divider);
        padding-left: 20px;
        padding-top: 4px;
        font-size: 10px;
        line-height: 1.25;
        color: var(--text-gray);
        text-align: left;
      }
      .contact-grid span {
        max-width: 100%;
        white-space: nowrap;
      }

      .resume-sections {
        display: flex;
        flex-direction: column;
      }
      section {
        break-inside: avoid;
        padding: 6px 0;
      }
      section:not(.first) {
        border-top: 1px solid var(--divider-soft);
      }
      h3 {
        margin-bottom: 6px;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text-gray);
      }
      section ul {
        display: flex;
        flex-direction: column;
        gap: 4px;
        list-style: none;
      }
      .text-item {
        font-size: 12px;
        line-height: 1.5;
        color: #334155;
      }
      .text-item strong {
        color: #1e3a70;
        font-weight: 700;
      }
      .entry {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .entry-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }
      .flex.items-baseline {
        display: flex;
        align-items: baseline;
        gap: 6px;
        min-width: 0;
      }
      .entry-title {
        font-size: 13px;
        font-weight: 700;
        color: var(--text-dark);
      }
      .entry-subtitle {
        font-size: 11.5px;
        color: var(--text-soft);
      }
      .entry-subtitle::before {
        content: "｜ ";
        color: var(--divider);
      }
      .entry-meta {
        flex-shrink: 0;
        font-size: 11.5px;
        font-weight: 500;
        color: var(--text-soft);
        white-space: nowrap;
      }
      .entry-bullets {
        margin: 2px 0 0 0;
        padding-left: 14px;
        display: flex;
        flex-direction: column;
        gap: 1px;
        list-style: disc;
      }
      .entry-bullets li {
        font-size: 11.5px;
        line-height: 1.42;
        color: var(--text-gray);
      }
      .entry-bullets li::marker {
        color: #94A3B8;
        font-size: 8px;
      }

      @page {
        size: A4;
        margin: 0;
      }
      @media print {
        html, body {
          width: 210mm;
          min-height: 297mm;
          background: white;
        }
        .print-shell { padding: 0; }
        article {
          width: 210mm;
          min-height: 297mm;
          margin: 0;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          padding: 10mm 13mm 10mm 13mm;
        }
      }
    </style>
  </head>
  <body>
    <div class="print-shell">${body}</div>
  </body>
</html>`;
}

function renderSection(section: ResumeDocumentSection, className = "standard") {
  return `
    <section class="${className} ${section.tone ?? "standard"}">
      <h3>${escapeHtml(section.title)}</h3>
      <ul>
        ${section.items
          .map((item) =>
            item.type === "entry"
              ? `<li class="entry">
                  <div class="entry-head">
                    <div class="flex items-baseline">
                      <span class="entry-title">${escapeHtml(item.heading)}</span>
                      ${item.subheading ? `<span class="entry-subtitle">${escapeHtml(item.subheading)}</span>` : ""}
                    </div>
                    ${item.meta ? `<span class="entry-meta">${escapeHtml(item.meta)}</span>` : ""}
                  </div>
                  ${item.summary ? `<ul class="entry-bullets"><li>${escapeHtml(item.summary)}</li></ul>` : ""}
                  ${
                    item.bullets && item.bullets.length > 0
                      ? `<ul class="entry-bullets">${item.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
                      : ""
                  }
                </li>`
              : `<li class="text-item">${renderTextItem(item.text)}</li>`
          )
          .join("")}
      </ul>
    </section>`;
}

function renderTextItem(text: string) {
  const colonMatch = text.match(/^\s*([\u4e00-\u9fa5A-Za-z0-9＋+&/（）()·\s]{2,24})\s*[:：]\s*(.+)$/su);
  if (!colonMatch) {
    return escapeHtml(text);
  }

  const label = colonMatch[1].trim();
  const content = colonMatch[2].trim();
  return `<strong>${escapeHtml(label)}：</strong>${escapeHtml(content)}`;
}

export function getRenderableSections(sections: ResumeDocumentSection[]) {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isRenderableItem(item))
    }))
    .filter((section) => section.items.length > 0);
}

export function getContentSections(sections: ResumeDocumentSection[]) {
  return sections.filter((section) => section.id !== "personal-info");
}

export function getHeaderInfo(document: ResumeDocument) {
  const personalInfo = document.sections.find((section) => section.id === "personal-info");
  const lines =
    personalInfo?.items.flatMap((item) =>
      item.type === "text" ? splitPersonalInfoLine(item.text) : [joinHeaderEntry(item.heading, item.subheading)]
    ) ?? document.header.contacts ?? [];

  return dedupe(
    lines
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^姓名[：:]/u.test(line))
      .filter((line) => !/^求职意向[：:]/u.test(line))
      .filter((line) => !isEmptyHeaderInfoLine(line))
  ).slice(0, 7);
}

function splitPersonalInfoLine(text: string) {
  return text
    .split(/[｜|]/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinHeaderEntry(heading: string, subheading?: string) {
  return [heading, subheading].filter(Boolean).join("：");
}

function dedupe(values: string[]) {
  return Array.from(new Set(values));
}

function isEmptyHeaderInfoLine(line: string) {
  const normalized = line.replace(/\s+/g, "").toLowerCase();
  const value = normalized.includes("：") ? normalized.split("：").slice(1).join("：") : normalized;

  return (
    /未填写|待补|待填写|可选|暂无|无$|^-$/u.test(value) ||
    /^(github|git|作品集|居住地|所在地|邮箱|手机|电话|学历)：?(未填写|待补|待填写|可选|暂无|无|-)?$/u.test(normalized)
  );
}

function isRenderableItem(item: ResumeDocumentSection["items"][number]) {
  if (item.type === "entry") {
    return true;
  }

  return !isPlaceholderText(item.text);
}

function isPlaceholderText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return (
    normalized.startsWith("请补充") ||
    normalized.startsWith("请继续补充") ||
    normalized.startsWith("如有相关") ||
    normalized.startsWith("建议在这里补充")
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function sanitizeFilenamePart(value: string) {
  return value.replace(PDF_FILENAME_FORBIDDEN_CHARS, "").trim().replace(/\s+/g, " ");
}
