import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PutAssetInput, StorageAdapter, StoredAsset } from "@/lib/storage/storage-adapter";

function assertInsideStorageRoot(root: string, targetPath: string) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(targetPath);
  if (!resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`) && resolvedTarget !== resolvedRoot) {
    throw new Error("文件路径超出允许范围。");
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly rootDir: string) {}

  async put(input: PutAssetInput): Promise<StoredAsset> {
    const targetDir = path.join(this.rootDir, input.userId, input.kind);
    assertInsideStorageRoot(this.rootDir, targetDir);

    await mkdir(targetDir, { recursive: true });

    const safeFilename = this.sanitizeFilename(input.filename);
    const targetPath = path.join(targetDir, `${randomUUID()}-${safeFilename}`);
    assertInsideStorageRoot(this.rootDir, targetPath);

    await writeFile(targetPath, input.buffer);

    return {
      storagePath: targetPath,
      mimeType: input.mimeType,
      originalFilename: input.filename
    };
  }

  assertPathAllowed(filePath: string) {
    assertInsideStorageRoot(this.rootDir, filePath);
  }

  private sanitizeFilename(filename: string) {
    return filename.replace(/[\/\\:*?"<>|]/g, "_");
  }
}
