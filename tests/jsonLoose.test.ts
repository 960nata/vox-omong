import { describe, it, expect } from "vitest";
import { parseLoose } from "../src/lib/jsonLoose";

describe("parseLoose (JSON Resilience Parser)", () => {
  it("parses valid JSON directly", () => {
    const input = '{"name": "vox", "version": 1}';
    expect(parseLoose(input)).toEqual({ name: "vox", version: 1 });
  });

  it("strips markdown code blocks", () => {
    const input = '```json\n{"status": "ok"}\n```';
    expect(parseLoose(input)).toEqual({ status: "ok" });
  });

  it("handles trailing commas in objects and arrays", () => {
    const input = '{"items": [1, 2, 3, ], "ok": true, }';
    expect(parseLoose(input)).toEqual({ items: [1, 2, 3], ok: true });
  });

  it("fixes truncated JSON missing closing brackets", () => {
    const input = '{"title": "Report", "slides": [{"id": 1, "title": "Intro"';
    const result = parseLoose<{ title: string; slides: Array<{ id: number; title: string }> }>(input);
    expect(result).toBeDefined();
    expect(result?.title).toBe("Report");
    expect(result?.slides?.[0]?.title).toBe("Intro");
  });

  it("replaces curly smart quotes with standard double quotes", () => {
    const input = '{“key”: “value”}';
    expect(parseLoose(input)).toEqual({ key: "value" });
  });

  it("returns null for non-JSON strings", () => {
    expect(parseLoose("ini cuma teks biasa tanpa struktur")).toBeNull();
  });
});
