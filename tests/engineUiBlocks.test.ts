import { describe, expect, it } from "vitest";
import {
  describeAnswer,
  extractBlock,
  normalizeBlock,
  UiBlockError,
  validateAnswer,
} from "@/lib/engine/uiBlocks";
import type { UiBlock } from "@/lib/engine/types";

describe("normalisasi blok", () => {
  it("menerima pilihan berupa string biasa", () => {
    const block = normalizeBlock({ kind: "chips", question: "Warna?", options: ["merah", "biru"] });
    expect(block).toMatchObject({
      kind: "chips",
      options: [
        { value: "merah", label: "merah" },
        { value: "biru", label: "biru" },
      ],
    });
    expect(block.id).toMatch(/^ui-/);
  });

  it("menolak blok tanpa pertanyaan atau dengan jenis asing", () => {
    expect(() => normalizeBlock({ kind: "buttons", options: ["a"] })).toThrow(UiBlockError);
    expect(() => normalizeBlock({ kind: "slider", question: "Berapa?" })).toThrow(/tidak dikenal/);
  });

  it("menolak blok pilihan tanpa opsi dan form tanpa field", () => {
    expect(() => normalizeBlock({ kind: "buttons", question: "Pilih" })).toThrow(/pilihan/);
    expect(() => normalizeBlock({ kind: "form", question: "Isi", fields: [] })).toThrow(/field/);
  });

  it("field choice wajib punya opsi", () => {
    expect(() =>
      normalizeBlock({ kind: "form", question: "Isi", fields: [{ name: "x", type: "choice" }] })
    ).toThrow(UiBlockError);
  });
});

describe("ambil blok dari balasan model", () => {
  it("memisahkan fence vox-ui dari teksnya", () => {
    const reply = [
      "Sebelum lanjut, gw butuh konfirmasi.",
      "```vox-ui",
      JSON.stringify({ kind: "approval", question: "Deploy ke produksi?" }),
      "```",
    ].join("\n");
    const { text, block } = extractBlock(reply);
    expect(text).toBe("Sebelum lanjut, gw butuh konfirmasi.");
    expect(block?.kind).toBe("approval");
  });

  it("fence rusak dibiarkan apa adanya, balasan tidak ikut jatuh", () => {
    const reply = "Oke.\n```vox-ui\n{bukan json}\n```";
    const { text, block } = extractBlock(reply);
    expect(block).toBeNull();
    expect(text).toBe(reply);
  });

  it("teks tanpa fence dikembalikan utuh", () => {
    expect(extractBlock("cuma teks")).toEqual({ text: "cuma teks", block: null });
  });
});

describe("validasi jawaban", () => {
  const buttons: UiBlock = {
    id: "ui-1",
    kind: "buttons",
    question: "Mau lanjut?",
    options: [
      { value: "lanjut", label: "Lanjut" },
      { value: "batal", label: "Batal" },
    ],
  };

  it("menerima pilihan yang ada dan menolak yang tidak ada", () => {
    expect(validateAnswer(buttons, { blockId: "ui-1", value: "lanjut" })).toEqual({
      blockId: "ui-1",
      value: "lanjut",
    });
    expect(() => validateAnswer(buttons, { blockId: "ui-1", value: "ngawur" })).toThrow(UiBlockError);
  });

  it("menolak jawaban milik blok lain", () => {
    expect(() => validateAnswer(buttons, { blockId: "ui-lain", value: "lanjut" })).toThrow(/blok yang lain/);
  });

  it("skip hanya boleh kalau bloknya memang bisa dilewati", () => {
    expect(validateAnswer(buttons, { blockId: "ui-1", skipped: true })).toEqual({
      blockId: "ui-1",
      skipped: true,
    });
    const wajib = { ...buttons, skippable: false };
    expect(() => validateAnswer(wajib, { blockId: "ui-1", skipped: true })).toThrow(/tidak bisa dilewati/);
  });

  it("list multiple menerima beberapa nilai", () => {
    const list = normalizeBlock({
      id: "ui-2",
      kind: "list",
      question: "Divisi mana?",
      multiple: true,
      options: ["desain", "backend", "qa"],
    });
    expect(validateAnswer(list, { blockId: "ui-2", value: ["desain", "qa"] })).toEqual({
      blockId: "ui-2",
      value: ["desain", "qa"],
    });
    expect(() => validateAnswer(list, { blockId: "ui-2", value: ["desain", "hantu"] })).toThrow(
      /hantu/
    );
  });

  it("approval butuh jawaban boolean", () => {
    const approval = normalizeBlock({ id: "ui-3", kind: "approval", question: "Hapus?" });
    expect(validateAnswer(approval, { blockId: "ui-3", value: false })).toEqual({
      blockId: "ui-3",
      value: false,
    });
    expect(() => validateAnswer(approval, { blockId: "ui-3", value: "ya" })).toThrow(/ya\/tidak/);
  });

  it("form memeriksa wajib-isi dan mengubah tipe nilainya", () => {
    const form = normalizeBlock({
      id: "ui-4",
      kind: "form",
      question: "Detail toko",
      fields: [
        { name: "nama", label: "Nama", required: true },
        { name: "cabang", label: "Cabang", type: "number" },
        { name: "aktif", label: "Aktif", type: "boolean" },
        { name: "paket", label: "Paket", type: "choice", options: ["basic", "pro"] },
      ],
    });

    expect(
      validateAnswer(form, {
        blockId: "ui-4",
        value: { nama: "Baju Kita", cabang: "3", aktif: "true", paket: "pro" },
      })
    ).toEqual({ blockId: "ui-4", value: { nama: "Baju Kita", cabang: 3, aktif: true, paket: "pro" } });

    expect(() => validateAnswer(form, { blockId: "ui-4", value: { cabang: 1 } })).toThrow(/Nama/);
    expect(() =>
      validateAnswer(form, { blockId: "ui-4", value: { nama: "x", cabang: "banyak" } })
    ).toThrow(/angka/);
    expect(() =>
      validateAnswer(form, { blockId: "ui-4", value: { nama: "x", paket: "enterprise" } })
    ).toThrow(/basic, pro/);
    expect(() => validateAnswer(form, { blockId: "ui-4", value: "bukan objek" })).toThrow(/objek/);
  });

  it("field opsional yang kosong tidak masuk hasil", () => {
    const form = normalizeBlock({
      id: "ui-5",
      kind: "form",
      question: "Opsional",
      fields: [{ name: "catatan", label: "Catatan" }],
    });
    expect(validateAnswer(form, { blockId: "ui-5", value: { catatan: "" } })).toEqual({
      blockId: "ui-5",
      value: {},
    });
  });
});

describe("ringkasan jawaban buat transkrip", () => {
  const buttons = normalizeBlock({
    id: "ui-6",
    kind: "buttons",
    question: "Mau lanjut?",
    options: [{ value: "lanjut", label: "Lanjut aja" }],
  });

  it("memakai label, bukan value mentah", () => {
    expect(describeAnswer(buttons, { blockId: "ui-6", value: "lanjut" })).toBe("Lanjut aja");
  });

  it("menandai jawaban yang dilewati", () => {
    expect(describeAnswer(buttons, { blockId: "ui-6", skipped: true })).toContain("dilewati");
  });

  it("merangkum approval dan form", () => {
    const approval = normalizeBlock({ id: "ui-7", kind: "approval", question: "Hapus?" });
    expect(describeAnswer(approval, { blockId: "ui-7", value: true })).toBe("Disetujui.");
    const form = normalizeBlock({
      id: "ui-8",
      kind: "form",
      question: "Isi",
      fields: [{ name: "nama", label: "Nama" }],
    });
    expect(describeAnswer(form, { blockId: "ui-8", value: { nama: "Budi" } })).toBe("nama: Budi");
  });
});
