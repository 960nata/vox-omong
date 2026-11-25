import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let memory: typeof import("@/lib/engine/memory");
let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vox-engine-mem-"));
  process.env.VOX_ENGINE_DIR = tmpDir;
  memory = await import("@/lib/engine/memory");
});

afterAll(async () => {
  delete process.env.VOX_ENGINE_DIR;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("memory agent", () => {
  it("menolak memory kosong dan yang kepanjangan", async () => {
    await expect(memory.saveMemory({ agent: "a", text: "   " })).rejects.toThrow(memory.MemoryError);
    await expect(memory.saveMemory({ agent: "a", text: "x".repeat(501) })).rejects.toThrow(/500/);
  });

  it("menyimpan dan memperbarui memory yang sama lewat id", async () => {
    const first = await memory.saveMemory({ agent: "toko", text: "Laporan pakai Rupiah." });
    const second = await memory.saveMemory({ id: first.id, agent: "toko", text: "Laporan pakai USD." });
    expect(second.id).toBe(first.id);
    expect(await memory.listMemories("toko")).toHaveLength(1);
  });

  it("membatasi jumlah memory yang selalu ikut di prompt", async () => {
    for (let i = 0; i < memory.MAX_ALWAYS; i++) {
      await memory.saveMemory({ agent: "penuh", text: `Fakta ${i}.`, alwaysInPrompt: true });
    }
    await expect(
      memory.saveMemory({ agent: "penuh", text: "Satu lagi.", alwaysInPrompt: true })
    ).rejects.toThrow(/selalu di prompt/);
    // Yang tidak selalu-di-prompt tetap boleh ditambah.
    await expect(memory.saveMemory({ agent: "penuh", text: "Cadangan." })).resolves.toBeTruthy();
  });

  it("mencari memory berdasarkan kata di teks dan tag", async () => {
    await memory.saveMemory({ agent: "cari", text: "Klien utama namanya Budi Santoso." });
    await memory.saveMemory({ agent: "cari", text: "Deploy pakai Vercel.", tags: ["infra"] });
    await memory.saveMemory({ agent: "lain", text: "Budi juga klien di sini." });

    const hits = await memory.searchMemories("cari", "siapa klien Budi?");
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toMatch(/Budi Santoso/);

    const byTag = await memory.searchMemories("cari", "urusan infra");
    expect(byTag[0].text).toMatch(/Vercel/);
  });

  it("blok prompt memuat yang selalu ikut plus hasil pencarian, tanpa dobel", async () => {
    await memory.saveMemory({ agent: "prompt", text: "Bahasanya santai.", alwaysInPrompt: true });
    await memory.saveMemory({ agent: "prompt", text: "Server produksi di Singapura." });

    const text = await memory.memoryPrompt("prompt", "server produksi di mana?");
    expect(text).toContain("Bahasanya santai.");
    expect(text).toContain("Server produksi di Singapura.");
    expect(text.match(/Bahasanya santai/g)).toHaveLength(1);

    const tanpaQuery = await memory.memoryPrompt("prompt");
    expect(tanpaQuery).toContain("Bahasanya santai.");
    expect(tanpaQuery).not.toContain("Singapura");
  });

  it("agent tanpa memory menghasilkan blok kosong", async () => {
    expect(await memory.memoryPrompt("belum-ada", "apa saja")).toBe("");
  });

  it("menghapus memory", async () => {
    const saved = await memory.saveMemory({ agent: "hapus", text: "Sementara." });
    expect(await memory.deleteMemory(saved.id)).toBe(true);
    expect(await memory.deleteMemory(saved.id)).toBe(false);
  });
});
