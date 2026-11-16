import { describe, expect, it } from "vitest";
import {
  buildTeamPicker,
  chosenDivisions,
  decideFlow,
  detectVoice,
  formatAnalysis,
  formatIdeas,
  helpMessage,
  isTeamSetupRequest,
  isTooVague,
  mentionedIdeaNumbers,
  nextStepsMessage,
  parseIdeas,
  pickerMessage,
  pickIdea,
  say,
  stepOf,
  teamsFormedMessage,
  wantsIdeaSuggestions,
  type FlowCtx,
} from "../src/lib/teamFlow";

const IDEAS = [
  { title: "Invoice Kilat", pitch: "Tagihan otomatis lewat WhatsApp untuk UMKM." },
  { title: "Admin Sosmed UMKM", pitch: "Kelola konten untuk warung." },
  { title: "Kelas Skill Kerja", pitch: "Kelas singkat untuk fresh graduate." },
];

const fresh: FlowCtx = { stage: "ideation", existingKinds: [], ideaOptions: [], hasRecommendation: false, hasFolder: false };
const withIdeas: FlowCtx = { ...fresh, ideaOptions: IDEAS };
const analyzed: FlowCtx = { ...fresh, hasRecommendation: true };
const withTeams: FlowCtx = { ...fresh, stage: "prd", existingKinds: ["founder", "developer", "marketing"], hasRecommendation: true };
const asking: FlowCtx = { ...fresh, pendingBrief: "mau bikin usaha" };

const type = (m: string, ctx: FlowCtx) => decideFlow(m, ctx)?.type ?? null;

describe("tahap 1: belum punya ide", () => {
  it.each([
    "IDE STARUP APA NIH YANG OK YA",
    "kasih ide dong",
    "kitanya nanya idenya dulu bukan buat dulu",
    "ANALISIS DULU DONG GW MAU IDE STARUP MATENG DAN BISA NGASILIN CUYAN CUY",
    "ide di bidang kuliner modal 5 juta",
    "belum punya ide sama sekali",
    "bingung mau bikin apa",
    "terserah",
    "bebas aja",
    "gak tau",
  ])("%s → ditawari ide", (m) => {
    expect(type(m, fresh)).toBe("suggest");
  });

  it.each(["halo", "p", "tes", "assalamualaikum", "makasih", "ok", "wkwkwk", "pagi kak"])("sapaan %s → diarahkan ke langkah 1", (m) => {
    expect(type(m, fresh)).toBe("nudge");
  });

  it.each(["ini gimana sih", "bingung", "caranya gimana", "ini apaan", "ribet amat", "gak ngerti"])("%s → penjelasan alur", (m) => {
    expect(type(m, fresh)).toBe("help");
  });

  it.each(["mau bikin startup", "usaha online", "pengen bisnis yang cuan", "gw mau bikin aplikasi", "Mau buat toko"])("ide terlalu umum %s → ditanya detail", (m) => {
    expect(isTooVague(m)).toBe(true);
    expect(type(m, fresh)).toBe("clarify");
  });

  it.each([
    "aku mau bikin aplikasi kasir sederhana buat warung kopi",
    "ide gw: aplikasi kasir buat warung, gimana?",
    "Saya ingin membuka jasa laundry kiloan untuk mahasiswa di Bandung",
  ])("ide konkret %s → langsung dibedah", (m) => {
    expect(type(m, fresh)).toBe("analyze");
  });

  it("folder berisi kode langsung dibedah, apa pun pesannya", () => {
    expect(type("cek ini", { ...fresh, hasFolder: true })).toBe("analyze");
  });

  it("bukan urusan alur tim → null (diteruskan ke chat biasa)", () => {
    expect(type("berapa kurs dollar hari ini", fresh)).toBeNull();
    expect(type("Halo cuy menurut lu itu idenya Gimana cuy", fresh)).not.toBe("analyze");
  });
});

describe("tahap 1b: memilih dari ide yang ditawarkan", () => {
  it.each([
    ["Kalau boleh deh ID 1", "Invoice Kilat"],
    ["ide 2 aja", "Admin Sosmed UMKM"],
    ["yang ketiga", "Kelas Skill Kerja"],
    ["3", "Kelas Skill Kerja"],
    ["no 1", "Invoice Kilat"],
    ["pilih ide ke-2", "Admin Sosmed UMKM"],
    ["yang invoice kilat aja", "Invoice Kilat"],
  ])("%s → membedah %s", (m, title) => {
    const a = decideFlow(m, withIdeas);
    expect(a?.type).toBe("analyze");
    expect(a && "brief" in a ? a.brief : "").toContain(title);
  });

  it("gabung dua ide → dibedah sebagai gabungan", () => {
    const a = decideFlow("gabungin ide 1 sama 3", withIdeas);
    expect(a?.type).toBe("analyze");
    const brief = a && "brief" in a ? a.brief : "";
    expect(brief).toContain("Invoice Kilat");
    expect(brief).toContain("Kelas Skill Kerja");
  });

  it.each(["ide 5", "nomor 9", "4"])("%s di luar daftar → diberi tahu jumlahnya", (m) => {
    expect(decideFlow(m, withIdeas)).toEqual({ type: "pickOutOfRange", count: 3 });
  });

  it.each(["ide lain dong", "gak ada yang cocok", "yang lain", "kurang sreg", "ganti ide", "ga suka semua"])("%s → ide baru", (m) => {
    expect(type(m, withIdeas)).toBe("suggest");
  });

  it("angka tanpa daftar ide bukan pilihan", () => {
    expect(pickIdea("ide 1", 0)).toBeNull();
    expect(type("1", fresh)).toBeNull();
  });

  it("kalimat panjang yang kebetulan berisi angka bukan pilihan", () => {
    expect(mentionedIdeaNumbers("aku punya 2 kucing dan mau bikin toko makanan kucing yang lengkap banget buat semua orang")).toEqual([]);
  });
});

describe("tahap 1c: menjawab pertanyaan detail", () => {
  it("jawaban detail digabung dengan ide awal lalu dibedah", () => {
    const a = decideFlow("makanan, buat mahasiswa, modal 2 juta", asking);
    expect(a?.type).toBe("analyze");
    expect(a && "brief" in a ? a.brief : "").toContain("mau bikin usaha");
  });
  it("malas jawab dan minta ide → ditawari ide sesuai ide awal", () => {
    expect(type("kasih ide aja deh", asking)).toBe("suggest");
  });
  it("bingung di tengah → penjelasan, bukan dibedah", () => {
    expect(type("maksudnya gimana", asking)).toBe("help");
  });
});

describe("tahap 2-3: membentuk tim", () => {
  it.each(["bentuk tim", "bentuk tim rekomendasi", "bikinin tim dong", "buat tim dulu deh", "bntk tim", "BENTUK TEAM"])("%s setelah dibedah → bentuk tim saran", (m) => {
    expect(type(m, analyzed)).toBe("formRecommended");
  });

  it("bentuk tim tanpa bedah ide → tampilkan kolom ceklis saran umum", () => {
    expect(decideFlow("bentuk tim", fresh)).toEqual({ type: "showPicker", reason: "no-idea" });
    expect(decideFlow("timnya mana ini", fresh)).toEqual({ type: "showPicker", reason: "no-idea" });
  });

  it("pilihan dari tombol ceklis dibentuk persis", () => {
    const msg = pickerMessage(["Tim Founder & Startup", "Tim Developer", "Tim Kreatif"]);
    expect(decideFlow(msg, analyzed)).toEqual({ type: "formTeams", kinds: ["founder", "developer", "creative"] });
  });

  it.each([
    ["tim developer saja", ["developer"]],
    ["bentuk tim marketing sama desain", ["marketing", "creative"]],
    ["tambahin tim riset", ["research"]],
  ])("%s → %j", (m, kinds) => {
    expect(decideFlow(m, analyzed)).toEqual({ type: "formTeams", kinds });
  });

  it("tim yang tidak tersedia dijelaskan, bukan diabaikan", () => {
    expect(decideFlow("bentuk tim hukum", analyzed)).toEqual({ type: "showPicker", reason: "unknown", unknown: "hukum" });
  });
});

describe("setelah tim terbentuk", () => {
  it.each(["timnya mana", "lihat tim", "mana agent-nya"])("%s → daftar tim", (m) => {
    expect(type(m, withTeams)).toBe("listTeams");
  });
  it.each([
    ["hapus tim marketing", ["marketing"]],
    ["gak jadi pakai tim developer", ["developer"]],
    ["buang tim kreatif sama riset", ["creative", "research"]],
  ])("%s → hapus %j", (m, kinds) => {
    expect(decideFlow(m, withTeams)).toEqual({ type: "removeTeams", kinds });
  });
  it.each(["terus ngapain", "lanjut", "next", "udah", "terus gimana", "bingung"])("%s → langkah berikutnya", (m) => {
    expect(type(m, withTeams)).toBe("nextSteps");
  });
  it("tugas biasa ke tim tidak diambil alur ini", () => {
    expect(type("bikin landing page untuk produk ini", withTeams)).toBeNull();
  });
  it("mulai dari awal kapan saja", () => {
    expect(type("mulai dari awal", withTeams)).toBe("reset");
    expect(type("reset", withIdeas)).toBe("reset");
  });
});

describe("gaya bahasa mengikuti user", () => {
  it.each([
    [["gw mau bikin usaha"], "gw"],
    [["IDE STARUP APA NIH YANG OK YA CUY"], "gw"],
    [["Saya ingin membuka usaha"], "saya"],
    [["aku mau bikin aplikasi"], "aku"],
    [["ide 1", "lu kasih ide dong"], "gw"],
    [["ok"], "aku"],
  ] as [string[], string][])("%j → %s", (texts, voice) => {
    expect(detectVoice(texts)).toBe(voice);
  });

  it("pesan memakai sapaan yang sesuai dan tidak bercampur", () => {
    const gw = helpMessage("idea", "gw");
    expect(gw).toMatch(/\blu\b/);
    expect(gw).not.toMatch(/\b(?:kamu|aku|Anda|saya)\b/);
    const saya = helpMessage("idea", "saya");
    expect(saya).toMatch(/\bAnda\b/);
    expect(saya).not.toMatch(/\b(?:kamu|aku|lu|gw)\b/);
    expect(say("{Aku} bantu {kamu}", "aku")).toBe("Aku bantu kamu");
  });
});

describe("pesan tidak memakai simbol/emoji/markdown", () => {
  const noise = /\*\*|#{1,3}\s|`|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  it("semua template bersih", () => {
    const texts = [
      formatIdeas(IDEAS, "gw"),
      formatAnalysis({ title: "X", summary: "Y", strengths: ["a"], weaknesses: ["b"], divisions: [{ name: "Tim Developer", reason: "r" }] }, "saya"),
      teamsFormedMessage({ created: ["Tim Developer"], already: [], withBoard: false }, "aku"),
      nextStepsMessage(["Tim Developer"], "gw"),
      helpMessage("pickTeam", "aku"),
    ];
    for (const t of texts) expect(t).not.toMatch(noise);
  });
});

describe("pendukung", () => {
  it("posisi langkah user", () => {
    expect(stepOf(fresh)).toBe("idea");
    expect(stepOf(withIdeas)).toBe("pickIdea");
    expect(stepOf(asking)).toBe("clarify");
    expect(stepOf(analyzed)).toBe("pickTeam");
    expect(stepOf(withTeams)).toBe("working");
  });
  it("daftar ide dari model diparse", () => {
    expect(parseIdeas('```json\n{"ideas":[{"title":"A","pitch":"B"},{"title":"","pitch":"x"}]}\n```')).toEqual([{ title: "A", pitch: "B" }]);
  });
  it("kolom ceklis: saran di atas & tercentang", () => {
    const p = buildTeamPicker([{ kind: "developer", reason: "r" }, { kind: "founder" }]);
    expect(p.options.slice(0, 2).every((o) => o.recommended)).toBe(true);
    expect(p.options.filter((o) => !o.recommended).length).toBe(5);
  });
  it("kata startup tidak dianggap tim founder", () => {
    expect(chosenDivisions("bentuk tim buat startup gw")).toEqual([]);
    expect(isTeamSetupRequest("bentuk tim buat startup gw")).toBe(true);
    expect(wantsIdeaSuggestions("ide gw: aplikasi kasir")).toBe(false);
  });
});

describe("bedah ulang", () => {
  it("minta bedah ulang memakai ide terakhir", () => {
    expect(decideFlow("bedah ulang", { ...analyzed, lastBrief: "kasir warung" })).toEqual({ type: "analyze", brief: "kasir warung" });
    expect(decideFlow("coba lagi", { ...analyzed, lastBrief: "kasir warung" })).toEqual({ type: "analyze", brief: "kasir warung" });
    expect(decideFlow("bedah ulang", analyzed)).toBeNull();
  });
});
