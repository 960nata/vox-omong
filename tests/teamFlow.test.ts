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
