import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { hasOwnGitRepo, projectDir, run } from "@/lib/projectDir";

/**
 * Git untuk PROJECT AKTIF (folder di .data/user_projects/<id>), bukan repo aplikasi Jarvis.
 * Semua perintah memakai execFile tanpa shell, jadi pesan commit / URL / token tidak bisa menyuntikkan perintah.
 */

const IDENT = ["-c", "user.name=VOX AI Studio", "-c", "user.email=vox-ai@localhost"];
const git = (dir: string, args: string[]) => run("git", [...IDENT, ...args], dir);
const errText = (e: unknown) => {
  const x = e as { stderr?: string; message?: string };
  return (x.stderr || x.message || "error").toString().replace(/\/\/[^@\s/]+@/g, "//***@"); // jangan bocorkan token
};

async function status(dir: string) {
  const isInitialized = await hasOwnGitRepo(dir);
  let branch = "main";
  let statusOutput = "";
  let remoteUrl = "";
  if (isInitialized) {
    branch = (await git(dir, ["branch", "--show-current"]).then((r) => r.stdout.trim()).catch(() => "")) || "main";
    statusOutput = await git(dir, ["status", "--short"]).then((r) => r.stdout.trim()).catch(() => "");
    remoteUrl = (await git(dir, ["remote", "get-url", "origin"]).then((r) => r.stdout.trim()).catch(() => "")).replace(/\/\/[^@\s/]+@/g, "//");
  }
  return { isInitialized, branch, hasChanges: Boolean(statusOutput), statusOutput, remoteUrl };
}

export async function GET(req: Request) {
  try {
    const dir = await projectDir(new URL(req.url).searchParams.get("projectId"));
    return NextResponse.json({ success: true, workingDir: dir, ...(await status(dir)) });
  } catch (error) {
    return NextResponse.json({ success: false, error: errText(error) }, { status: 500 });
  }
}

async function ensureRepo(dir: string) {
  if (await hasOwnGitRepo(dir)) return;
  await git(dir, ["init", "-b", "main"]);
  // jangan pernah ikut ter-commit: rahasia dan folder besar
  const ignore = path.join(dir, ".gitignore");
  await fs.writeFile(ignore, ".env\n.env.*\nnode_modules/\n.vercel/\n*.log\n", { flag: "wx" }).catch(() => undefined);
}

export async function POST(req: Request) {
  try {
    const { action, repoUrl, commitMessage = "feat: update project via VOX·AI Studio", token, projectId } = await req.json();
    const dir = await projectDir(projectId);

    if (action === "init") {
      await ensureRepo(dir);
      return NextResponse.json({ success: true, message: "Repo git project ini sudah siap (branch main)." });
    }

    if (action === "set_remote") {
      if (!repoUrl || typeof repoUrl !== "string") return NextResponse.json({ success: false, error: "URL repository wajib diisi" }, { status: 400 });
      let finalUrl = repoUrl.trim();
      if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/i.test(finalUrl)) {
        return NextResponse.json({ success: false, error: "Pakai URL GitHub HTTPS, misalnya https://github.com/nama/repo" }, { status: 400 });
      }
      if (token && typeof token === "string" && /^[\w-]+$/.test(token.trim())) finalUrl = finalUrl.replace("https://github.com/", `https://${token.trim()}@github.com/`);
      await ensureRepo(dir);
      await git(dir, ["remote", "remove", "origin"]).catch(() => undefined);
      await git(dir, ["remote", "add", "origin", finalUrl]);
      return NextResponse.json({ success: true, message: "Remote origin project ini sudah diatur." });
    }

    if (action === "commit_and_push") {
      await ensureRepo(dir);
      await git(dir, ["add", "-A"]);
      await git(dir, ["commit", "-m", String(commitMessage).slice(0, 200)]).catch((e) => {
        if (!/nothing to commit|nothing added/i.test(`${e.stdout ?? ""}${e.stderr ?? ""}${e.message}`)) throw e;
      });
      const hasRemote = await git(dir, ["remote", "get-url", "origin"]).then(() => true).catch(() => false);
      if (!hasRemote) {
        return NextResponse.json({ success: true, message: "Perubahan tersimpan (commit). Belum ada remote GitHub, jadi belum di-push." });
      }
      try {
        const { stdout, stderr } = await git(dir, ["push", "-u", "origin", "main"]);
        return NextResponse.json({ success: true, message: "Perubahan di-commit dan di-push ke GitHub.", output: stdout || stderr });
      } catch (e) {
        return NextResponse.json({ success: false, error: `Gagal push ke GitHub: ${errText(e)}. Pastikan Remote URL & Token GitHub benar.` });
      }
    }

    if (action === "pull") {
      if (!(await hasOwnGitRepo(dir))) return NextResponse.json({ success: false, error: "Project ini belum punya repo git." });
      try {
        const { stdout, stderr } = await git(dir, ["pull", "origin", "main"]);
        return NextResponse.json({ success: true, message: "Git pull berhasil.", output: stdout || stderr });
      } catch (e) {
        return NextResponse.json({ success: false, error: `Gagal pull: ${errText(e)}` });
      }
    }

    return NextResponse.json({ success: false, error: "Aksi tidak dikenal" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/git error:", errText(error));
    return NextResponse.json({ success: false, error: errText(error) }, { status: 500 });
  }
}
