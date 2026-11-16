import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

const delivered: { conv: string; content: string }[] = [];
vi.mock("../src/lib/storage", () => ({ addMessage: vi.fn(async (conv: string, m: { content: string }) => { delivered.push({ conv, content: m.content }); return m; }) }));
vi.mock("../src/lib/agentic/reactLoop", () => ({ runReActLoop: vi.fn() }));
vi.mock("../src/lib/agentic/planner", () => ({ planAutonomousTask: vi.fn() }));
vi.mock("../src/lib/agentic/visualCritic", () => ({ runVisualCritic: vi.fn() }));

import { getBackgroundTask, createBackgroundTask } from "../src/lib/agentic/taskQueue";
import { runReActLoop } from "../src/lib/agentic/reactLoop";

const DIR = path.join(process.cwd(), ".data", "agentic", "tasks");
const made: string[] = [];

describe("antrean tugas background", () => {
  beforeAll(() => fs.mkdir(DIR, { recursive: true }));
  afterAll(async () => { for (const id of made) await fs.rm(path.join(DIR, `${id}.json`), { force: true }); });

  it("tugas yang terputus karena restart ditandai gagal dan dikabarkan ke percakapan", async () => {
    const id = "task-tes-terputus";
    made.push(id);
    const old = new Date(Date.now() - 10 * 60_000).toISOString();
    await fs.writeFile(path.join(DIR, `${id}.json`), JSON.stringify({ id, task: "rapikan repo", mode: "react", status: "running", progressPercent: 40, currentStepMessage: "jalan", logs: [], conversationId: "conv-x", createdAt: old, updatedAt: old }));
    const t = await getBackgroundTask(id);
    expect(t?.status).toBe("failed");
    expect(t?.error).toMatch(/Terputus/);
    expect(delivered.some((d) => d.conv === "conv-x" && /gagal/i.test(d.content))).toBe(true);
  });

  it("tugas yang baru saja diperbarui tidak dianggap terputus", async () => {
    const id = "task-tes-segar";
    made.push(id);
    const now = new Date().toISOString();
    await fs.writeFile(path.join(DIR, `${id}.json`), JSON.stringify({ id, task: "x", mode: "react", status: "running", progressPercent: 40, currentStepMessage: "jalan", logs: [], createdAt: now, updatedAt: now }));
    expect((await getBackgroundTask(id))?.status).toBe("running");
  });

  it("hasil tidak terverifikasi = gagal, dan hasilnya sampai ke percakapan", async () => {
    vi.mocked(runReActLoop).mockResolvedValueOnce({ success: false, finalAnswer: "Selesai sebagian, belum terverifikasi.", steps: [], artifacts: [] });
    const rec = await createBackgroundTask("install paket lalu tes", { conversationId: "conv-y" });
    made.push(rec.id);
    for (let i = 0; i < 80 && (await getBackgroundTask(rec.id))?.delivered !== true; i++) await new Promise((r) => setTimeout(r, 25));
    const t = await getBackgroundTask(rec.id);
    expect(t?.status).toBe("failed");
    expect(delivered.some((d) => d.conv === "conv-y" && d.content.includes("belum terverifikasi"))).toBe(true);
  });

  it("hasil terverifikasi = selesai", async () => {
    vi.mocked(runReActLoop).mockResolvedValueOnce({ success: true, finalAnswer: "Beres.", steps: [], artifacts: [] });
    const rec = await createBackgroundTask("buat catatan", { conversationId: "conv-z" });
    made.push(rec.id);
    for (let i = 0; i < 80 && (await getBackgroundTask(rec.id))?.delivered !== true; i++) await new Promise((r) => setTimeout(r, 25));
    expect((await getBackgroundTask(rec.id))?.status).toBe("completed");
  });
});
