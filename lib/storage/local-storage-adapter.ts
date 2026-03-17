import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PutAssetInput, StorageAdapter, StoredAsset } from "@/lib/storage/storage-adapter";

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly rootDir: string) {}

  async put(input: PutAssetInput): Promise<StoredAsset> {
    const targetDir = path.join(this.rootDir, input.userId, input.kind);
    await mkdir(targetDir, { recursive: true });

    const safeFilename = this.sanitizeFilename(input.filename);
    const targetPath = path.join(targetDir, `${randomUUID()}-${safeFilename}`);

    await writeFile(targetPath, input.buffer);

    return {
      storagePath: targetPath,
      mimeType: input.mimeType,
      originalFilename: input.filename
    };
  }

  private sanitizeFilename(filename: string) {
    return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  }
}
