import { describe, expect, it } from "vitest";
import { asksForTeams, claimsTeamFlow, isTeamSetupRequest, singleDivision } from "../src/lib/teamFlow";

const ideation = { stage: "ideation" as const, teamCount: 0 };
const withTeams = { stage: "prd" as const, teamCount: 3 };

describe("alur tim proyek menang atas Autopilot / agent umum", () => {
  it("pesan asli user di sesi startup baru masuk alur tim", () => {
    // analisis ide → harus jadi analisis + rekomendasi divisi, bukan agent menulis file .md
    expect(claimsTeamFlow("ANALISIS DULU DONG GW MAU IDE STARUP MATENG DAN BISA NGASILIN CUYAN CUY", ideation)).toBe(true);
    expect(claimsTeamFlow("mungkin buat tim dulu deh buat tim dulu di project ini cuy", ideation)).toBe(true);
    expect(claimsTeamFlow("Oh gitu jadi Coba deh buat tim yang cocok dulu deh buat tim apa dulu deh untuk plan ini", ideation)).toBe(true);
    expect(claimsTeamFlow("timnya mana ini timnya mana Bukannya ini Ai buat ngajentik kayak yang ada timnya cuy ajentik Ai yang ada timnya agen agen agent Ai", ideation)).toBe(true);
  });

  it("bentuk tim & pilih satu divisi dikenali", () => {
    expect(isTeamSetupRequest("bentuk tim rekomendasi")).toBe(true);
    expect(isTeamSetupRequest("bikinin tim dong")).toBe(true);
    expect(singleDivision("bentuk tim developer saja")).toBe("developer");
    expect(singleDivision("bentuk tim rekomendasi")).toBeNull();
  });

  it("tanya tim yang sudah ada dikenali", () => {
    expect(asksForTeams("timnya mana cuy")).toBe(true);
    expect(asksForTeams("mana agent-nya")).toBe(true);
  });

  it("obrolan biasa & tugas di luar alur tim tidak diambil", () => {
    expect(claimsTeamFlow("Halo cuy menurut lu itu idenya Gimana cuy", ideation)).toBe(false);
    expect(claimsTeamFlow("halo", ideation)).toBe(false);
    // setelah tim terbentuk, brief/tugas biasa tidak lagi dianalisis ulang
    expect(claimsTeamFlow("bikin landing page untuk produk ini", withTeams)).toBe(false);
  });
});

import { formatIdeas, parseIdeas, pickIdea, wantsIdeaSuggestions } from "../src/lib/teamFlow";

describe("tahap ideation: tawarkan ide, lalu pilih", () => {
  it("minta ide tanpa ide konkret dikenali", () => {
    expect(wantsIdeaSuggestions("IDE STARUP APA NIH YANG OK YA")).toBe(true);
    expect(wantsIdeaSuggestions("kitanya nanya idenya dulu bukan buat dulu")).toBe(true);
    expect(wantsIdeaSuggestions("ANALISIS DULU DONG GW MAU IDE STARUP MATENG DAN BISA NGASILIN CUYAN CUY")).toBe(true);
    expect(wantsIdeaSuggestions("ide gw: aplikasi kasir buat warung, gimana?")).toBe(false);
    expect(wantsIdeaSuggestions("aku mau bikin aplikasi kasir untuk UMKM")).toBe(false);
  });

  it("jawaban pilihan dikenali dalam berbagai gaya", () => {
    expect(pickIdea("Kalau boleh deh ID 1", 3)).toBe(0);
    expect(pickIdea("ide 2 aja", 3)).toBe(1);
    expect(pickIdea("yang ketiga", 3)).toBe(2);
    expect(pickIdea("3", 3)).toBe(2);
    expect(pickIdea("ide 4", 3)).toBeNull();
    expect(pickIdea("ide 1", 0)).toBeNull();
    expect(pickIdea("aku punya 2 kucing dan mau bikin toko", 3)).toBeNull();
  });

  it("jawaban pilihan diambil alur tim hanya saat ada ide yang ditawarkan", () => {
    expect(claimsTeamFlow("Kalau boleh deh ID 1", { stage: "ideation", teamCount: 0, ideaCount: 3 })).toBe(true);
    expect(claimsTeamFlow("Kalau boleh deh ID 1", { stage: "ideation", teamCount: 0, ideaCount: 0 })).toBe(false);
  });

  it("daftar ide dari model diparse dan diformat bernomor", () => {
    const ideas = parseIdeas('```json\n{"ideas":[{"title":"BalikModal","pitch":"Rekon COD untuk seller."},{"title":"","pitch":"x"}]}\n```');
    expect(ideas).toEqual([{ title: "BalikModal", pitch: "Rekon COD untuk seller." }]);
    const text = formatIdeas(ideas);
    expect(text).toContain("1. BalikModal. Rekon COD untuk seller.");
    expect(text).not.toMatch(/\*\*|[\u{1F300}-\u{1FAFF}]/u);
  });
});

import { buildTeamPicker, chosenDivisions, pickerMessage } from "../src/lib/teamFlow";

describe("kolom ceklis tim", () => {
  it("yang disarankan tercentang dan di atas, sisanya tersedia tanpa centang", () => {
    const p = buildTeamPicker([{ kind: "developer", reason: "Bikin aplikasinya." }, { kind: "founder" }]);
    expect(p.options.slice(0, 2).map((o) => [o.kind, o.recommended])).toEqual([["founder", true], ["developer", true]]);
    expect(p.options.find((o) => o.kind === "developer")?.role).toBe("Bikin aplikasinya.");
    expect(p.options.filter((o) => !o.recommended).length).toBe(5);
  });

  it("pesan dari tombol dibaca kembali jadi divisi yang sama", () => {
    const msg = pickerMessage(["Tim Founder & Startup", "Tim Developer", "Tim Kreatif"]);
    expect(isTeamSetupRequest(msg)).toBe(true);
    expect(chosenDivisions(msg)).toEqual(["founder", "developer", "creative"]);
    expect(chosenDivisions("bentuk tim rekomendasi")).toEqual([]);
    expect(chosenDivisions("bentuk tim buat startup gw")).toEqual([]);
  });
});
