import { SlideDeckData, SlideItem } from "../types";
import { getTheme } from "./themes";

const VW = 1280;
const VH = 720;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function ease(frame: number, start: number, len = 12) {
  const x = Math.min(1, Math.max(0, (frame - start) / len));
  return 1 - Math.pow(1 - x, 3);
}

/** Muat foto slide untuk video. Gagal (CORS/jaringan) = slide tanpa foto; canvas tidak ikut tercemar. */
async function loadPhoto(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const r = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / r;
  const sh = h / r;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

/** Gambar satu frame slide bertema dengan animasi masuk bertahap. */
function drawSlideFrame(
  ctx: CanvasRenderingContext2D,
  deck: SlideDeckData,
  s: SlideItem,
  idx: number,
  frame: number,
  progressInSlide: number,
  photo?: HTMLImageElement | null
) {
  const t = getTheme(deck.theme);
  const c = (h: string) => `#${h}`;
  const total = deck.slides.length;
  const rawLayout = s.layout || (idx === 0 ? "cover" : idx === total - 1 ? "closing" : "bullets");
  const layout = rawLayout === "image" && !photo ? "bullets" : rawLayout;
  const bgPhoto = !!photo && (layout === "cover" || layout === "closing");
  const sideW = photo && (layout === "image" || layout === "bullets") ? Math.round(VW * (layout === "image" ? 0.4 : 0.3)) : 0;
  const textMax = VW - 90 - sideW - 60;
  const X = 90;

  ctx.globalAlpha = 1;
  ctx.fillStyle = c(t.bg);
  ctx.fillRect(0, 0, VW, VH);

  if (bgPhoto && photo) {
    // foto penuh dengan zoom pelan + lapisan warna tema supaya teks tetap terbaca
    const z = 1 + progressInSlide * 0.05;
    ctx.save();
    ctx.translate(VW / 2, VH / 2);
    ctx.scale(z, z);
    ctx.translate(-VW / 2, -VH / 2);
    drawCover(ctx, photo, 0, 0, VW, VH);
    ctx.restore();
    const g = ctx.createLinearGradient(0, 0, VW, 0);
    g.addColorStop(0, `${c(t.bg)}f5`);
    g.addColorStop(0.42, `${c(t.bg)}e0`);
    g.addColorStop(1, `${c(t.bg)}55`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
  } else {
    // ornamen yang bergerak pelan
    const drift = progressInSlide * 30;
    ctx.fillStyle = c(t.accent);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(VW - 120 + drift * 0.3, 90 - drift * 0.2, layout === "cover" ? 230 : 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (sideW && photo) drawCover(ctx, photo, VW - sideW, 0, sideW, VH);

  const text = (str: string, font: string, color: string, x: number, y: number, maxW: number, lh: number, start: number) => {
    const a = ease(frame, start);
    ctx.globalAlpha = a;
    ctx.font = font;
    ctx.fillStyle = color;
    const lines = wrap(ctx, str, maxW);
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh + (1 - a) * 18));
    ctx.globalAlpha = 1;
    return lines.length * lh;
  };

  const up = (str: string) => (t.titleCase === "upper" ? str.toUpperCase() : str);
  text((s.kicker || (layout === "cover" ? deck.deckTitle : `${idx + 1} / ${total}`)).toUpperCase(), "bold 16px 'Courier New', monospace", c(t.accent), X, 90, 800, 20, 0);

  const display = (px: number) => `bold ${px}px ${t.cssDisplay}`;
  const body = (px: number) => `${px}px ${t.cssBody}`;

  if (layout === "cover" || layout === "closing") {
    const h = text(up(s.title), display(68), c(t.text), X, 300, 860, 76, 4);
    text(s.subtitle || s.bullets.join(" · "), body(26), c(t.muted), X, 300 + h + 20, 820, 36, 14);
  } else if (layout === "stat") {
    text(s.stat?.value || "—", display(170), c(t.accent), X, 420, 560, 170, 4);
    const h = text(up(s.title), display(38), c(t.text), 680, 300, 520, 46, 12);
    text(s.stat?.label || s.subtitle || "", body(24), c(t.muted), 680, 300 + h + 16, 500, 32, 20);
  } else if (layout === "quote") {
    text("“", display(160), c(t.accent), X - 6, 290, 200, 160, 0);
    const h = text(s.quote?.text || s.title, `italic ${display(44)}`, c(t.text), X, 300, 1040, 56, 6);
    if (s.quote?.author) text(`— ${s.quote.author}`, body(24), c(t.muted), X, 330 + h, 800, 30, 18);
  } else if (layout === "split") {
    text(up(s.title), display(46), c(t.text), X, 180, 1060, 54, 2);
    const cols = [
      { head: s.columns?.leftTitle || "", items: s.columns?.left || s.bullets.slice(0, 2), bg: t.surface, fg: t.text },
      { head: s.columns?.rightTitle || "", items: s.columns?.right || s.bullets.slice(2), bg: t.accent, fg: t.bg },
    ];
    cols.forEach((col, i) => {
      const x = X + i * 560;
      const a = ease(frame, 10 + i * 8);
      ctx.globalAlpha = a;
      ctx.fillStyle = c(col.bg);
      ctx.beginPath();
      ctx.roundRect(x, 250 + (1 - a) * 20, 530, 380, 22);
      ctx.fill();
      ctx.globalAlpha = 1;
      let y = 310;
      if (col.head) y += text(col.head, display(28), c(col.fg), x + 32, y, 470, 34, 12 + i * 8) + 10;
      col.items.forEach((it, k) => {
        y += text(`•  ${it}`, body(22), c(col.fg), x + 32, y, 466, 30, 18 + i * 8 + k * 6) + 10;
      });
    });
  } else if (layout === "steps") {
    text(up(s.title), display(46), c(t.text), X, 180, 1060, 54, 2);
    const items = s.bullets.slice(0, 5);
    const gap = 20;
    const cw = (VW - X * 2 - gap * (items.length - 1)) / Math.max(items.length, 1);
    items.forEach((b, i) => {
      const [head, ...rest] = b.split(/:\s+/);
      const x = X + i * (cw + gap);
      const a = ease(frame, 10 + i * 8);
      ctx.globalAlpha = a;
      ctx.fillStyle = c(t.surface);
      ctx.beginPath();
      ctx.roundRect(x, 270 + (1 - a) * 20, cw, 340, 18);
      ctx.fill();
      ctx.fillStyle = c(t.accent);
      ctx.fillRect(x, 270 + (1 - a) * 20, cw, 6);
      ctx.globalAlpha = 1;
      text(String(i + 1).padStart(2, "0"), display(40), c(t.accent), x + 22, 310, cw - 44, 44, 12 + i * 8);
      const hh = text(rest.length ? head : b, display(22), c(t.text), x + 22, 372, cw - 44, 28, 16 + i * 8);
      if (rest.length) text(rest.join(": "), body(18), c(t.muted), x + 22, 372 + hh + 12, cw - 44, 24, 22 + i * 8);
    });
  } else {
    text(up(s.title), display(50), c(t.text), X, 190, Math.min(1000, textMax), 58, 2);
    let y = 300;
    s.bullets.forEach((b, k) => {
      const start = 12 + k * 14;
      text(String(k + 1).padStart(2, "0"), display(30), c(t.accent), X, y, 80, 34, start);
      y += Math.max(text(b, body(27), c(t.text), X + 80, y, Math.min(960, textMax - 80), 36, start), 36) + 22;
    });
  }

  // progress bar
  ctx.fillStyle = c(t.accent);
  ctx.fillRect(0, VH - 8, VW * ((idx + progressInSlide) / total), 8);
}

export interface VideoRenderOptions {
  fps?: number;
  slideDurationSec?: number;
  onProgress?: (progressPercent: number, currentSlide: number, totalSlides: number) => void;
}

export async function renderSlideDeckToVideo(
  deck: SlideDeckData,
  options: VideoRenderOptions = {}
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("Video rendering is only supported in browser environments.");
  }

  const fps = options.fps || 30;
  const slideDurationSec = options.slideDurationSec || 3.5;
  const totalSlides = deck.slides.length;
  const totalFramesPerSlide = Math.floor(fps * slideDurationSec);

  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize 2D canvas context");

  const stream = canvas.captureStream(fps);
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
  } catch {
    recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const recordPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      resolve(blob);
    };
  });

  const photos = await Promise.all(
    deck.slides.map((sl, i) => {
      if (!sl.image) return Promise.resolve(null);
      const l = sl.layout || (i === 0 ? "cover" : i === totalSlides - 1 ? "closing" : "bullets");
      return loadPhoto(l === "cover" || l === "closing" ? sl.image.url : sl.image.small);
    })
  );

  recorder.start();

  for (let sIdx = 0; sIdx < totalSlides; sIdx++) {
    const slide = deck.slides[sIdx];

    for (let frame = 0; frame < totalFramesPerSlide; frame++) {
      const progressInSlide = frame / totalFramesPerSlide;

      drawSlideFrame(ctx, deck, slide, sIdx, frame, progressInSlide, photos[sIdx]);

      await new Promise((r) => setTimeout(r, 1000 / fps));
    }

    if (options.onProgress) {
      const pct = Math.round(((sIdx + 1) / totalSlides) * 100);
      options.onProgress(pct, sIdx + 1, totalSlides);
    }
  }

  recorder.stop();
  return await recordPromise;
}
