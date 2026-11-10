import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { PROJECTS_BASE, slugify } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Backend mini untuk website hasil AI: koleksi JSON per project (form kontak, RSVP, pesanan, ulasan, …).
// Dibatasi: project harus ada, nama koleksi disaring, ukuran data dan jumlah rekaman dibatasi.

type Ctx = { params: Promise<{ project: string; collection: string }> };

const MAX_BODY = 8 * 1024;
const MAX_RECORDS = 500;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

async function resolve(ctx: Ctx) {
  const { project, collection } = await ctx.params;
  const pid = slugify(project);
  const cid = slugify(collection).slice(0, 32);
  if (!pid || !cid) return null;
  try {
    await fs.access(path.join(PROJECTS_BASE, pid));
  } catch {
    return null;
  }
  const dir = path.join(process.cwd(), ".data", "sitedata", pid);
  return { dir, file: path.join(dir, `${cid}.json`) };
}

async function read(file: string): Promise<Record<string, unknown>[]> {
  try {
    const rows = JSON.parse(await fs.readFile(file, "utf-8"));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(_req: Request, ctx: Ctx) {
  const t = await resolve(ctx);
  if (!t) return json({ ok: false, error: "project atau koleksi tidak valid" }, 404);
  const rows = await read(t.file);
  return json({ ok: true, count: rows.length, records: rows.slice().reverse().slice(0, 200) });
}

export async function POST(req: Request, ctx: Ctx) {
  const t = await resolve(ctx);
  if (!t) return json({ ok: false, error: "project atau koleksi tidak valid" }, 404);
  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ ok: false, error: "data terlalu besar (maks 8 KB)" }, 413);
  let data: unknown;
  try {
    data = JSON.parse(raw || "{}");
  } catch {
    return json({ ok: false, error: "JSON tidak valid" }, 400);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return json({ ok: false, error: "data harus objek" }, 400);

  // Hanya nilai sederhana; id & createdAt dari server
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>).slice(0, 30)) {
    if (["id", "createdAt"].includes(k)) continue;
    if (["string", "number", "boolean"].includes(typeof v) || v === null) {
      clean[k.slice(0, 40)] = typeof v === "string" ? v.slice(0, 2000) : v;
    }
  }
  const record = { id: randomUUID().slice(0, 8), createdAt: new Date().toISOString(), ...clean };
  await fs.mkdir(t.dir, { recursive: true });
  const rows = await read(t.file);
  rows.push(record);
  await fs.writeFile(t.file, JSON.stringify(rows.slice(-MAX_RECORDS), null, 2), "utf-8");
  return json({ ok: true, record }, 201);
}

export async function DELETE(req: Request, ctx: Ctx) {
  const t = await resolve(ctx);
  if (!t) return json({ ok: false, error: "project atau koleksi tidak valid" }, 404);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ ok: false, error: "id wajib diisi" }, 400);
  const rows = await read(t.file);
  const next = rows.filter((r) => r.id !== id);
  await fs.writeFile(t.file, JSON.stringify(next, null, 2), "utf-8");
  return json({ ok: true, removed: rows.length - next.length });
}
