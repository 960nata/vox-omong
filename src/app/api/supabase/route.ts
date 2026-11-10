import { NextResponse } from "next/server";
import { getSupabase, supabaseReady, TABLE_RE } from "@/lib/supabase";

type Body = {
  action?: "select" | "insert" | "update" | "delete";
  table?: string;
  values?: Record<string, unknown> | Record<string, unknown>[];
  match?: Record<string, string | number | boolean>;
  limit?: number;
};

export async function GET() {
  return NextResponse.json({ success: true, configured: supabaseReady() });
}

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Body;
    if (!b.table || !TABLE_RE.test(b.table)) return NextResponse.json({ success: false, error: "Nama tabel tidak valid" }, { status: 400 });
    if (!supabaseReady()) return NextResponse.json({ success: false, error: "Supabase belum disetel (SUPABASE_URL / SUPABASE_ANON_KEY di .env.local)." }, { status: 503 });
    const sb = getSupabase();
    const match = b.match && typeof b.match === "object" ? b.match : {};
    const needMatch = () => Object.keys(match).length > 0;
    let res;
    if (b.action === "select") {
      let q = sb.from(b.table).select("*").limit(Math.min(Math.max(Number(b.limit) || 50, 1), 200));
      for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
      res = await q;
    } else if (b.action === "insert") {
      if (!b.values) return NextResponse.json({ success: false, error: "values kosong" }, { status: 400 });
      res = await sb.from(b.table).insert(b.values).select();
    } else if (b.action === "update" || b.action === "delete") {
      if (!needMatch()) return NextResponse.json({ success: false, error: "match wajib supaya tidak mengubah semua baris" }, { status: 400 });
      if (b.action === "update" && (!b.values || Array.isArray(b.values))) return NextResponse.json({ success: false, error: "values (objek) wajib" }, { status: 400 });
      let q = b.action === "update" ? sb.from(b.table).update(b.values as Record<string, unknown>) : sb.from(b.table).delete();
      for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
      res = await q.select();
    } else {
      return NextResponse.json({ success: false, error: "action harus select/insert/update/delete" }, { status: 400 });
    }
    if (res.error) return NextResponse.json({ success: false, error: res.error.message }, { status: 400 });
    return NextResponse.json({ success: true, data: res.data });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
