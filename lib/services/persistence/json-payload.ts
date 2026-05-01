export type JsonPayloadParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

export function parseJsonPayload<T>(payload: string, context: string): JsonPayloadParseResult<T> {
  try {
    return { ok: true, value: JSON.parse(payload) as T };
  } catch {
    return { ok: false, reason: `${context} 的存储数据已损坏，已跳过该记录。` };
  }
}
