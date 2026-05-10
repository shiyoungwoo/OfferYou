import path from "node:path";

const ALLOWED_UPLOAD_TYPES = new Map<string, Set<string>>([
  [".pdf", new Set(["application/pdf"])],
  [".docx", new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"])],
  [".txt", new Set(["text/plain"])],
  [".png", new Set(["image/png"])],
  [".jpg", new Set(["image/jpeg"])],
  [".jpeg", new Set(["image/jpeg"])]
]);

export function isAllowedUploadType(filename: string, mimeType: string) {
  const ext = path.extname(filename).toLowerCase();
  const allowedMimeTypes = ALLOWED_UPLOAD_TYPES.get(ext);

  if (!allowedMimeTypes) {
    return false;
  }

  return allowedMimeTypes.has(mimeType || "application/octet-stream");
}
