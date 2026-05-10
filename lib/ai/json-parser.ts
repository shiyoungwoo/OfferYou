export function stripMarkdown(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const fencedLoose = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/iu);
  return fencedLoose?.[1]?.trim() ?? trimmed;
}

export function extractFirstJsonValue(text: string): string | null {
  const source = text.trim();
  const start = source.search(/[\[{]/u);
  if (start === -1) return null;

  const open = source[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1).trim();
      }
    }
  }

  return null;
}

export function parseLooseJSON<T = unknown>(text: string): T {
  const jsonText = extractFirstJsonValue(stripMarkdown(text));
  if (!jsonText) {
    throw new SyntaxError("输入中未找到合法的 JSON 对象或数组。");
  }

  return JSON.parse(jsonText) as T;
}
