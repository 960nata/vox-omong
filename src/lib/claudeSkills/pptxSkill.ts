import pptxgen from "pptxgenjs";
import { SlideDeckData, SlideItem } from "../types";
import { getTheme, DeckTheme } from "./themes";

// LAYOUT_16x9 = 10 x 5.625 inci. Semua koordinat di bawah dijaga di dalam batas ini.
const W = 10;
const H = 5.625;
const PAD_X = 0.7;

function addMotif(pres: pptxgen, slide: pptxgen.Slide, t: DeckTheme, big: boolean) {
  const S = pres.ShapeType;
  switch (t.motif) {
    case "circle":
      slide.addShape(S.ellipse, { x: W - (big ? 3.4 : 2.0), y: big ? -1.4 : -0.9, w: big ? 4.4 : 2.6, h: big ? 4.4 : 2.6, fill: { color: t.accent }, line: { type: "none" } });
      slide.addShape(S.ellipse, { x: W - 3.2, y: H - 0.6, w: 1.0, h: 1.0, fill: { color: t.accent2 }, line: { type: "none" } });
      break;
    case "bar":
      slide.addShape(S.rect, { x: 0, y: 0, w: big ? 0.32 : 0.12, h: H, fill: { color: t.accent }, line: { type: "none" } });
      break;
    case "rule":
      slide.addShape(S.rect, { x: PAD_X, y: 0.42, w: W - PAD_X * 2, h: 0.025, fill: { color: t.text }, line: { type: "none" } });
      slide.addShape(S.rect, { x: PAD_X, y: H - 0.35, w: W - PAD_X * 2, h: 0.012, fill: { color: t.text }, line: { type: "none" } });
      if (big) slide.addShape(S.rect, { x: W - PAD_X - 0.3, y: 0.55, w: 0.3, h: 0.3, fill: { color: t.accent }, line: { type: "none" } });
      break;
    case "blob":
      slide.addShape(S.ellipse, { x: W - (big ? 3.6 : 2.4), y: H - (big ? 2.8 : 1.8), w: big ? 5 : 2.9, h: big ? 5 : 2.9, fill: { color: t.accent, transparency: 15 }, line: { type: "none" } });
      break;
    case "frame":
      slide.addShape(S.rect, { x: 0.22, y: 0.22, w: W - 0.44, h: H - 0.44, fill: { type: "none" } as never, line: { color: t.accent, width: 1.25 } });
      break;
    case "grid":
      for (let i = 1; i < 10; i++) {
        slide.addShape(S.line, { x: W * 0.55 + i * 0.5, y: 0, w: 0, h: H * 0.55, line: { color: t.accent, width: 0.5, transparency: 80 } });
      }
      break;
    case "dots":
    default:
      slide.addShape(S.ellipse, { x: W - (big ? 3.4 : 2.2), y: big ? -0.8 : -0.6, w: big ? 3.6 : 2.4, h: big ? 4.4 : 2.9, fill: { color: t.surface }, line: { color: t.text, width: 0.75, transparency: 80 } });
      slide.addShape(S.ellipse, { x: W - (big ? 2.2 : 1.45), y: big ? 1.3 : 0.75, w: big ? 1.2 : 0.8, h: big ? 1.2 : 0.8, fill: { color: t.accent }, line: { type: "none" } });
      break;
  }
}

function kicker(slide: pptxgen.Slide, t: DeckTheme, text: string) {
  slide.addText(text.toUpperCase(), {
    x: PAD_X, y: 0.5, w: 6.5, h: 0.3,
    fontFace: "Courier New", fontSize: 9, bold: true, color: t.accent, charSpacing: 3, margin: 0,
  });
}

function titleText(t: DeckTheme, s: string) {
  return t.titleCase === "upper" ? s.toUpperCase() : s;
}

/** Unduh foto slide di browser lalu ubah jadi data URL supaya PowerPoint menyimpannya di dalam file. Gagal = slide tanpa foto. */
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function loadPhotos(deck: SlideDeckData) {
  const out = new Map<number, string>();
  await Promise.all(
    deck.slides.map(async (s, i) => {
      if (!s.image) return;
      const layout = s.layout || (i === 0 ? "cover" : i === deck.slides.length - 1 ? "closing" : "bullets");
      const data = await toDataUrl(layout === "cover" || layout === "closing" ? s.image.url : s.image.small);
      if (data) out.set(i, data);
    })
  );
  return out;
}

function renderSlide(pres: pptxgen, deck: SlideDeckData, s: SlideItem, idx: number, t: DeckTheme, photo?: string) {
  const total = deck.slides.length;
  const rawLayout = s.layout || (idx === 0 ? "cover" : idx === total - 1 ? "closing" : "bullets");
  const layout = rawLayout === "image" && !photo ? "bullets" : rawLayout;
  const bg = layout === "cover" || layout === "closing";
  const slide = pres.addSlide();
  slide.background = { color: t.bg };
  if (photo && bg) {
    slide.addImage({ data: photo, x: 0, y: 0, w: W, h: H, sizing: { type: "cover", w: W, h: H } });
    slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W * 0.62, h: H, fill: { color: t.bg, transparency: 6 }, line: { type: "none" } });
    slide.addShape(pres.ShapeType.rect, { x: W * 0.62, y: 0, w: W * 0.38, h: H, fill: { color: t.bg, transparency: 55 }, line: { type: "none" } });
  } else {
    addMotif(pres, slide, t, bg);
  }
  const sideW = layout === "image" ? W * 0.4 : W * 0.3;
  if (photo && (layout === "image" || layout === "bullets")) {
    slide.addImage({ data: photo, x: W - sideW, y: 0, w: sideW, h: H, sizing: { type: "cover", w: sideW, h: H } });
  }
  if (photo && s.image) {
    slide.addText(`Foto: ${s.image.author} / Unsplash`, { x: W - 3.2, y: H - 0.28, w: 3.0, h: 0.2, fontSize: 7, color: "FFFFFF", align: "right", margin: 0, transparency: 25 });
  }
  kicker(slide, t, s.kicker || (layout === "cover" ? deck.deckTitle : `${String(idx + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`));

  const display = { fontFace: t.displayFont, color: t.text, bold: true, margin: 0 } as const;
  const body = { fontFace: t.bodyFont, color: t.muted, margin: 0 } as const;

  switch (layout) {
    case "cover":
      slide.addText(titleText(t, s.title), { ...display, x: PAD_X, y: 1.5, w: 6.6, h: 2.0, fontSize: 40, valign: "bottom", fit: "shrink" });
      if (s.subtitle || s.bullets[0]) slide.addText(s.subtitle || s.bullets[0], { ...body, x: PAD_X, y: 3.7, w: 6.2, h: 0.9, fontSize: 15, valign: "top" });
      break;
    case "closing":
      slide.addText(titleText(t, s.title), { ...display, x: PAD_X, y: 1.6, w: 7.2, h: 1.6, fontSize: 36, valign: "bottom", fit: "shrink" });
      if (s.subtitle || s.bullets.length) slide.addText(s.subtitle || s.bullets.join(" · "), { ...body, x: PAD_X, y: 3.35, w: 6.6, h: 0.8, fontSize: 14 });
      slide.addShape(pres.ShapeType.roundRect, { x: PAD_X, y: 4.35, w: 1.2, h: 0.06, fill: { color: t.accent }, line: { type: "none" }, rectRadius: 0.03 });
      break;
    case "stat":
      slide.addText(s.stat?.value || "—", { fontFace: t.displayFont, color: t.accent, bold: true, x: PAD_X, y: 1.3, w: 4.3, h: 2.6, fontSize: 88, valign: "middle", fit: "shrink", margin: 0 });
      slide.addText(titleText(t, s.title), { ...display, x: 5.2, y: 1.6, w: 4.2, h: 1.1, fontSize: 22, valign: "bottom", fit: "shrink" });
      slide.addText(s.stat?.label || s.subtitle || s.bullets[0] || "", { ...body, x: 5.2, y: 2.8, w: 4.1, h: 1.2, fontSize: 13, valign: "top" });
      break;
    case "quote":
      slide.addText("“", { fontFace: t.displayFont, color: t.accent, x: PAD_X - 0.05, y: 0.9, w: 1.2, h: 1.1, fontSize: 96, margin: 0 });
      slide.addText(s.quote?.text || s.title, { fontFace: t.displayFont, color: t.text, x: PAD_X, y: 1.8, w: 8.2, h: 2.2, fontSize: 26, italic: true, valign: "middle", fit: "shrink", margin: 0 });
      if (s.quote?.author || s.subtitle) slide.addText(`— ${s.quote?.author || s.subtitle}`, { ...body, x: PAD_X, y: 4.15, w: 7, h: 0.4, fontSize: 12 });
      break;
    case "split": {
      slide.addText(titleText(t, s.title), { ...display, x: PAD_X, y: 0.95, w: 8.4, h: 0.75, fontSize: 24, fit: "shrink" });
      const cols = [
        { head: s.columns?.leftTitle, items: s.columns?.left || s.bullets.slice(0, 2), fill: t.surface, fg: t.text },
        { head: s.columns?.rightTitle, items: s.columns?.right || s.bullets.slice(2), fill: t.accent, fg: t.bg },
      ];
      cols.forEach((col, i) => {
        const x = PAD_X + i * 4.35;
        slide.addShape(pres.ShapeType.roundRect, { x, y: 1.95, w: 4.15, h: 3.1, fill: { color: col.fill }, line: { type: "none" }, rectRadius: 0.12 });
        const runs: pptxgen.TextProps[] = [];
        if (col.head) runs.push({ text: col.head, options: { fontFace: t.displayFont, bold: true, fontSize: 15, color: col.fg, breakLine: true, paraSpaceAfter: 8 } });
        col.items.forEach((it) => runs.push({ text: it, options: { fontFace: t.bodyFont, fontSize: 12, color: col.fg, bullet: { indent: 14 }, breakLine: true, paraSpaceAfter: 4 } }));
        slide.addText(runs, { x: x + 0.25, y: 2.15, w: 3.65, h: 2.7, valign: "top", margin: 0, fit: "shrink" });
      });
      break;
    }
    case "image": {
      const tw = W - sideW - PAD_X - 0.4;
      slide.addText(titleText(t, s.title), { ...display, x: PAD_X, y: 0.95, w: tw, h: 0.95, fontSize: 24, fit: "shrink" });
      const runs: pptxgen.TextProps[] = [];
      if (s.subtitle) runs.push({ text: s.subtitle, options: { fontFace: t.bodyFont, color: t.muted, fontSize: 12, breakLine: true, paraSpaceAfter: 10 } });
      s.bullets.forEach((b, i) => {
        runs.push({ text: `${String(i + 1).padStart(2, "0")}   `, options: { fontFace: t.displayFont, color: t.accent, bold: true, fontSize: 14 } });
        runs.push({ text: b, options: { fontFace: t.bodyFont, color: t.text, fontSize: 13, breakLine: true, paraSpaceAfter: 10 } });
      });
      slide.addText(runs, { x: PAD_X, y: 2.0, w: tw, h: 3.1, valign: "top", margin: 0, fit: "shrink" });
      break;
    }
    case "steps": {
      slide.addText(titleText(t, s.title), { ...display, x: PAD_X, y: 0.95, w: 8.4, h: 0.85, fontSize: 24, fit: "shrink" });
      const items = s.bullets.slice(0, 5);
      const gap = 0.18;
      const cw = (W - PAD_X * 2 - gap * (items.length - 1)) / Math.max(items.length, 1);
      items.forEach((b, i) => {
        const [head, ...rest] = b.split(/:\s+/);
        const x = PAD_X + i * (cw + gap);
        slide.addShape(pres.ShapeType.roundRect, { x, y: 2.0, w: cw, h: 2.9, fill: { color: t.surface }, line: { type: "none" }, rectRadius: 0.1 });
        slide.addShape(pres.ShapeType.rect, { x, y: 2.0, w: cw, h: 0.07, fill: { color: t.accent }, line: { type: "none" } });
        slide.addText(String(i + 1).padStart(2, "0"), { fontFace: t.displayFont, color: t.accent, bold: true, x: x + 0.18, y: 2.2, w: cw - 0.36, h: 0.55, fontSize: 24, margin: 0 });
        slide.addText(rest.length ? head : b, { fontFace: t.displayFont, color: t.text, bold: true, x: x + 0.18, y: 2.85, w: cw - 0.36, h: 0.7, fontSize: 13, valign: "top", fit: "shrink", margin: 0 });
        if (rest.length) slide.addText(rest.join(": "), { fontFace: t.bodyFont, color: t.muted, x: x + 0.18, y: 3.55, w: cw - 0.36, h: 1.2, fontSize: 10.5, valign: "top", fit: "shrink", margin: 0 });
      });
      break;
    }
    case "bullets":
    default: {
      const bw = photo ? W - sideW - PAD_X - 0.4 : 8.0;
      slide.addText(titleText(t, s.title), { ...display, x: PAD_X, y: 0.95, w: photo ? bw : 7.6, h: 0.95, fontSize: 26, fit: "shrink" });
      const runs: pptxgen.TextProps[] = [];
      s.bullets.forEach((b, i) => {
        runs.push({ text: `${String(i + 1).padStart(2, "0")}   `, options: { fontFace: t.displayFont, color: t.accent, bold: true, fontSize: 16 } });
        runs.push({ text: b, options: { fontFace: t.bodyFont, color: t.text, fontSize: 15, breakLine: true, paraSpaceAfter: 12 } });
      });
      slide.addText(runs, { x: PAD_X, y: 2.1, w: bw, h: 3.0, valign: "top", margin: 0, fit: "shrink" });
      break;
    }
  }

  if (s.speakerNotes) slide.addNotes(s.speakerNotes);
}

export async function exportToPptxFile(deck: SlideDeckData) {
  if (typeof window === "undefined") return;
  const t = getTheme(deck.theme);
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = deck.deckTitle;
  pres.author = "VOX·AI Studio";

  const photos = await loadPhotos(deck);
  deck.slides.forEach((s, idx) => renderSlide(pres, deck, s, idx, t, photos.get(idx)));

  const filename = `${deck.deckTitle.replace(/[^a-zA-Z0-9_-]+/g, "_")}.pptx`;
  await pres.writeFile({ fileName: filename });
}
