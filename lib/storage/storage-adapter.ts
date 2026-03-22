export type StorageAssetKind =
  | "resume_source"
  | "jd_source"
  | "profile_photo"
  | "export_pdf"
  | "export_docx"
  | "other";

export type PutAssetInput = {
  userId: string;
  kind: StorageAssetKind;
  filename: string;
  buffer: Buffer;
  mimeType: string;
};

export type StoredAsset = {
  storagePath: string;
  mimeType: string;
  originalFilename: string;
};

export interface StorageAdapter {
  put(input: PutAssetInput): Promise<StoredAsset>;
}
