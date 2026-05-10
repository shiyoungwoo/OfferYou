import { describe, expect, it } from "vitest";
import { extractFirstJsonValue, parseLooseJSON, stripMarkdown } from "@/lib/ai/json-parser";

describe("stripMarkdown", () => {
  it("extracts content from fenced JSON code block", () => {
    expect(stripMarkdown('```json\n{"key": "value"}\n```')).toBe('{"key": "value"}');
  });

  it("extracts content from fenced code block without language tag", () => {
    expect(stripMarkdown('```\n{"key": "value"}\n```')).toBe('{"key": "value"}');
  });

  it("returns trimmed text when no fencing is present", () => {
    expect(stripMarkdown('  {"key": "value"}  ')).toBe('{"key": "value"}');
  });

  it("handles loose fenced block with surrounding text", () => {
    const input = '这是结果：\n```json\n{"a": 1}\n```\n以上。';
    expect(stripMarkdown(input)).toBe('{"a": 1}');
  });
});

describe("extractFirstJsonValue", () => {
  it("extracts a simple JSON object", () => {
    expect(extractFirstJsonValue('{"key": "value"}')).toBe('{"key": "value"}');
  });

  it("extracts a JSON array", () => {
    expect(extractFirstJsonValue('[1, 2, 3]')).toBe('[1, 2, 3]');
  });

  it("extracts JSON from text with surrounding content", () => {
    const input = '以下是结果：\n{"name": "test", "items": [1, 2]}\n以上。';
    const result = extractFirstJsonValue(input);
    expect(result).toBe('{"name": "test", "items": [1, 2]}');
  });

  it("handles nested objects and arrays", () => {
    const input = '{"a": {"b": [1, {"c": 2}]}}';
    expect(extractFirstJsonValue(input)).toBe(input);
  });

  it("handles strings with braces inside", () => {
    const input = '{"text": "hello { world }"}';
    expect(extractFirstJsonValue(input)).toBe(input);
  });

  it("returns null when no JSON value is found", () => {
    expect(extractFirstJsonValue("no json here")).toBeNull();
  });

  it("returns null for incomplete JSON", () => {
    expect(extractFirstJsonValue('{"key": "value"')).toBeNull();
  });
});

describe("parseLooseJSON", () => {
  it("parses a plain JSON object", () => {
    const result = parseLooseJSON<{ key: string }>('{"key": "value"}');
    expect(result.key).toBe("value");
  });

  it("parses JSON wrapped in markdown fencing", () => {
    const result = parseLooseJSON<{ a: number }>('```json\n{"a": 1}\n```');
    expect(result.a).toBe(1);
  });

  it("parses JSON with Chinese text surrounding it", () => {
    const result = parseLooseJSON<{ name: string }>('这是模型输出：\n{"name": "测试"}\n以上是结果。');
    expect(result.name).toBe("测试");
  });

  it("parses nested objects and arrays", () => {
    const result = parseLooseJSON<{ items: Array<{ id: number }> }>('{\n  "items": [{"id": 1}, {"id": 2}]\n}');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.id).toBe(1);
  });

  it("throws on input without any JSON", () => {
    expect(() => parseLooseJSON("no json at all")).toThrow(/未找到合法的 JSON/);
  });

  it("throws on invalid JSON structure", () => {
    expect(() => parseLooseJSON("{invalid}")).toThrow();
  });
});
