import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { hasDeployableFiles, projectDir, run } from "@/lib/projectDir";

/**
 * Deploy PROJECT AKTIF ke Vercel (folder di .data/user_projects/<id>), bukan aplikasi Jarvis.
 * Token dikirim lewat variabel lingkungan VERCEL_TOKEN, bukan argumen perintah (argumen kelihatan di daftar proses).
 */

export async function GET(req: Request) {
  try {
    const dir = await projectDir(new URL(req.url).searchParams.get("projectId"));
    let isLinked = false;
    let projectInfo = "";
    try {
      const info = JSON.parse(await fs.readFile(path.join(dir, ".vercel", "project.json"), "utf-8")) as { projectId?: string; orgId?: string };
      isLinked = !!info.projectId;
      projectInfo = isLinked ? `Terhubung ke project Vercel ${info.projectId}` : "";
    } catch {
      isLinked = false;
    }
    return NextResponse.json({ success: true, isLinked, projectInfo, workingDir: dir, hasFiles: await hasDeployableFiles(dir) });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { token, isProd = false, projectId } = await req.json();
    const dir = await projectDir(projectId);
    if (!(await hasDeployableFiles(dir))) {
      return NextResponse.json({ success: false, error: "Project ini belum punya file untuk di-deploy (index.html atau package.json). Buat websitenya dulu." }, { status: 400 });
    }
    const activeToken = typeof token === "string" && token.trim() ? token.trim() : process.env.VERCEL_TOKEN;
    if (activeToken && !/^[\w-]{8,}$/.test(activeToken)) {
      return NextResponse.json({ success: false, error: "Format token Vercel tidak valid." }, { status: 400 });
    }

    const args = ["--yes", ...(isProd ? ["--prod"] : [])];
    const { stdout, stderr } = await run("vercel", args, dir, activeToken ? { VERCEL_TOKEN: activeToken } : {}, 180_000);
    const match = (stdout + stderr).match(/https:\/\/[a-zA-Z0-9-]+\.vercel\.app/);
    return NextResponse.json({
      success: true,
      message: isProd ? "Deploy ke Vercel Production berhasil!" : "Deploy ke Vercel Preview berhasil!",
      deployUrl: match ? match[0] : null,
      output: stdout || stderr,
    });
  } catch (error) {
    const e = error as { stderr?: string; stdout?: string; message?: string; code?: string };
    console.error("POST /api/vercel error:", e.message);
    const missing = e.code === "ENOENT" ? "CLI Vercel belum terpasang. Jalankan: npm i -g vercel" : "";
    return NextResponse.json({ success: false, error: missing || e.stderr || e.message || "Deploy Vercel gagal", output: e.stdout }, { status: 500 });
  }
}
