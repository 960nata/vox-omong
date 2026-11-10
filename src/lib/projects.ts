import fs from "fs/promises";
import path from "path";
import { GENERATED_MARKER } from "./codeAgent";

/**
 * Manajemen project (folder A, B, C … di .data/user_projects) + pengurai perintah suara:
 *   "buat project toko kopi senja"        → buat + jadikan aktif
 *   "bikin project baru namanya kasir A"  → buat + jadikan aktif
 *   "buka project toko kopi" / "lanjut ke project b" / "pindah ke project kasir"
 *   "daftar project" / "project apa aja"
 * Kalimat gabungan didukung: "buat project toko kopi terus bikinin landing page".
 */

export const PROJECTS_BASE = path.join(process.cwd(), ".data", "user_projects");

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || ""
  );
}

export interface ProjectInfo {
  id: string;
  name: string;
  hasSite: boolean;
  updatedAt: string | null;
}

function prettyName(id: string) {
  return id
    .split("-")
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

export async function listProjects(): Promise<ProjectInfo[]> {
  await fs.mkdir(PROJECTS_BASE, { recursive: true });
  const entries = await fs.readdir(PROJECTS_BASE, { withFileTypes: true });
  const out: ProjectInfo[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith(".")) continue;
    let hasSite = false;
    let updatedAt: string | null = null;
    try {
      const file = path.join(PROJECTS_BASE, e.name, "index.html");
      const [html, st] = await Promise.all([fs.readFile(file, "utf-8"), fs.stat(file)]);
      hasSite = html.includes(GENERATED_MARKER);
      updatedAt = st.mtime.toISOString();
    } catch {}
    out.push({ id: e.name, name: prettyName(e.name), hasSite, updatedAt });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export async function createProject(rawName: string): Promise<{ id: string; name: string; existed: boolean }> {
  const id = slugify(rawName);
  if (!id) throw new Error("Nama project tidak valid");
  const dir = path.join(PROJECTS_BASE, id);
  let existed = true;
  try {
    await fs.access(dir);
  } catch {
    existed = false;
  }
  await fs.mkdir(path.join(dir, "assets"), { recursive: true });
  await fs.mkdir(path.join(dir, "documents"), { recursive: true });
  if (!existed) {
    const title = rawName.trim().replace(/\s+/g, " ");
    await fs.writeFile(path.join(dir, "README.md"), `# ${title}\n\nDibuat lewat VOX·AI Studio.\n`, "utf-8");
  }
  return { id, name: prettyName(id), existed };
}

// ---------------------------------------------------------------- fuzzy match

function lev(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Cocokkan nama yang diucapkan dengan project yang ada (STT sering sedikit meleset). */
export function findProject(projects: { id: string }[], spoken: string): { id: string } | null {
  const slug = slugify(spoken);
  if (!slug) return null;
  const ids = projects.map((p) => p.id);
  const exact = ids.find((id) => id === slug);
  if (exact) return { id: exact };
  const compact = (s: string) => s.replace(/-/g, "");
  const c = compact(slug);
  const same = ids.find((id) => compact(id) === c);
  if (same) return { id: same };
  const starts = ids.filter((id) => id.startsWith(slug) || slug.startsWith(id));
  if (starts.length === 1) return { id: starts[0] };
  const has = ids.filter((id) => id.includes(slug) || (id.length >= 3 && slug.includes(id)));
  if (has.length === 1) return { id: has[0] };
  const near = ids
    .map((id) => ({ id, d: lev(compact(id), c) }))
    .filter((x) => x.d <= Math.max(1, Math.floor(c.length / 4)))
    .sort((a, b) => a.d - b.d);
  return near[0] ? { id: near[0].id } : null;
}

// ---------------------------------------------------------------- command parser

export type ProjectCommand =
  | { type: "create"; name: string; rest: string }
  | { type: "open"; name: string; rest: string }
  | { type: "list" }
  | null;

// Nama berhenti di kata sambung / tanda baca / awal permintaan lain
const STOP = String.raw`(?=\s+(?:dan|lalu|terus|trus|kemudian|habis itu|setelah itu|abis itu|sekalian|terus bikin|buat|bikin|bikinin|buatkan|tulis|isi|yang|untuk|supaya|biar)\b|[,.;!?\n]|$)`;
const NAME = String.raw`["'“”]?([\p{L}\p{N}][\p{L}\p{N}\s_-]{0,40}?)["'“”]?`;

const CREATE_RES = [
  new RegExp(String.raw`\b(?:buat(?:kan|in)?|bikin(?:kan|in)?|create|siapkan|siapin|tambah(?:kan|in)?)\s+(?:sebuah\s+|satu\s+)?(?:project|proyek|folder project)\s+(?:baru\s+)?(?:(?:yang\s+)?(?:namanya|bernama|dengan\s+nama|nama(?:nya)?|judulnya|judul)\s+)?${NAME}${STOP}`, "iu"),
  new RegExp(String.raw`\b(?:project|proyek)\s+baru\s*(?:[:\-]|namanya|bernama|dengan\s+nama)?\s*${NAME}${STOP}`, "iu"),
];
const OPEN_RES = [
  new RegExp(String.raw`\b(?:buka|bukain|buka(?:kan)?|lanjut(?:kan|in)?|pindah(?:kan|in)?|ganti|gunakan|pakai|masuk|kembali|balik|switch|open)\s+(?:ke\s+|ke dalam\s+|di\s+)?(?:project|proyek)\s+${NAME}${STOP}`, "iu"),
  new RegExp(String.raw`\b(?:kerjain|kerjakan|lanjut(?:kan|in)?)\s+(?:di\s+)?(?:project|proyek)\s+${NAME}${STOP}`, "iu"),
];
const LIST_RE = /\b(?:daftar|list|lihat|tampilkan|sebutin|sebutkan|ada)\s+(?:semua\s+)?(?:project|proyek)(?:\s+(?:apa|saja|aja|ku|kita|yang ada))?\b|\bproject\s+(?:apa\s+(?:aja|saja)|ku\s+apa)\b/i;

function afterStop(text: string, matchEnd: number) {
  return text
    .slice(matchEnd)
    .replace(/^\s*(?:dan|lalu|terus|trus|kemudian|habis itu|setelah itu|abis itu|sekalian|,|\.|;|!|\?)+\s*/i, "")
    .trim();
}

/** Nama proyek bisa terdengar sebagai "project A" → "a". Huruf tunggal/angka dibiarkan. */
function cleanName(raw: string) {
  return raw.trim().replace(/\s+/g, " ").replace(/\s+(?:itu|ya|dong|deh|nih|aja|saja)$/i, "").trim();
}

// "bikin project landing page untuk toko roti" = minta dibuatkan website, bukan membuat folder bernama "landing page"
const BUILD_WORDS = /\b(landing|website|web|situs|dashboard|aplikasi|app|game|slide|presentasi|invoice|laporan|dokumen|proposal|tabel|spreadsheet|kalkulator|toko online)\b/i;

export function parseProjectCommand(text: string): ProjectCommand {
  const t = text.trim();
  if (LIST_RE.test(t) && !/\b(?:buat|bikin|buka|pindah|lanjut)/i.test(t)) return { type: "list" };
  for (const re of CREATE_RES) {
    const m = t.match(re);
    if (m && m[1]) {
      const name = cleanName(m[1]);
      if (name && !/^(?:baru|lagi|ya)$/i.test(name) && !BUILD_WORDS.test(name)) return { type: "create", name, rest: afterStop(t, (m.index ?? 0) + m[0].length) };
    }
  }
  for (const re of OPEN_RES) {
    const m = t.match(re);
    if (m && m[1]) {
      const name = cleanName(m[1]);
      if (name) return { type: "open", name, rest: afterStop(t, (m.index ?? 0) + m[0].length) };
    }
  }
  return null;
}
