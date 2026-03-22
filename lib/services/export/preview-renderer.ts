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
        <section class="${section.tone ?? "standard"}">
          <h3>${escapeHtml(section.title)}</h3>
          <ul>
            ${section.items
              .map((item) =>
                item.type === "entry"
                  ? `<li class="entry">
                      <div class="entry-head">
                        <div>
                          <p class="entry-title">${escapeHtml(item.heading)}</p>
                          ${item.subheading ? `<p class="entry-subtitle">${escapeHtml(item.subheading)}</p>` : ""}
                        </div>
                        ${item.meta ? `<p class="entry-meta">${escapeHtml(item.meta)}</p>` : ""}
                      </div>
                      ${item.summary ? `<p class="entry-summary">${escapeHtml(item.summary)}</p>` : ""}
                      ${
                        item.bullets && item.bullets.length > 0
                          ? `<ul class="entry-bullets">${item.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
                          : ""
                      }
                    </li>`
                  : `<li class="text-item">${escapeHtml(item.text)}</li>`
              )
              .join("")}
          </ul>
        </section>`
        )
        .join("");

      return `
      <article>
        <header>
          <div class="identity">
            <div>
              <h2>${escapeHtml(page.header.name)}</h2>
              <p class="role">${escapeHtml(page.header.title)}</p>
              ${
                page.header.contacts && page.header.contacts.length > 0
                  ? `<p class="contacts">${page.header.contacts.map(escapeHtml).join(" · ")}</p>`
                  : ""
              }
              <p class="meta">${page.header.meta.map(escapeHtml).join(" · ")}</p>
            </div>
            <div class="photo">${
              page.header.photo?.src
                ? `<img src="${escapeHtml(page.header.photo.src)}" alt="${escapeHtml(page.header.photo.label ?? "照片")}" />`
                : escapeHtml(page.header.photo?.label ?? "照片")
            }</div>
          </div>
        </header>
        <div class="resume-grid">${sections}</div>
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
        background: #eff2f5;
        color: #1f2937;
        font-family: "IBM Plex Serif", "Source Serif 4", Georgia, serif;
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
        border: 1px solid #d7dde5;
        border-radius: 8px;
        padding: 44px 42px;
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
        page-break-after: always;
      }
      article:last-child { page-break-after: auto; }
      h2, h3, p, ul { margin: 0; }
      header { border-bottom: 1px solid #d4d9e1; padding-bottom: 24px; }
      .identity {
        display: grid;
        grid-template-columns: 1fr 102px;
        gap: 28px;
        align-items: start;
      }
      h2 { font-size: 34px; line-height: 1.1; color: #111827; }
      h3 { font-size: 13px; letter-spacing: 0.2em; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
      .role { margin-top: 10px; font-size: 15px; letter-spacing: 0.12em; text-transform: uppercase; color: #4b5563; }
      .contacts { margin-top: 12px; font-size: 13px; color: #374151; }
      .meta { margin-top: 8px; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; }
      .photo {
        width: 102px;
        height: 118px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: #94a3b8;
        background: #f8fafc;
      }
      .photo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .resume-grid {
        display: grid;
        grid-template-columns: minmax(0, 0.88fr) minmax(0, 1.28fr);
        gap: 18px;
        margin-top: 26px;
      }
      section { display: grid; gap: 12px; break-inside: avoid; border: 1px solid #e5e7eb; padding: 16px 18px; background: white; }
      section.hero { background: #f8fafc; }
      section.muted { border-style: dashed; background: #fcfcfd; }
      section ul { display: grid; gap: 12px; padding: 0; list-style: none; }
      .text-item { font-size: 14px; line-height: 1.65; color: #334155; }
      .entry { display: grid; gap: 8px; }
      .entry-head {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 16px;
        border-bottom: 1px solid #f1f5f9;
        padding-bottom: 6px;
      }
      .entry-title { font-size: 15px; font-weight: 600; color: #111827; }
      .entry-subtitle { margin-top: 2px; font-size: 13px; color: #4b5563; }
      .entry-meta {
        flex-shrink: 0;
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #6b7280;
      }
      .entry-summary { font-size: 14px; line-height: 1.7; color: #374151; }
      .entry-bullets { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
      .entry-bullets li { font-size: 13px; line-height: 1.65; color: #374151; }
      footer {
        border-top: 1px solid #e5e7eb;
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
        .resume-grid { gap: 16px; }
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
