// Quick test: pdf-parse on an existing PDF in the storage folder
// Run with: node scripts/test-pdf-parse.mjs
import fs from "node:fs";
import path from "node:path";

// Find a real PDF in the storage folder
const storageDir = path.join(process.cwd(), "storage");

function findPdfs(dir) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) results.push(...findPdfs(full));
      else if (e.name.endsWith(".pdf")) results.push(full);
    }
  } catch {}
  return results;
}

const pdfs = findPdfs(storageDir);
if (pdfs.length === 0) {
  console.log("No PDFs found in storage/. Looking in project root...");
  // Try the project directory
  const rootPdfs = findPdfs(path.join(process.cwd(), ".."));
  if (rootPdfs.length > 0) pdfs.push(rootPdfs[0]);
}

if (pdfs.length === 0) {
  console.log("No PDF files found to test. Please upload a PDF through the web UI first.");
  process.exit(0);
}

const testPdf = pdfs[0];
console.log(`Testing PDF extraction on: ${testPdf}`);

const buffer = fs.readFileSync(testPdf);
console.log(`File size: ${buffer.length} bytes`);

// Test with pdf-parse
const pdfParse = (await import("pdf-parse")).default;
const data = await pdfParse(buffer);
console.log(`\nPages: ${data.numpages}`);
console.log(`Extracted text length: ${data.text?.length || 0} chars`);
console.log(`\nFirst 500 chars:\n${data.text?.slice(0, 500)}`);
