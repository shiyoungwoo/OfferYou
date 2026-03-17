import type { ResumeDocument } from "@/lib/document/resume-document";

const MAX_ITEMS_PER_PAGE = 6;

export function paginateDocument(document: ResumeDocument): ResumeDocument[] {
  const pages: ResumeDocument[] = [];
  let currentSections: ResumeDocument["sections"] = [];
  let currentCount = 0;

  for (const section of document.sections) {
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

export function renderResumeDocumentHtml(document: ResumeDocument) {
  const pages = paginateDocument(document);
  const body = pages
    .map((page, index) => {
      const sections = page.sections
        .map(
          (section) => `
        <section>
          <h3>${escapeHtml(section.title)}</h3>
          <ul>
            ${section.items
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}
          </ul>
        </section>`
        )
        .join("");

      return `
      <article>
        <header>
          <h2>${escapeHtml(page.header.name)}</h2>
          <p class="role">${escapeHtml(page.header.title)}</p>
          <p class="meta">${page.header.meta.map(escapeHtml).join(" · ")}</p>
        </header>
        ${sections}
        <footer>Page ${index + 1}</footer>
      </article>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(document.header.name)}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #ebe5d8;
        color: #12202f;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
      }
      .print-shell {
        display: grid;
        gap: 24px;
        padding: 40px 24px;
      }
      article {
        width: 794px;
        margin: 0 auto;
        background: white;
        border: 1px solid #cbd5e1;
        border-radius: 24px;
        padding: 40px;
        box-shadow: 0 30px 60px rgba(18, 32, 47, 0.16);
        page-break-after: always;
      }
      article:last-child { page-break-after: auto; }
      h2, h3, p, ul { margin: 0; }
      header { border-bottom: 1px solid #d5ddea; padding-bottom: 24px; }
      h2 { font-size: 32px; line-height: 1.2; }
      h3 { font-size: 14px; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b; }
      .role { margin-top: 12px; font-size: 18px; color: #155eef; }
      .meta { margin-top: 12px; font-size: 13px; color: #64748b; }
      section { display: grid; gap: 12px; break-inside: avoid; margin-top: 32px; }
      section ul { display: grid; gap: 12px; padding: 0; list-style: none; }
      section li {
        border: 1px solid #d5ddea;
        border-radius: 16px;
        background: #f7f5ef;
        padding: 12px 16px;
        font-size: 14px;
        line-height: 1.65;
        color: #334155;
      }
      footer {
        border-top: 1px solid #d5ddea;
        padding-top: 16px;
        margin-top: 32px;
        text-align: right;
        font-size: 11px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: #94a3b8;
      }
      @page {
        size: A4;
        margin: 20mm 14mm;
      }
      @media print {
        body { background: white; }
        .print-shell { padding: 0; gap: 0; }
        article {
          width: auto;
          margin: 0;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="print-shell">${body}</div>
  </body>
</html>`;
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
