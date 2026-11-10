import { SITE_CSS, SITE_JS } from "./siteTemplates";
import type { Photo, Video } from "./media";

/**
 * Perakit website: model hanya menulis ISI (SiteSpec, JSON pendek); tampilan dirakit dari komponen
 * yang sudah didesain. Hasilnya konsisten bagus, responsif, dan fiturnya (keranjang, filter, FAQ,
 * lightbox, form tersimpan, video) selalu jalan karena kodenya dari kita, bukan dari model.
 */

// ---------------------------------------------------------------- tipe

export type StyleKey = "editorial" | "bold" | "soft" | "luxury" | "tech" | "playful" | "clean" | "vintage";
export type RadiusKey = "sharp" | "soft" | "round";

export interface SiteTheme {
  style: StyleKey;
  radius: RadiusKey;
  dark: boolean;
  display: string;
  body: string;
  mono?: string;
  fontsLink: string;
  colors: { bg: string; ink: string; accent: string; accent2: string; surface?: string };
}

export interface Cta {
  label: string;
  href?: string;
}

export type Section =
  | { type: "hero"; variant?: "split" | "full" | "center"; eyebrow?: string; title: string; subtitle?: string; cta?: Cta; cta2?: Cta; image?: string; badge?: string; badgeNote?: string; stats?: { value: string; label: string }[] }
  | { type: "marquee"; items: string[] }
  | { type: "features"; title: string; eyebrow?: string; subtitle?: string; navLabel?: string; items: { icon?: string; title: string; text: string }[] }
  | { type: "products"; title: string; eyebrow?: string; subtitle?: string; navLabel?: string; cart?: boolean; items: { name: string; desc?: string; price?: number; category?: string; image?: string; tag?: string }[] }
  | { type: "gallery"; title: string; eyebrow?: string; subtitle?: string; navLabel?: string; image?: string }
  | { type: "about"; title: string; eyebrow?: string; text: string[]; image?: string; points?: string[]; flip?: boolean; navLabel?: string }
  | { type: "steps"; title: string; eyebrow?: string; subtitle?: string; navLabel?: string; items: { title: string; text: string }[] }
  | { type: "stats"; items: { value: string; label: string }[] }
  | { type: "testimonials"; title: string; eyebrow?: string; subtitle?: string; navLabel?: string; items: { quote: string; name: string; role?: string }[] }
  | { type: "pricing"; title: string; eyebrow?: string; subtitle?: string; navLabel?: string; plans: { name: string; price: string; period?: string; features: string[]; highlight?: boolean; cta?: string }[] }
  | { type: "faq"; title: string; eyebrow?: string; subtitle?: string; navLabel?: string; items: { q: string; a: string }[] }
  | { type: "video"; title: string; eyebrow?: string; subtitle?: string; navLabel?: string }
  | { type: "contact"; title: string; eyebrow?: string; subtitle?: string; navLabel?: string; address?: string; hours?: { day: string; time: string }[]; phone?: string; email?: string; form?: FormSpec }
  | { type: "form"; title: string; eyebrow?: string; subtitle?: string; navLabel?: string; form: FormSpec }
  | { type: "cta"; title: string; text?: string; cta: Cta };

export interface FormSpec {
  kind: "reservasi" | "kontak" | "daftar" | "pesan";
  collection?: string;
  button?: string;
}

export interface SiteSpec {
  brand: string;
  tagline?: string;
  description?: string;
  kind: string;
  whatsapp?: string;
  theme: SiteTheme;
  /** kunci → kata kunci pencarian foto (bahasa Inggris) */
  images: Record<string, string>;
  sections: Section[];
}

export interface SiteMedia {
  photos: Record<string, Photo[]>;
  video?: Video;
}

// ---------------------------------------------------------------- util

export const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Escape, lalu *kata* → <em>kata</em> (aksen warna pada judul). */
export const rich = (s: unknown) => esc(s).replace(/\*([^*\n]{1,48})\*/g, "<em>$1</em>");

function hex(h: string) {
  const n = parseInt(h.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex(r: number, g: number, b: number) {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function mix(a: string, b: string, t: number) {
  const x = hex(a);
  const y = hex(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
export function lum(h: string) {
  const [r, g, b] = hex(h);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
export const onColor = (h: string) => (lum(h) > 0.56 ? "#0c0c0c" : "#ffffff");

const ICONS: Record<string, string> = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8L12 3.5z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19c3-5 6-8 10-10"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>',
  phone: '<path d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5L16 13l4 1.5v3a2 2 0 0 1-2 2A14 14 0 0 1 4.5 6a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  users: '<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="10" r="2.5"/><path d="M16 14.5a4.5 4.5 0 0 1 4.5 4.5"/>',
  bolt: '<path d="M13 3L5 13.5h6L10 21l9-11h-6.2L13 3z"/>',
  shield: '<path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-2.5z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  sparkle: '<path d="M12 3.5l1.8 5.2L19 10.5l-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8L12 3.5z"/><path d="M18.5 16.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6z"/>',
  truck: '<path d="M3.5 6.5h10v9h-10zM13.5 9.5h4l3 3v3h-7z"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
  cup: '<path d="M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8z"/><path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3.5c0 1.2 1 1.2 1 2.4M12 3.5c0 1.2 1 1.2 1 2.4"/>',
  camera: '<path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v10H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
  book: '<path d="M5 5.5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2v-15z"/><path d="M5 18.5a2 2 0 0 1 2-2h12"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17"/>',
  chat: '<path d="M5 5.5h14v10H11l-4 3.5v-3.5H5z"/>',
  code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
  gift: '<path d="M4.5 9h15v10.5h-15zM3.5 9h17M12 9v10.5"/><path d="M12 9C10 5.5 7 5.5 7 7.2S10 9 12 9zM12 9c2-3.5 5-3.5 5-1.8S14 9 12 9z"/>',
  flower: '<circle cx="12" cy="12" r="2.2"/><path d="M12 9.8C10.5 6 12 3.5 12 3.5s1.5 2.5 0 6.3M14.2 12c3.8-1.5 6.3 0 6.3 0s-2.5 1.5-6.3 0M12 14.2c1.5 3.8 0 6.3 0 6.3s-1.5-2.5 0-6.3M9.8 12C6 13.5 3.5 12 3.5 12s2.5-1.5 6.3 0"/>',
  bag: '<path d="M5.5 8h13l-1 11.5h-11z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  cart: '<path d="M3.5 4.5h2.2l1.9 10h9.4l1.9-7.2H7"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/>',
};
export const ICON_NAMES = Object.keys(ICONS).filter((k) => !["arrow", "plus", "x", "play", "cart", "check"].includes(k));

function icon(name: string | undefined, extra = "") {
  const body = ICONS[name || ""] || ICONS.sparkle;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;
}

const idr = (n: number) => "Rp " + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// ---------------------------------------------------------------- foto

function photo(media: SiteMedia, key: string | undefined, i = 0): Photo | undefined {
  if (!key) return undefined;
  const list = media.photos[key];
  if (list?.length) return list[i % list.length];
  return undefined;
}

function anyPhoto(media: SiteMedia, i = 0): Photo | undefined {
  const all = Object.values(media.photos).flat();
  return all.length ? all[i % all.length] : undefined;
}

function img(p: Photo | undefined, opt: { eager?: boolean; w?: number; small?: boolean } = {}) {
  if (!p) return "";
  const src = opt.small ? p.small : p.url;
  return `<img src="${esc(src)}" alt="${esc(p.alt)}" ${opt.eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="${p.width > p.height ? 1600 : 1200}" height="${p.width > p.height ? 1066 : 1600}" style="background:${esc(p.color)}">`;
}

// ---------------------------------------------------------------- bagian

let uid = 0;
const rv = (i = 0) => `class="rv" style="--d:${Math.min(i, 8) * 70}ms"`;

function head(eyebrow: string | undefined, title: string, sub: string | undefined, center = false) {
  return `<div class="sec-head ${center ? "center" : ""} rv">${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ""}<h2>${rich(title)}</h2>${sub ? `<p class="lead">${esc(sub)}</p>` : ""}</div>`;
}

function sid(prefix: string) {
  return `${prefix}-${++uid}`;
}

function renderHero(s: Extract<Section, { type: "hero" }>, media: SiteMedia, spec: SiteSpec): string {
  const p = photo(media, s.image) || anyPhoto(media, 0);
  let variant = s.variant || "split";
  if (!p && variant !== "center") variant = "center";
  const ctas = `<div class="cta-row">${s.cta ? `<a class="btn btn-primary" href="${esc(s.cta.href || "#kontak")}">${esc(s.cta.label)}${icon("arrow")}</a>` : ""}${s.cta2 ? `<a class="btn btn-ghost" href="${esc(s.cta2.href || "#tentang")}">${esc(s.cta2.label)}</a>` : ""}</div>`;
  const stats = s.stats?.length ? `<div class="hero-stats rv" style="--d:300ms">${s.stats.slice(0, 3).map((x) => `<div><b>${esc(x.value)}</b><span>${esc(x.label)}</span></div>`).join("")}</div>` : "";
  const copy = `${s.eyebrow ? `<span class="eyebrow rv">${esc(s.eyebrow)}</span>` : ""}<h1 class="rv" style="--d:80ms">${rich(s.title)}</h1>${s.subtitle ? `<p class="lead rv" style="--d:160ms">${esc(s.subtitle)}</p>` : ""}<div class="rv" style="--d:240ms">${ctas}</div>${stats}`;
  const id = sid("hero");

  if (variant === "full" && p) {
    return `<section class="hero hero-full" id="${id}"><div class="bg">${img(p, { eager: true })}</div><div class="wrap">${copy}</div></section>`;
  }
  if (variant === "center") {
    const strip = [photo(media, s.image, 0), photo(media, s.image, 1), photo(media, s.image, 2)].filter(Boolean) as Photo[];
    const stripHtml = strip.length >= 2 ? `<div class="strip">${strip.map((x, i) => `<div class="ph rv" style="--d:${300 + i * 100}ms">${img(x, { small: true })}</div>`).join("")}</div>` : "";
    return `<section class="hero hero-center" id="${id}"><div class="wrap">${copy}${stripHtml}</div></section>`;
  }
  const badge = s.badge ? `<div class="badge">${icon("star")}<div>${esc(s.badge)}${s.badgeNote ? `<small>${esc(s.badgeNote)}</small>` : ""}</div></div>` : "";
  void spec;
  return `<section class="hero hero-split" id="${id}"><div class="wrap"><div class="copy">${copy}</div><div class="media rv" style="--d:200ms"><div class="ph">${img(p, { eager: true })}</div>${badge}</div></div></section>`;
}

function renderMarquee(s: Extract<Section, { type: "marquee" }>): string {
  const items = s.items.slice(0, 10);
  if (items.length < 3) return "";
  const row = items.map((t) => `<span>${esc(t)}</span>`).join("");
  return `<div class="marquee" aria-hidden="true"><div class="track">${row}${row}</div></div>`;
}

function renderFeatures(s: Extract<Section, { type: "features" }>, id: string): string {
  return `<section id="${id}"><div class="wrap">${head(s.eyebrow, s.title, s.subtitle)}<div class="grid g3">${s.items
    .slice(0, 6)
    .map((f, i) => `<article class="card feat" ${rv(i)}><div class="ico">${icon(f.icon)}</div><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></article>`)
    .join("")}</div></div></section>`;
}

function renderProducts(s: Extract<Section, { type: "products" }>, media: SiteMedia, id: string): string {
  const cats = [...new Set(s.items.map((i) => i.category).filter(Boolean))] as string[];
  const showCart = s.cart !== false;
  const chips =
    cats.length > 1
      ? `<div class="chips rv" data-filter-group><button class="on" data-cat="*">Semua</button>${cats.map((c) => `<button data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>`
      : "";
  const cards = s.items
    .slice(0, 12)
    .map((it, i) => {
      const p = photo(media, it.image, i);
      const pid = `p${uid}-${i}`;
      return `<article class="card pcard" data-name="${esc(it.name)}" data-price="${it.price ?? 0}" data-cat="${esc(it.category || "")}" ${rv(i % 6)}>
<div class="ph">${p ? img(p, { small: true }) : ""}${it.tag ? `<span class="tag">${esc(it.tag)}</span>` : ""}</div>
<div class="pb"><h3>${esc(it.name)}</h3>${it.desc ? `<p>${esc(it.desc)}</p>` : "<p></p>"}
<div class="row">${it.price ? `<span class="price">${idr(it.price)}</span>` : "<span></span>"}${showCart && it.price ? `<button class="add" data-add="${pid}" aria-label="Tambah ${esc(it.name)} ke keranjang">${icon("plus")}</button>` : ""}</div></div></article>`;
    })
    .join("");
  return `<section id="${id}"><div class="wrap">${head(s.eyebrow, s.title, s.subtitle)}${chips}<div class="grid g3">${cards}</div></div></section>`;
}

function renderGallery(s: Extract<Section, { type: "gallery" }>, media: SiteMedia, id: string): string {
  const list = (media.photos[s.image || ""] || []).slice(0, 9);
  const pool = list.length >= 4 ? list : [...list, ...Object.values(media.photos).flat()].slice(0, 9);
  if (pool.length < 3) return "";
  return `<section id="${id}"><div class="wrap">${head(s.eyebrow, s.title, s.subtitle)}<div class="masonry">${pool
    .map((p, i) => `<figure class="rv" style="--d:${(i % 4) * 70}ms" data-zoom="${esc(p.url)}" data-alt="${esc(p.alt)}">${img(p, { small: true })}</figure>`)
    .join("")}</div></div></section>`;
}

function renderAbout(s: Extract<Section, { type: "about" }>, media: SiteMedia, id: string): string {
  const p = photo(media, s.image) || anyPhoto(media, 1);
  const text = s.text.map((t) => `<p>${esc(t)}</p>`).join("");
  const pts = s.points?.length ? `<ul class="points">${s.points.slice(0, 5).map((x) => `<li>${icon("check")}<span>${esc(x)}</span></li>`).join("")}</ul>` : "";
  const pic = p ? `<div class="pic rv"><div class="ph">${img(p)}</div></div>` : "";
  return `<section id="${id}"><div class="wrap"><div class="split ${s.flip ? "flip" : ""}">${pic}<div class="copy rv" style="--d:120ms">${s.eyebrow ? `<span class="eyebrow">${esc(s.eyebrow)}</span>` : ""}<h2>${rich(s.title)}</h2>${text}${pts}</div></div></div></section>`;
}

function renderSteps(s: Extract<Section, { type: "steps" }>, id: string): string {
  return `<section id="${id}"><div class="wrap">${head(s.eyebrow, s.title, s.subtitle)}<div class="steps">${s.items
    .slice(0, 5)
    .map((x, i) => `<div class="step" ${rv(i)}><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`)
    .join("")}</div></div></section>`;
}

function renderStats(s: Extract<Section, { type: "stats" }>): string {
  return `<section class="band" style="padding-block:clamp(48px,6vw,84px)"><div class="wrap"><div class="stats">${s.items
    .slice(0, 4)
    .map((x, i) => `<div class="stat rv" style="--d:${i * 80}ms"><b data-count="${esc(x.value)}">${esc(x.value)}</b><span>${esc(x.label)}</span></div>`)
    .join("")}</div></div></section>`;
}

function renderTestimonials(s: Extract<Section, { type: "testimonials" }>, id: string): string {
  const ini = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return `<section id="${id}" class="band"><div class="wrap">${head(s.eyebrow, s.title, s.subtitle)}<div class="grid g3">${s.items
    .slice(0, 6)
    .map((t, i) => `<figure class="card quote" ${rv(i)}><p>${esc(t.quote)}</p><figcaption class="who"><span class="av">${esc(ini(t.name))}</span><span><b>${esc(t.name)}</b>${t.role ? `<small>${esc(t.role)}</small>` : ""}</span></figcaption></figure>`)
    .join("")}</div></div></section>`;
}

function renderPricing(s: Extract<Section, { type: "pricing" }>, id: string): string {
  return `<section id="${id}"><div class="wrap">${head(s.eyebrow, s.title, s.subtitle, true)}<div class="grid g3" style="align-items:stretch">${s.plans
    .slice(0, 4)
    .map(
      (p, i) => `<article class="card plan ${p.highlight ? "hi" : ""}" ${rv(i)}>${p.highlight ? '<span class="pill">Paling dipilih</span>' : ""}<h3>${esc(p.name)}</h3><div class="amt">${esc(p.price)}${p.period ? ` <small>${esc(p.period)}</small>` : ""}</div><ul>${p.features
        .slice(0, 7)
        .map((f) => `<li>${icon("check")}<span>${esc(f)}</span></li>`)
        .join("")}</ul><a class="btn ${p.highlight ? "btn-primary" : "btn-ghost"}" href="#kontak">${esc(p.cta || "Pilih paket")}</a></article>`
    )
    .join("")}</div></div></section>`;
}

function renderFaq(s: Extract<Section, { type: "faq" }>, id: string): string {
  return `<section id="${id}"><div class="wrap">${head(s.eyebrow, s.title, s.subtitle, true)}<div class="faq">${s.items
    .slice(0, 8)
    .map((x, i) => `<details ${rv(i)}><summary>${esc(x.q)}<i></i></summary><div class="ans">${esc(x.a)}</div></details>`)
    .join("")}</div></div></section>`;
}

function renderVideo(s: Extract<Section, { type: "video" }>, media: SiteMedia, id: string): string {
  const v = media.video;
  if (!v) return "";
  return `<section id="${id}"><div class="wrap">${head(s.eyebrow, s.title, s.subtitle, true)}<div class="vframe rv" data-embed="${esc(v.embed)}" data-title="${esc(v.title)}"><img src="${esc(v.thumb)}" alt="Thumbnail video: ${esc(v.title)}" loading="lazy"><button class="play" type="button" aria-label="Putar video"><span>${icon("play")}</span></button></div><p class="credit">Video: ${esc(v.title)} · ${esc(v.channel)} di YouTube · <a href="${esc(v.watch)}" target="_blank" rel="noopener">Buka di YouTube</a></p></div></section>`;
}

function formFields(f: FormSpec): { fields: string; coll: string; button: string } {
  const fld = (name: string, label: string, type = "text", extra = "") => `<label><span>${label}</span><input name="${name}" type="${type}" ${extra}></label>`;
  const note = `<label class="wide"><span>Catatan (opsional)</span><textarea name="catatan" rows="3"></textarea></label>`;
  if (f.kind === "reservasi")
    return { coll: f.collection || "reservasi", button: f.button || "Kirim reservasi", fields: fld("nama", "Nama", "text", 'required autocomplete="name"') + fld("whatsapp", "WhatsApp", "tel", 'required autocomplete="tel"') + fld("tanggal", "Tanggal", "date", "required") + fld("jam", "Jam", "time", "required") + fld("jumlah", "Jumlah orang", "number", 'min="1" max="30" value="2" required') + note };
  if (f.kind === "daftar")
    return { coll: f.collection || "pendaftaran", button: f.button || "Kirim pendaftaran", fields: fld("nama", "Nama lengkap", "text", 'required autocomplete="name"') + fld("email", "Email", "email", 'required autocomplete="email"') + fld("whatsapp", "WhatsApp", "tel", 'autocomplete="tel"') + note };
  if (f.kind === "pesan")
    return { coll: f.collection || "pesanan", button: f.button || "Kirim pesanan", fields: fld("nama", "Nama", "text", 'required autocomplete="name"') + fld("whatsapp", "WhatsApp", "tel", 'required autocomplete="tel"') + `<label class="wide"><span>Pesanan</span><textarea name="pesanan" rows="3" required></textarea></label>` };
  return { coll: f.collection || "pesan-kontak", button: f.button || "Kirim pesan", fields: fld("nama", "Nama", "text", 'required autocomplete="name"') + fld("email", "Email", "email", 'required autocomplete="email"') + `<label class="wide"><span>Pesan</span><textarea name="pesan" rows="4" required></textarea></label>` };
}

function formHtml(f: FormSpec): string {
  const x = formFields(f);
  return `<form class="card form rv" data-form="${esc(x.coll)}">${x.fields}<button class="btn btn-primary" type="submit">${esc(x.button)}</button><p class="ok" role="status" hidden>Terkirim! Terima kasih, datamu sudah kami terima.</p></form>`;
}

function renderForm(s: Extract<Section, { type: "form" }>, id: string): string {
  return `<section id="${id}"><div class="wrap" style="max-width:820px">${head(s.eyebrow, s.title, s.subtitle, true)}${formHtml(s.form)}</div></section>`;
}

function renderContact(s: Extract<Section, { type: "contact" }>, id: string): string {
  const rows: string[] = [];
  if (s.address) rows.push(`<div class="card irow rv"><div class="ico">${icon("pin")}</div><div><b>Alamat</b><p>${esc(s.address)}</p></div></div>`);
  if (s.hours?.length) rows.push(`<div class="card irow rv" style="--d:70ms"><div class="ico">${icon("clock")}</div><div><b>Jam buka</b><ul>${s.hours.slice(0, 7).map((h) => `<li><span>${esc(h.day)}</span><span>${esc(h.time)}</span></li>`).join("")}</ul></div></div>`);
  const cont = [s.phone && `<p>${esc(s.phone)}</p>`, s.email && `<p>${esc(s.email)}</p>`].filter(Boolean).join("");
  if (cont) rows.push(`<div class="card irow rv" style="--d:140ms"><div class="ico">${icon(s.phone ? "phone" : "mail")}</div><div><b>Kontak</b>${cont}</div></div>`);
  const mapQ = s.address ? encodeURIComponent(s.address) : "";
  const map = mapQ
    ? `<div class="map real rv" style="--d:200ms"><iframe title="Peta lokasi" src="https://www.google.com/maps?q=${mapQ}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe><a class="maplink" href="https://www.google.com/maps/search/?api=1&query=${mapQ}" target="_blank" rel="noopener">Buka di Google Maps ↗</a></div>`
    : `<div class="map rv" style="--d:200ms" aria-hidden="true"><i></i></div>`;
  const info = `<div class="info">${rows.join("")}${map}</div>`;
  const right = s.form ? formHtml(s.form) : "";
  return `<section id="${id}"><div class="wrap">${head(s.eyebrow, s.title, s.subtitle)}<div class="${right ? "contact" : ""}">${info}${right}</div></div></section>`;
}

function renderCta(s: Extract<Section, { type: "cta" }>): string {
  return `<section style="padding-block:clamp(48px,6vw,96px)"><div class="wrap"><div class="cta rv"><h2>${rich(s.title)}</h2>${s.text ? `<p>${esc(s.text)}</p>` : ""}<a class="btn" href="${esc(s.cta.href || "#kontak")}">${esc(s.cta.label)}${icon("arrow")}</a></div></div></section>`;
}

// ---------------------------------------------------------------- perakitan

const NAV_LABEL: Record<string, string> = {
  features: "Keunggulan",
  products: "Menu",
  gallery: "Galeri",
  about: "Tentang",
  steps: "Cara kerja",
  testimonials: "Ulasan",
  pricing: "Harga",
  faq: "FAQ",
  video: "Video",
  contact: "Kontak",
  form: "Kontak",
};

/**
 * Satu tag hanya boleh punya satu atribut class: browser mengabaikan yang kedua, sehingga kelas animasi
 * "rv" dari rv() hilang pada elemen yang sudah ber-class (kartu, langkah, testimoni, harga, produk).
 */
function mergeDupClasses(html: string): string {
  return html.replace(/<([a-zA-Z][\w-]*)(\s[^<>]*?)>/g, (tag, name: string, attrs: string) => {
    const found = [...attrs.matchAll(/\sclass="([^"]*)"/g)];
    if (found.length < 2) return tag;
    const merged = [...new Set(found.flatMap((m) => m[1].split(/\s+/)).filter(Boolean))].join(" ");
    let first = true;
    const rest = attrs.replace(/\sclass="([^"]*)"/g, () => {
      if (!first) return "";
      first = false;
      return ` class="${merged}"`;
    });
    return `<${name}${rest}>`;
  });
}

export function renderSite(spec: SiteSpec, media: SiteMedia): string {
  uid = 0;
  const t = spec.theme;
  const c = t.colors;
  const dark = t.dark;
  const surface = c.surface || (dark ? mix(c.bg, "#ffffff", 0.06) : mix(c.bg, "#ffffff", 0.6));
  const line = mix(c.ink, c.bg, dark ? 0.82 : 0.86);
  const muted = mix(c.ink, c.bg, dark ? 0.34 : 0.4);

  const body: string[] = [];
  const navItems: { id: string; label: string }[] = [];
  let hasCart = false;
  let sectionsHtml = "";

  for (const s of spec.sections) {
    let html = "";
    const id = sid(s.type);
    const key = `s-${s.type}-${id.split("-")[1]}`;
    void key;
    switch (s.type) {
      case "hero":
        html = renderHero(s, media, spec);
        break;
      case "marquee":
        html = renderMarquee(s);
        break;
      case "features":
        html = renderFeatures(s, id);
        break;
      case "products":
        html = renderProducts(s, media, id);
        if (s.cart !== false && s.items.some((i) => i.price)) hasCart = true;
        break;
      case "gallery":
        html = renderGallery(s, media, id);
        break;
      case "about":
        html = renderAbout(s, media, id);
        break;
      case "steps":
        html = renderSteps(s, id);
        break;
      case "stats":
        html = renderStats(s);
        break;
      case "testimonials":
        html = renderTestimonials(s, id);
        break;
      case "pricing":
        html = renderPricing(s, id);
        break;
      case "faq":
        html = renderFaq(s, id);
        break;
      case "video":
        html = renderVideo(s, media, id);
        break;
      case "contact":
        html = renderContact(s, "kontak");
        break;
      case "form":
        html = renderForm(s, "kontak");
        break;
      case "cta":
        html = renderCta(s);
        break;
    }
    if (!html) continue;
    sectionsHtml += html + "\n";
    if (s.type !== "hero" && s.type !== "marquee" && s.type !== "stats" && s.type !== "cta") {
      const label = ("navLabel" in s && s.navLabel) || (s.type === "products" && spec.kind !== "kuliner" ? "Produk" : NAV_LABEL[s.type]);
      const target = s.type === "contact" || s.type === "form" ? "kontak" : id;
      if (label && !navItems.some((n) => n.label === label)) navItems.push({ id: target, label });
    }
  }
  body.push(sectionsHtml);

  const navLinks = navItems.slice(0, 6);
  const contactTarget = navItems.find((n) => n.id === "kontak") ? "#kontak" : navItems.length ? `#${navItems[navItems.length - 1].id}` : "#";
  const navCta = spec.sections.find((s) => s.type === "hero" && s.cta) as Extract<Section, { type: "hero" }> | undefined;

  const usedPhotos = Object.values(media.photos).flat();
  const credited = [...new Map(usedPhotos.filter((p) => spec.images && sectionsHtml.includes(p.url.split("?")[0]) || sectionsHtml.includes(p.small.split("?")[0])).map((p) => [p.author, p])).values()].slice(0, 8);
  const credits = credited.length ? `<span>Foto: ${credited.map((p) => `<a href="${esc(p.authorUrl)}" target="_blank" rel="noopener">${esc(p.author)}</a>`).join(", ")} di <a href="https://unsplash.com/?utm_source=vox_ai_studio&utm_medium=referral" target="_blank" rel="noopener">Unsplash</a></span>` : "<span></span>";

  const contact = spec.sections.find((s) => s.type === "contact") as Extract<Section, { type: "contact" }> | undefined;
  const wa = (spec.whatsapp || "").replace(/\D/g, "");
  const favicon = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="${c.accent}"/></svg>`)}`;
  const title = spec.tagline ? `${spec.brand} — ${spec.tagline}` : spec.brand;

  const tokens = `:root{--bg:${c.bg};--ink:${c.ink};--accent:${c.accent};--accent2:${c.accent2};--accent-ink:${onColor(c.accent)};--surface:${surface};--line:${line};--muted:${muted};--f-display:"${t.display}";--f-body:"${t.body}";--f-mono:"${t.mono || t.body}";--shadow:0 1px 2px rgba(0,0,0,${dark ? ".3" : ".05"}),0 18px 44px -18px rgba(0,0,0,${dark ? ".6" : ".22"});color-scheme:${dark ? "dark" : "light"}}`;

  return mergeDupClasses(`<!DOCTYPE html>
<html lang="id">
<head>
<!-- vox-ai:generated -->
<!-- SUMMARY: Website ${esc(spec.brand)} (${esc(spec.kind)}) dengan ${spec.sections.length} bagian -->
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(spec.description || spec.tagline || spec.brand)}">
<meta name="theme-color" content="${c.bg}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(spec.description || spec.tagline || "")}">
<link rel="icon" href="${favicon}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${esc(t.fontsLink)}" rel="stylesheet">
<style>${tokens}
${SITE_CSS}</style>
<noscript><style>.rv{opacity:1!important;transform:none!important}</style></noscript>
</head>
<body class="st-${t.style} r-${t.radius}">
<nav class="nav" aria-label="Navigasi utama"><div class="wrap">
<a class="logo" href="#"><i></i>${esc(spec.brand)}</a>
<div class="links">${navLinks.map((n) => `<a href="#${n.id}">${esc(n.label)}</a>`).join("")}</div>
<div class="nav-cta">${hasCart ? `<button class="cart-btn" aria-label="Buka keranjang">${icon("bag")}<b>0</b></button>` : ""}${navCta?.cta ? `<a class="btn btn-primary btn-sm" href="${esc(navCta.cta.href || contactTarget)}">${esc(navCta.cta.label)}</a>` : ""}<button class="burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button></div>
</div></nav>
<div class="mmenu">${navLinks.map((n) => `<a href="#${n.id}">${esc(n.label)}</a>`).join("")}</div>
<main>
${body.join("\n")}
</main>
<footer class="site"><div class="wrap">
<div class="fgrid">
<div><a class="logo" href="#"><i></i>${esc(spec.brand)}</a><p>${esc(spec.description || spec.tagline || "")}</p></div>
<div><h4>Jelajahi</h4><ul>${navLinks.map((n) => `<li><a href="#${n.id}">${esc(n.label)}</a></li>`).join("")}</ul></div>
<div><h4>Kontak</h4><ul>${[contact?.address, contact?.phone, contact?.email].filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join("") || `<li><a href="${contactTarget}">Hubungi kami</a></li>`}</ul></div>
</div>
<div class="fbase"><span>© ${new Date().getFullYear()} ${esc(spec.brand)}. Dibuat dengan VOX·AI Studio.</span>${credits}</div>
</div></footer>
${hasCart ? `<div class="veil"></div>
<aside class="drawer" aria-label="Keranjang"><header><h3>Keranjangmu</h3><button class="x" data-close-cart aria-label="Tutup">${icon("x")}</button></header>
<div class="lines"></div>
<footer><div class="total"><span>Total</span><b>Rp 0</b></div><input name="cname" placeholder="Nama kamu" aria-label="Nama kamu" autocomplete="name"><input name="cphone" placeholder="Nomor WhatsApp" aria-label="Nomor WhatsApp" inputmode="tel" autocomplete="tel"><button class="btn btn-primary" data-checkout ${wa ? `data-wa="${esc(wa)}"` : ""} disabled>${wa ? "Pesan lewat WhatsApp" : "Kirim pesanan"}</button><p class="ok" role="status" hidden>Pesananmu terkirim. Terima kasih!</p></footer></aside>` : ""}
<div class="lb" role="dialog" aria-label="Foto"><button class="x" aria-label="Tutup">${icon("x")}</button><img alt=""></div>
<script>${SITE_JS}</script>
</body>
</html>`);
}
