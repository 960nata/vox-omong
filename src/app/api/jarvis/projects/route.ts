import { NextResponse } from "next/server";
import { checkAuth, projectsForVoice } from "@/lib/jarvisTasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → daftar project yang ada, buat tool `daftar_project` di bot telpon
export async function GET(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ projects: await projectsForVoice() });
}
