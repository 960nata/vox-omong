import { describe, it, expect, vi } from "vitest";
import { looksLikeUnroutedTask, routeIntent } from "../src/lib/intentRouter";

describe("gerbang router maksud", () => {
  it.each([
    "cek kenapa build project ini gagal terus perbaiki",
    "install tailwind di project ini lalu jalankan dev server",
    "cariin 5 kompetitor kopi di lampung terus simpan ke file catatan.md",
    "tolong rapikan struktur folder src biar gak berantakan",
    "bisa tolong cek repo github gw ada issue apa aja?",
  ])("tugas tanpa jalur: %s", (m) => expect(looksLikeUnroutedTask(m, false)).toBe(true));

  it.each(["halo", "makasih ya cuy", "apa itu PRD?", "kenapa langit biru", "gimana kabarnya hari ini", "oke gas", "menurut lu bagusan mana react atau vue?", "pendek"])(
    "bukan tugas: %s", (m) => expect(looksLikeUnroutedTask(m, false)).toBe(false));

  it("pesan yang sudah punya jalur tidak ditanyakan ke model", async () => {
    const classify = vi.fn();
    const r = await routeIntent("buatkan slide presentasi tentang kopi lampung", { hasOwnRoute: true, classify });
    expect(r.intent).toBe("chat");
    expect(classify).not.toHaveBeenCalled();
  });
});

describe("router maksud dengan model", () => {
  const task = "cek kenapa build project ini gagal terus perbaiki";
  it("mengikuti pilihan model", async () => {
    expect((await routeIntent(task, { hasOwnRoute: false, hasProjectCode: true, classify: async () => '{"intent":"coding","reason":"build error"}' })).intent).toBe("coding");
    expect((await routeIntent(task, { hasOwnRoute: false, classify: async () => 'Tentu! ```json\n{"intent":"agent","reason":"x"}\n```' })).intent).toBe("agent");
  });
  it("coding tanpa kode proyek dialihkan ke agent", async () => {
    expect((await routeIntent(task, { hasOwnRoute: false, hasProjectCode: false, classify: async () => '{"intent":"coding"}' })).intent).toBe("agent");
  });
  it("jawaban rusak atau model gagal = chat", async () => {
    expect((await routeIntent(task, { hasOwnRoute: false, classify: async () => "maaf saya tidak tahu" })).intent).toBe("chat");
    expect((await routeIntent(task, { hasOwnRoute: false, classify: async () => { throw new Error("429"); } })).intent).toBe("chat");
    expect((await routeIntent(task, { hasOwnRoute: false, classify: async () => '{"intent":"hapus_semua"}' })).intent).toBe("chat");
  });
});
