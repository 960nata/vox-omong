import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";

/**
 * Gambar (Unsplash) & video (YouTube) untuk website hasil AI.
 * - Key hanya dipakai di server; browser cuma menerima URL gambar / ID video.
 * - Video di-EMBED lewat youtube-nocookie (bukan diunduh / diunggah ulang).
 * - Hasil di-cache 24 jam karena kuota kecil:
 *     Unsplash demo = 50 permintaan/jam, YouTube search = 100 unit dari 10.000/hari.
 */

const CACHE_DIR = path.join(process.cwd(), ".data", "cache");
const TTL_MS = 24 * 60 * 60 * 1000;
const UTM = "utm_source=vox_ai_studio&utm_medium=referral";

export interface Photo {
  id: string;
  /** URL yang dipakai di <img> (lebar 1600, sudah dioptimasi imgix Unsplash) */
  url: string;
  /** versi kecil untuk thumbnail/kartu (lebar 800) */
  small: string;
  alt: string;
  author: string;
  authorUrl: string;
  pageUrl: string;
  color: string;
  width: number;
  height: number;
  downloadLocation: string;
}

export interface Video {
  id: string;
  title: string;
  channel: string;
  thumb: string;
  embed: string;
  watch: string;
}

/** Teks dari pihak ketiga masuk ke prompt model; buang karakter markup/kontrol agar tidak bisa menyuntikkan kode. */
function safeText(s: string, max = 120) {
  return String(s ?? "")
    .replace(/[<>{}`\\$]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const file = path.join(CACHE_DIR, `${key}.json`);
    const st = await fs.stat(file);
    if (Date.now() - st.mtimeMs > TTL_MS) return null;
    return JSON.parse(await fs.readFile(file, "utf-8")) as T;
  } catch {
    return null;
  }
}

async function writeCache(key: string, data: unknown) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(path.join(CACHE_DIR, `${key}.json`), JSON.stringify(data), "utf-8");
  } catch {}
}

function cacheKey(kind: string, q: string, n: number) {
  return `${kind}-${createHash("sha1").update(`${q.toLowerCase().trim()}|${n}`).digest("hex").slice(0, 16)}`;
}

// ---------------------------------------------------------------- Unsplash

const g = globalThis as unknown as { __unsplashHits?: number[] };
const hits: number[] = (g.__unsplashHits ??= []);

/** Sisakan margin dari batas 50/jam supaya permintaan lain (mis. tombol manual) tetap bisa jalan. */
function unsplashBudgetLeft() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  while (hits.length && hits[0] < cutoff) hits.shift();
  return 44 - hits.length;
}

export async function searchPhotos(query: string, count = 3, orientation: "landscape" | "portrait" | "squarish" = "landscape"): Promise<Photo[]> {
  const q = query.trim().slice(0, 80);
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!q || !key) return [];
  const ck = cacheKey(`unsplash-${orientation}`, q, count);
  const cached = await readCache<Photo[]>(ck);
  if (cached) return cached;
  if (unsplashBudgetLeft() <= 0) return [];

  try {
    hits.push(Date.now());
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", q);
    url.searchParams.set("per_page", String(Math.min(Math.max(count, 1), 10)));
    url.searchParams.set("orientation", orientation);
    url.searchParams.set("content_filter", "high");
    const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: {
        id: string;
        alt_description: string | null;
        description: string | null;
        color: string;
        width: number;
        height: number;
        urls: { raw: string; regular: string; small: string };
        links: { html: string; download_location: string };
        user: { name: string; links: { html: string } };
      }[];
    };
    const photos: Photo[] = (data.results || []).slice(0, count).map((r) => ({
      id: r.id,
      url: `${r.urls.raw}&auto=format&fit=crop&w=1400&q=78`,
      small: `${r.urls.raw}&auto=format&fit=crop&w=800&q=75`,
      alt: safeText(r.alt_description || r.description || q),
      author: safeText(r.user.name, 60),
      authorUrl: `${r.user.links.html}?${UTM}`,
      pageUrl: `${r.links.html}?${UTM}`,
      color: r.color,
      width: r.width,
      height: r.height,
      downloadLocation: r.links.download_location,
    }));
    if (photos.length) await writeCache(ck, photos);
    return photos;
  } catch {
    return [];
  }
}

/** Pedoman Unsplash: beri tahu mereka saat sebuah foto benar-benar dipakai. Gagal = diabaikan. */
export async function trackPhotoUse(photos: Photo[], html: string) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return;
  const used = photos.filter((p) => html.includes(p.url.split("?")[0]));
  await Promise.all(
    used.slice(0, 8).map((p) =>
      fetch(p.downloadLocation, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => undefined)
    )
  );
}

// ---------------------------------------------------------------- YouTube

export async function searchVideos(query: string, count = 3): Promise<Video[]> {
  const q = query.trim().slice(0, 100);
  const key = process.env.YOUTUBE_API_KEY;
  if (!q || !key) return [];
  const ck = cacheKey("youtube", q, count);
  const cached = await readCache<Video[]>(ck);
  if (cached) return cached;

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("videoEmbeddable", "true");
    url.searchParams.set("safeSearch", "strict");
    url.searchParams.set("maxResults", String(Math.min(Math.max(count, 1), 8)));
    url.searchParams.set("q", q);
    url.searchParams.set("key", key);
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: { id: { videoId: string }; snippet: { title: string; channelTitle: string } }[];
    };
    const decode = (s: string) => safeText(s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"'), 110);
    const videos: Video[] = (data.items || [])
      .filter((i) => i.id?.videoId)
      .slice(0, count)
      .map((i) => ({
        id: i.id.videoId,
        title: decode(i.snippet.title),
        channel: decode(i.snippet.channelTitle),
        thumb: `https://i.ytimg.com/vi/${i.id.videoId}/hqdefault.jpg`,
        embed: `https://www.youtube-nocookie.com/embed/${i.id.videoId}`,
        watch: `https://www.youtube.com/watch?v=${i.id.videoId}`,
      }));
    if (videos.length) await writeCache(ck, videos);
    return videos;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- prompt helper

export interface MediaPack {
  photos: { slot: string; photos: Photo[] }[];
  videos: Video[];
  all: Photo[];
}

export function describeMedia(pack: MediaPack): string {
  const lines: string[] = [];
  if (pack.photos.some((p) => p.photos.length)) {
    lines.push("FOTO NYATA (Unsplash) — pakai URL persis seperti di bawah, jangan ditebak/diubah:");
    for (const slot of pack.photos) {
      slot.photos.forEach((p, i) =>
        lines.push(`- [${slot.slot} #${i + 1}] ${p.url}  | alt: "${p.alt}" | fotografer: ${p.author} (${p.authorUrl}) | warna dominan ${p.color} | ${p.width}x${p.height}`)
      );
    }
    lines.push("Aturan foto: <img> wajib punya alt, width/height atau aspect-ratio, loading=\"lazy\" (kecuali hero), object-fit cover, dan tambahkan baris kredit kecil di footer: \"Foto oleh <fotografer> di Unsplash\" dengan tautan. Pakai warna dominan sebagai latar placeholder.");
  }
  if (pack.videos.length) {
    lines.push("VIDEO YOUTUBE (boleh di-embed, jangan diunduh):");
    pack.videos.forEach((v, i) => lines.push(`- [video #${i + 1}] id=${v.id} | judul: "${v.title}" | channel: ${v.channel} | thumbnail: ${v.thumb}`));
    lines.push(
      'Aturan video: tampilkan sebagai "facade" — kartu berisi thumbnail + tombol play; saat diklik, ganti dengan <iframe src="https://www.youtube-nocookie.com/embed/ID?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="..."> di dalam wadah aspect-video. Tampilkan juga judul + nama channel sebagai kredit.'
    );
  }
  return lines.join("\n");
}
