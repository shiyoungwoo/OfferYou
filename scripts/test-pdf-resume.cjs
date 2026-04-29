// Test PDF extraction on uploaded resume
const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");

const resumeDir = path.join(process.cwd(), "storage", "default-user", "resume_source");

if (!fs.existsSync(resumeDir)) {
  console.log("No resume_source directory found");
  process.exit(1);
}

const pdfs = fs.readdirSync(resumeDir).filter(f => f.endsWith(".pdf"));
console.log("PDFs found:", pdfs.length);

if (pdfs.length === 0) {
  console.log("No PDF files in resume_source");
  process.exit(0);
}

const latestPdf = pdfs[pdfs.length - 1];
const pdfPath = path.join(resumeDir, latestPdf);
const buffer = fs.readFileSync(pdfPath);

console.log("File:", latestPdf);
console.log("Size:", buffer.length, "bytes");

pdfParse(buffer)
  .then(data => {
    console.log("Pages:", data.numpages);
    console.log("Text length:", data.text ? data.text.length : 0);
    console.log("--- Extracted text (first 800 chars) ---");
    console.log(data.text ? data.text.slice(0, 800) : "(empty)");
  })
  .catch(e => {
    console.error("pdf-parse error:", e.message);
  });
