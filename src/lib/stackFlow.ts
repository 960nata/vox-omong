import fs from "fs/promises";
import path from "path";
import { detectStackRequest, installSize, readStackConfig, scaffoldStack, stackName, SUPPORTED_STACK_RE, UNSUPPORTED_STACK_RE } from "./scaffold";
import { stackStatus, startStackInBackground, stopStack } from "./procs";

/** Alur percakapan untuk proyek backend + frontend: buat, install & jalankan, cek status, matikan. */

const PROJECTS = path.join(process.cwd(), ".data", "user_projects");
const PENDING = path.join(process.cwd(), ".data", "stack-pending.json");
const TTL = 30 * 60 * 1000;

const MAKE_CUE = /\b(bisa|dibuat|dibikin|pakai|pake|buat(?:in|kan)?|bikin(?:in)?|install|instal|bangun|coding|framework)\b/i;
const STATUS_ASK = /\b(sudah|udah|dah)\s+jalan|jalan\s+belum|cek\s+(?:status|server)|status\s+(?:server|proyek|project|stack)|lihat\s+log|log(?:nya)?\s+(?:mana|error)|server(?:nya)?\s+(?:mati|error|jalan)/i;
const STOP_ASK = /\b(matikan|stop(?:in)?|hentikan)\s+(?:server|proyek|project|stack|semua)/i;
const YES = /^(?:\s*(?:ya|iya|yap|oke|ok|gas|lanjut|boleh|setuju|install|instal|jalankan|jalanin|sip|siap)\b[\s,.!]*){1,4}$/i;

export interface StackReply {
  reply: string;
  spoken: string;
  previewUrl?: string;
  suggestions?: string[];
}

async function readPending(): Promise<Record<string, { projectId: string; at: number }>> {
  try {
    return JSON.parse(await fs.readFile(PENDING, "utf-8"));
  } catch {
    return {};
  }
}
async function writePending(p: Record<string, { projectId: string; at: number }>) {
  await fs.mkdir(path.dirname(PENDING), { recursive: true });
  await fs.writeFile(PENDING, JSON.stringify(p));
}

export const STACK_HONEST = (stack: string) =>
  `Jujur ya: proyek ${stack} belum bisa aku buat. Yang bisa sekarang: website statis dari komponen (foto dan video asli), proyek backend + frontend terpisah (Express atau Go untuk API; React + Vite atau Next.js untuk web), plus slide, invoice, tabel, dan dokumen. ${stack} butuh toolchain yang belum ada di laptopmu, dan aku gak mau pura-pura bisa. Mau aku bikinkan versi Express + React dulu?`;

async function statusReply(projectId: string): Promise<StackReply | null> {
  const cfg = await readStackConfig(path.join(PROJECTS, projectId));
  if (!cfg) return null;
  const parts = await stackStatus(projectId, cfg);
  const lines = parts.map((p) => {
    const nm = p.name === "server" ? "Backend" : "Frontend";
    if (p.responding) return `${nm} (${p.kind}): jalan di ${p.url} ✓`;
    if (p.phase === "installing") return `${nm} (${p.kind}): lagi install paket…`;
    if (p.phase === "failed") return `${nm} (${p.kind}): gagal. ${p.error || ""}${p.logTail.length ? ` Log terakhir: ${p.logTail.slice(-3).join(" | ")}` : ""}`;
    return `${nm} (${p.kind}): belum jalan${p.installed ? "" : " (paket belum di-install)"}.`;
  });
  const web = parts.find((p) => p.name === "web" && p.responding) || parts.find((p) => p.responding);
  const allUp = parts.every((p) => p.responding);
  return {
    reply: `${lines.join("\n")}${allUp ? "\nBuka lewat Preview, atau langsung di alamat di atas." : ""}`,
    spoken: allUp ? "Semuanya sudah jalan. Buka lewat Preview." : parts.some((p) => p.phase === "failed") ? "Ada yang gagal jalan. Aku tulis detailnya di chat." : "Masih diproses, tunggu sebentar lalu tanya lagi.",
    previewUrl: web ? web.url : undefined,
    suggestions: allUp ? ["Matikan server"] : ["Sudah jalan belum?"],
  };
}

export async function handleStackMessage({ message, conversationId, projectId }: { message: string; conversationId: string; projectId: string }): Promise<StackReply | null> {
  const dir = path.join(PROJECTS, projectId);
  const cfg = await readStackConfig(dir);

  // 1. "ya / gas / install" untuk proyek yang menunggu persetujuan install
  const pend = await readPending();
  const mine = pend[conversationId];
  if (mine && Date.now() - mine.at <= TTL && YES.test(message)) {
    const c = await readStackConfig(path.join(PROJECTS, mine.projectId));
    delete pend[conversationId];
    await writePending(pend);
    if (c) {
      startStackInBackground(mine.projectId, c);
      return {
        reply: `Oke, lagi aku install dan jalankan (${installSize(c)}, biasanya 1–3 menit). Tanya "sudah jalan belum?" nanti aku kabari alamatnya.`,
        spoken: "Oke, lagi aku install dan jalankan. Tanya sudah jalan belum nanti aku kabari.",
        suggestions: ["Sudah jalan belum?"],
      };
    }
  }

  // 2. matikan / status untuk proyek stack yang aktif
  if (cfg && STOP_ASK.test(message)) {
    const n = stopStack(projectId);
    return { reply: n ? `Sudah aku matikan (${n} proses).` : "Gak ada proses yang lagi jalan.", spoken: n ? "Sudah aku matikan." : "Gak ada yang lagi jalan." };
  }
  if (cfg && STATUS_ASK.test(message)) return statusReply(projectId);

  // 3. permintaan membuat proyek stack
  const req = detectStackRequest(message);
  if (req) {
    if (cfg) {
      return {
        reply: `Project ini sudah berisi ${stackName(cfg)}. Biar gak menimpa, bikin project baru dulu: bilang "buat project <nama>", lalu ulangi permintaannya.`,
        spoken: "Project ini sudah berisi proyek. Bikin project baru dulu biar gak menimpa.",
        suggestions: ["Sudah jalan belum?"],
      };
    }
    const { cfg: made } = await scaffoldStack(dir, req);
    const parts: string[] = [];
    if (made.backend) parts.push(`• server/ — ${made.backend === "go" ? "Go" : "Express"} di port ${made.apiPort} (GET/POST /api/${made.resource}, PATCH/DELETE /api/${made.resource}/:id)`);
    if (made.frontend) parts.push(`• web/ — ${made.frontend === "nextjs" ? "Next.js" : "React + Vite"} di port ${made.webPort}`);
    const head = `Proyek ${stackName(made)} untuk "${made.label}" udah aku buat di project ${projectId}:\n${parts.join("\n")}\nPaket yang diunduh: ${installSize(made)}. Backend dan frontend terpisah, datanya disimpan di server/data.json, dan hanya bisa diakses dari laptopmu (127.0.0.1).`;
    if (req.install) {
      startStackInBackground(projectId, made);
      return {
        reply: `${head}\nLagi aku install dan jalankan sekarang (biasanya 1–3 menit). Tanya "sudah jalan belum?" nanti aku kabari alamatnya.`,
        spoken: `Proyek ${made.label} sudah aku buat dan lagi aku install. Tanya sudah jalan belum nanti aku kabari.`,
        suggestions: ["Sudah jalan belum?"],
      };
    }
    pend[conversationId] = { projectId, at: Date.now() };
    await writePending(pend);
    return {
      reply: `${head}\nMau aku install paketnya dan jalankan sekarang? Bilang "ya".`,
      spoken: `Proyek ${made.label} sudah aku buat. Mau aku install dan jalankan sekarang?`,
      suggestions: ["Ya, install dan jalankan", "Nanti dulu"],
    };
  }

  // 4. stack yang belum didukung / pertanyaan "bisa pakai X gak?"
  const un = message.match(UNSUPPORTED_STACK_RE);
  if (un && MAKE_CUE.test(message)) {
    return { reply: STACK_HONEST(un[1]), spoken: "Jujur, itu belum bisa aku buat. Aku bisa Express atau Go untuk backend, dan React atau Next.js untuk frontend.", suggestions: ["Bikinin backend Express + frontend React"] };
  }
  const capabilityQ = /^(?:\s*(?:kamu|lu|lo|kau|ai(?:nya)?|apa|emang)\s+)?bisa\b/i.test(message) || (/\b(bisa|dibuat|dibikin)\b/i.test(message) && !/\bbuat(?:in|kan)?\b|\bbikin(?:in)?\b/i.test(message));
  if (SUPPORTED_STACK_RE.test(message) && capabilityQ) {
    return {
      reply: 'Bisa. Backend: Express atau Go. Frontend: React (Vite) atau Next.js, dibuat terpisah dari backend. Bilang aja, contohnya: "buatin backend Express dan frontend React untuk catatan, install sekalian".',
      spoken: "Bisa. Backend Express atau Go, frontend React atau Next.js. Bilang aja mau dibuatin apa.",
      suggestions: ["Bikinin backend Express + frontend React untuk catatan, install sekalian"],
    };
  }
  return null;
}
