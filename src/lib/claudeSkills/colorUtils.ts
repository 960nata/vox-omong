/** Utilitas warna (tanpa dependensi server, aman dipakai di browser). Rasio kontras mengikuti WCAG. */
const rgb = (h: string): [number, number, number] => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
const toHex = (r: number, g: number, b: number) => [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();

export function luminance(h: string): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(h);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function toHsl(h: string): [number, number, number] {
  const [r, g, b] = rgb(h).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  return [hue, s, l];
}
export function fromHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** Geser terang/gelapnya `fg` (warna & kejenuhan dijaga) sampai kontras terhadap SEMUA `bgs` memenuhi `min`. */
export function ensureContrast(fg: string, bgs: string[], min: number): string {
  const ok = (c: string) => bgs.every((b) => contrast(c, b) >= min);
  if (ok(fg)) return fg;
  const [h, s, l] = toHsl(fg);
  const avgBgLum = bgs.reduce((a, b) => a + luminance(b), 0) / bgs.length;
  const dir = avgBgLum < 0.4 ? 1 : -1; // latar gelap -> terangkan; latar terang -> gelapkan
  for (let step = 1; step <= 40; step++) {
    const c = fromHsl(h, s, Math.max(0, Math.min(1, l + (dir * step) / 40)));
    if (ok(c)) return c;
  }
  return dir > 0 ? "FFFFFF" : "000000";
}

