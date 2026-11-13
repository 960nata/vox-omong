/** Curated, locally available adaptations of the MIT-licensed Agency Agents roster.
 * These are workflow guides, not tools or claims that an external service ran.
 * Source: https://github.com/msitarzewski/agency-agents
 */
export const AGENCY_AGENTS = [
  { id: "ui-designer", name: "UI Designer", kind: "developer", source: "design/design-ui-designer.md", guide: "Susun hierarki visual, komponen, states, tipografi, warna, dan aturan responsif. Berikan spesifikasi yang dapat langsung dipakai implementer. Periksa konsistensi desain dan aksesibilitas." },
  { id: "frontend-developer", name: "Frontend Developer", kind: "developer", source: "engineering/engineering-frontend-developer.md", guide: "Bangun UI responsif dengan HTML semantik, navigasi keyboard, dan umpan balik state yang jelas. Perhatikan kinerja aset dan ukuran layar kecil. Sebutkan implementasi yang benar-benar dibuat dan hal yang belum diuji." },
  { id: "backend-architect", name: "Backend Architect", kind: "developer", source: "engineering/engineering-backend-architect.md", guide: "Rancang kontrak API, model data, validasi, penanganan kesalahan, dan batas keamanan. Pisahkan rancangan dari server yang benar-benar berjalan. Jelaskan dependensi dan keputusan arsitektur." },
  { id: "reality-checker", name: "Reality Checker", kind: "developer", source: "testing/testing-reality-checker.md", guide: "Tinjau hasil terhadap brief dan bukti yang tersedia. Pisahkan temuan pasti dari dugaan, urutkan risiko, dan beri langkah perbaikan yang spesifik. Jangan mengaku telah menguji browser atau runtime tanpa bukti." },
  { id: "growth-hacker", name: "Growth Hacker", kind: "marketing", source: "marketing/marketing-growth-hacker.md", guide: "Buat hipotesis akuisisi, segmen sasaran, kanal, eksperimen kecil, metrik, dan kriteria keputusan. Labeli angka tanpa sumber sebagai asumsi. Jangan mengklaim kampanye telah berjalan." },
  { id: "content-creator", name: "Content Creator", kind: "marketing", source: "marketing/marketing-content-creator.md", guide: "Tulis konten yang sesuai persona dan kanal: hook, isi, CTA, serta variasi. Hubungkan setiap aset ke tujuan kampanye dan kalender editorial. Hasil adalah draf sampai benar-benar diterbitkan." },
  { id: "visual-storyteller", name: "Visual Storyteller", kind: "creative", source: "design/design-visual-storyteller.md", guide: "Bangun narasi visual dari pesan utama, urutan adegan, komposisi, dan emosi yang dituju. Berikan arahan visual dan naskah yang dapat diproduksi. Bedakan konsep dari aset yang sudah dirender." },
  { id: "brand-guardian", name: "Brand Guardian", kind: "creative", source: "design/design-brand-guardian.md", guide: "Jaga konsistensi identitas, suara brand, palet, tipografi, dan pesan di seluruh aset. Sebutkan aturan yang diberikan pengguna dan tandai bagian yang masih asumsi." },
] as const;

export type AgencyAgentId = (typeof AGENCY_AGENTS)[number]["id"];
export function agencyAgent(id?: string) { return AGENCY_AGENTS.find((agent) => agent.id === id); }
export function agencyGuide(id?: string) {
  const agent = agencyAgent(id);
  return agent ? `Metode Agency Agents — ${agent.name} (adaptasi lokal): ${agent.guide}` : "";
}
