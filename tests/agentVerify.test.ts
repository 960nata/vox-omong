import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

const replies: string[] = [];
vi.mock("../src/lib/codeAgent", () => ({
  callLLM: vi.fn(async () => ({ text: replies.shift() ?? '{"action":"finish","args":{"final_answer":"habis"}}', model: "mock" })),
}));
vi.mock("../src/lib/agentic/semanticMemory", () => ({
  formatAgentMemoryContext: async () => "",
  rememberSemantic: async () => {},
  recallSemantic: async () => [],
}));

import { runReActLoop } from "../src/lib/agentic/reactLoop";
import { artifactProblem, collectEvidence, goalNeedsEvidence } from "../src/lib/agentic/verify";
import type { ArtifactItem } from "../src/lib/types";

const PROJECT = "default-workspace";
const dir = path.join(process.cwd(), ".data", "user_projects", PROJECT);
const step = (action: string, args: object, thought = "") => JSON.stringify({ thought, action, args });

describe("loop agent: selesai harus ada buktinya", () => {
  beforeEach(async () => { replies.length = 0; await fs.mkdir(dir, { recursive: true }); });
  afterAll(async () => { await fs.rm(path.join(dir, "bukti-tes.txt"), { force: true }); });

  it("klaim selesai tanpa kerja ditolak, hasil akhir tidak dianggap sukses", async () => {
    replies.push(step("finish", { final_answer: "Sudah saya buat filenya!" }), step("finish", { final_answer: "Sudah beres." }), step("finish", { final_answer: "Sudah beres kok." }));
    const res = await runReActLoop("buat file bukti-tes.txt isinya halo", { projectId: PROJECT, maxSteps: 6 });
    expect(res.success).toBe(false);
    expect(res.finalAnswer).toMatch(/belum terverifikasi/i);
    expect(res.finalAnswer).toMatch(/tidak ada alat yang berhasil/);
  });

  it("kerja sungguhan lalu selesai = sukses, dan filenya benar-benar ada", async () => {
    replies.push(step("file_write", { path: "bukti-tes.txt", content: "halo" }), step("finish", { final_answer: "File dibuat." }));
    const res = await runReActLoop("buat file bukti-tes.txt isinya halo", { projectId: PROJECT, maxSteps: 6 });
    expect(res.success).toBe(true);
    expect(await fs.readFile(path.join(dir, "bukti-tes.txt"), "utf-8")).toBe("halo");
    expect(res.finalAnswer).toMatch(/file_write: bukti-tes\.txt/);
  });

  it("balasan bukan JSON tiga kali: berhenti dengan pesan jujur", async () => {
    replies.push("maaf", "saya bingung", "hmm");
    const res = await runReActLoop("perbaiki bug login", { projectId: PROJECT, maxSteps: 8 });
    expect(res.success).toBe(false);
    expect(res.finalAnswer).toMatch(/Belum selesai/);
  });

  it("alat tak dikenal dan MCP yang belum diaktifkan dilaporkan gagal", async () => {
    replies.push(step("hapus_internet", {}), step("mcp_call", { provider: "github", tool: "list_issues" }), step("finish", { final_answer: "Tidak bisa." }));
    const res = await runReActLoop("cek issue di repo github lalu perbaiki", { projectId: PROJECT, maxSteps: 6, mcpEnabled: [] });
    expect(res.success).toBe(false);
    expect(res.steps.find((s) => s.action === "mcp_call")?.observation).toMatch(/belum diaktifkan/);
  });

  it("pertanyaan biasa boleh langsung selesai", async () => {
    replies.push(step("finish", { final_answer: "PRD itu dokumen kebutuhan produk." }));
    const res = await runReActLoop("jelaskan apa itu PRD", { projectId: PROJECT, maxSteps: 4 });
    expect(res.success).toBe(true);
  });
});

describe("verifikasi artefak", () => {
  const base = { id: "x", title: "t", status: "completed" as const };
  it("menolak artefak kosong", () => {
    expect(artifactProblem(undefined)).toBeTruthy();
    expect(artifactProblem({ ...base, type: "slides", slides: { deckTitle: "a", slides: [] } } as ArtifactItem)).toBe("slide kosong");
    expect(artifactProblem({ ...base, type: "pdf_document", pdfContent: " " } as ArtifactItem)).toBe("dokumen kosong");
    expect(artifactProblem({ ...base, type: "spreadsheet", spreadsheet: { title: "a", filename: "a.xlsx", headers: ["x"], rows: [] } } as ArtifactItem)).toBe("tabel kosong");
    expect(artifactProblem({ ...base, type: "video", video: { id: "tidak-ada-123", url: "", htmlUrl: "", seconds: 1, scenes: 1, recorded: true } } as ArtifactItem)).toBeTruthy();
  });
  it("menerima artefak berisi", () => {
    expect(artifactProblem({ ...base, type: "spreadsheet", spreadsheet: { title: "a", filename: "a.xlsx", headers: ["x"], rows: [[1]] } } as ArtifactItem)).toBeNull();
    expect(artifactProblem({ ...base, type: "pdf_document", pdfContent: "isi dokumen yang cukup panjang untuk dianggap ada isinya ya" } as ArtifactItem)).toBeNull();
  });
  it("langkah terakhir gagal = belum terverifikasi", () => {
    const e = collectEvidence("install paket", [
      { stepNumber: 1, thought: "", action: "terminal_exec", args: { command: "npm i" }, success: true, timestamp: "" },
      { stepNumber: 2, thought: "", action: "terminal_exec", args: { command: "npm test" }, success: false, timestamp: "" },
    ], []);
    expect(e.ok).toBe(false);
    expect(goalNeedsEvidence("apa kabar")).toBe(false);
  });
});
