import path from "node:path";

/**
 * Returns the root directory for OfferYou's persistent data (SQLite, uploads, exports).
 *
 * Priority:
 *  1. `OFFERYOU_STORAGE_DIR` env var (used by desktop shell to redirect to app data dir)
 *  2. `<cwd>/storage` fallback (current web dev default)
 */
export function getStorageRoot(): string {
  const configured = process.env.OFFERYOU_STORAGE_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.join(process.cwd(), "storage");
}
