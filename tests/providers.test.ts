import { describe, expect, it } from "vitest";
import { execArgs, PROVIDERS, providerSpec } from "@/lib/providers/catalog";
import { lineParser, parseClaudeLine, parseCodexLine } from "@/lib/providers/run";

describe("katalog provider", () => {
  it("menolak provider yang tidak dikenal", () => {
    expect(() => providerSpec("openrouter")).toThrow(/tidak dikenal/);
  });

  it("codex dijalankan non-interaktif, baca-saja, prompt dari stdin", () => {
    const args = execArgs(PROVIDERS.codex);
    expect(args).toContain("exec");
    expect(args).toContain("--json");
    expect(args.join(" ")).toContain("-s read-only");
    // Prompt lewat stdin ("-"), bukan argumen — biar tidak bocor ke `ps`.
    expect(args[args.length - 1]).toBe("-");
  });

  it("izin tulis harus diminta eksplisit", () => {
    expect(execArgs(PROVIDERS.codex, { write: true }).join(" ")).toContain("-s workspace-write");
    expect(execArgs(PROVIDERS.claude).join(" ")).toContain("--permission-mode plan");
    expect(execArgs(PROVIDERS.claude, { write: true }).join(" ")).toContain("--permission-mode acceptEdits");
  });

  it("model dan folder kerja diteruskan ke CLI", () => {
    const args = execArgs(PROVIDERS.codex, { model: "gpt-5.6-luna", cwd: "/tmp/proyek" });
    expect(args.join(" ")).toContain("-m gpt-5.6-luna");
    expect(args.join(" ")).toContain("-C /tmp/proyek");
  });

  it("tidak ada prompt yang masuk daftar argumen", () => {
    for (const spec of Object.values(PROVIDERS)) {
      const args = execArgs(spec, { model: "m", cwd: "/tmp" });
      expect(args.some((a) => a.includes("rahasia"))).toBe(false);
    }
  });
});

describe("parser keluaran codex", () => {
  it("mengambil jawaban agent, bukan reasoning atau tool", () => {
    expect(
      parseCodexLine('{"type":"item.completed","item":{"type":"agent_message","text":"SIAP"}}')
    ).toMatchObject({ kind: "text", text: "SIAP" });
    expect(
      parseCodexLine('{"type":"item.completed","item":{"type":"reasoning","text":"mikir"}}')
    ).toMatchObject({ kind: "other" });
    expect(
      parseCodexLine('{"type":"item.completed","item":{"type":"command_execution","command":"ls"}}')
    ).toMatchObject({ kind: "tool", text: "ls" });
  });

  it("mencatat id sesi dan pemakaian token", () => {
    expect(parseCodexLine('{"type":"thread.started","thread_id":"01a2"}')).toMatchObject({
      kind: "started",
      sessionId: "01a2",
    });
    expect(
      parseCodexLine(
        '{"type":"turn.completed","usage":{"input_tokens":16739,"cached_input_tokens":8064,"output_tokens":6}}'
      )
    ).toMatchObject({
      kind: "usage",
      usage: { inputTokens: 16739, cachedInputTokens: 8064, outputTokens: 6 },
    });
  });

  it("menandai turn yang gagal", () => {
    expect(parseCodexLine('{"type":"turn.failed","error":{"message":"kuota habis"}}')).toMatchObject({
      kind: "error",
      text: "kuota habis",
    });
  });

  it("baris yang bukan JSON diabaikan, tidak bikin crash", () => {
    expect(parseCodexLine("Logged in using ChatGPT")).toBeNull();
    expect(parseCodexLine("")).toBeNull();
  });
});

describe("parser keluaran claude", () => {
  it("menggabungkan bagian teks dari satu pesan", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "Hal" }, { type: "text", text: "o" }] },
    });
    expect(parseClaudeLine(line)).toMatchObject({ kind: "text", text: "Halo" });
  });

  it("pesan tanpa teks dianggap langkah tool", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Read" }] },
    });
    expect(parseClaudeLine(line)).toMatchObject({ kind: "tool" });
  });

  it("event result memuat jawaban final dan pemakaian token", () => {
    const line = JSON.stringify({
      type: "result",
      subtype: "success",
      result: "beres",
      usage: { input_tokens: 10, cache_read_input_tokens: 4, output_tokens: 2 },
    });
    expect(parseClaudeLine(line)).toMatchObject({
      kind: "usage",
      text: "beres",
      usage: { inputTokens: 10, cachedInputTokens: 4, outputTokens: 2 },
    });
  });

  it("result yang error ditandai error", () => {
    const line = JSON.stringify({ type: "result", is_error: true, result: "limit kena" });
    expect(parseClaudeLine(line)).toMatchObject({ kind: "error", text: "limit kena" });
  });

  it("mencatat session id dari event system", () => {
    expect(parseClaudeLine('{"type":"system","subtype":"init","session_id":"abc"}')).toMatchObject({
      kind: "started",
      sessionId: "abc",
    });
  });
});

describe("pemilihan parser", () => {
  it("format plain menjadikan tiap baris sebagai teks", () => {
    const parse = lineParser(PROVIDERS.gemini);
    expect(parse("jawaban gemini")).toMatchObject({ kind: "text", text: "jawaban gemini" });
    expect(parse("   ")).toBeNull();
  });
});
