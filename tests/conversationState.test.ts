import { describe, expect, it } from "vitest";
import { deriveState, focusOf, MAX_IDLE_REPLIES, nextState, stateOf } from "../src/lib/conversationState";
import { isDeckMessage, isDocFollowUp } from "../src/lib/deckFlow";
import type { ArtifactItem } from "../src/lib/types";

const deck = { id: "a", type: "slides", title: "Deck", slides: { title: "x", slides: [] } } as unknown as ArtifactItem;
const doc = { id: "b", type: "pdf_document", title: "Doc", pdfContent: "# isi" } as ArtifactItem;
const site = { id: "c", type: "website", title: "Web" } as ArtifactItem;

describe("state percakapan tersimpan", () => {
  it("fokus mengikuti artefak terakhir", () => {
    expect(focusOf(deck)).toBe("slides");
    expect(focusOf(doc)).toBe("document");
    expect(focusOf(site)).toBe("other");
    expect(focusOf(undefined)).toBeNull();
  });

  it("artefak baru mengganti fokus dan menyimpan id pesannya", () => {
    let s = nextState(undefined, deck, "m1");
    expect(s).toMatchObject({ focus: "slides", artifactMessageId: "m1", idleReplies: 0 });
    s = nextState(s, doc, "m2");
    expect(s).toMatchObject({ focus: "document", artifactMessageId: "m2" });
    s = nextState(s, site, "m3");
    expect(s.focus).toBe("other");
  });

  it("obrolan sampingan tidak langsung menghapus fokus, tapi fokus kedaluwarsa setelah batas", () => {
    let s = nextState(undefined, deck, "m1");
    for (let i = 1; i < MAX_IDLE_REPLIES; i++) {
      s = nextState(s, undefined, `c${i}`);
      expect(s.focus).toBe("slides");
      expect(s.artifactMessageId).toBe("m1");
    }
    s = nextState(s, undefined, "last");
    expect(s.focus).toBeNull();
  });

  it("percakapan lama tanpa state diturunkan dari riwayat", () => {
    const messages = [
      { id: "u1", role: "user" as const },
      { id: "a1", role: "assistant" as const, artifact: deck },
      { id: "u2", role: "user" as const },
      { id: "a2", role: "assistant" as const },
    ];
    expect(deriveState(messages)).toMatchObject({ focus: "slides", artifactMessageId: "a1", idleReplies: 1 });
    expect(stateOf({ messages, state: { focus: "document", artifactMessageId: "x", idleReplies: 0 } }).focus).toBe("document");
    expect(stateOf(null).focus).toBeNull();
  });
});

describe("deteksi lanjutan memakai fokus, bukan tebakan riwayat", () => {
  it("revisi tanpa kata kunci masuk ke deck hanya kalau fokusnya deck", () => {
    expect(isDeckMessage("kasih gambar yang lebih banyak", "slides")).toBe(true);
    expect(isDeckMessage("kasih gambar yang lebih banyak", "document")).toBe(false);
    expect(isDeckMessage("kasih gambar yang lebih banyak", null)).toBe(false);
    expect(isDeckMessage("bikin presentasi tentang kopi", null)).toBe(true);
    expect(isDeckMessage("ganti warna website jadi biru", "slides")).toBe(false);
  });

  it("revisi dokumen hanya kalau fokusnya dokumen", () => {
    expect(isDocFollowUp("tambahin bagian risiko", "document")).toBe(true);
    expect(isDocFollowUp("tambahin bagian risiko", "slides")).toBe(false);
    expect(isDocFollowUp("tambahin slide risiko", "document")).toBe(false);
  });
});

describe("state tersimpan lewat storage", () => {
  it("addMessage menulis state bersama pesan asisten", async () => {
    const { mkdtemp, readFile } = await import("fs/promises");
    const { tmpdir } = await import("os");
    const path = await import("path");
    const { vi } = await import("vitest");
    const dir = await mkdtemp(path.join(tmpdir(), "vox-state-"));
    const spy = vi.spyOn(process, "cwd").mockReturnValue(dir);
    vi.resetModules();
    const storage = await import("../src/lib/storage");
    try {
      await storage.addMessage("conv-t", { role: "user", content: "bikin presentasi kopi" });
      const a = await storage.addMessage("conv-t", { role: "assistant", content: "ini deck-nya", artifact: deck });
      await storage.addMessage("conv-t", { role: "user", content: "apa itu arabika?" });
      await storage.addMessage("conv-t", { role: "assistant", content: "jenis kopi" });
      const raw = JSON.parse(await readFile(path.join(dir, ".data", "conversations.json"), "utf-8"));
      const conv = raw.conversations.find((c: { id: string }) => c.id === "conv-t");
      expect(conv.state).toMatchObject({ focus: "slides", artifactMessageId: a.id, idleReplies: 1 });
    } finally {
      spy.mockRestore();
    }
  });
});
