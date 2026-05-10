import path from "node:path";
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { readApplicationRecord } from "@/lib/services/applications/application-record-service";
import { LocalStorageAdapter } from "@/lib/storage/local-storage-adapter";

const storageAdapter = new LocalStorageAdapter(path.join(process.cwd(), "storage"));

export async function GET(
  request: Request,
  context: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await context.params;
  const record = await readApplicationRecord(recordId);

  if (!record || !record.exportStoragePath) {
    return new NextResponse("Not Found or no export available", { status: 404 });
  }

  try {
    storageAdapter.assertPathAllowed(record.exportStoragePath);
    const fileBuffer = await readFile(record.exportStoragePath);

    // Provide a safe filename using the company name if available
    const safeCompany = record.company.replace(/[\/\\:*?"<>|]/g, "_") || "Unknown";
    const filename = `OfferYou_${safeCompany}_Resume.pdf`;

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`
      }
    });
  } catch (err) {
    return new NextResponse("File not found on disk", { status: 404 });
  }
}
