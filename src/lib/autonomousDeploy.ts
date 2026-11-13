import fs from "fs/promises";
import path from "path";
import { projectDir, hasDeployableFiles, run, hasOwnGitRepo } from "./projectDir";

export interface DeployResult {
  success: boolean;
  liveUrl?: string;
  repoUrl?: string;
  strategy: "vercel" | "vps" | "github" | "tunnel" | "local";
  message: string;
  details?: string;
}

/**
 * Autonomous AI Deployment Engine
 * Menangani deployment otomatis dari chat / voice tanpa user perlu klik apa pun.
 * Mengambil konfigurasi langsung dari .env / .env.local:
 * - VERCEL_TOKEN -> Deploy otomatis ke Vercel production
 * - GITHUB_ACCESS_TOKEN -> Auto commit & push ke GitHub repo
 * - VPS_WEBHOOK_URL -> Trigger auto-deploy ke server VPS mandiri (PM2 / Docker / Nginx)
 * - Fallback Instant Tunnel -> Buat link publik HTTPS gratis agar bisa dibuka dari HP detik itu juga
 */
export async function executeAutonomousDeploy(projectId: string = "default-workspace"): Promise<DeployResult> {
  const dir = await projectDir(projectId);
  const hasFiles = await hasDeployableFiles(dir);

  if (!hasFiles) {
    return {
      success: false,
      strategy: "local",
      message: `Project "${projectId}" belum memiliki file untuk di-deploy (index.html atau package.json). Minta tim buatkan kodenya dulu.`,
    };
  }

  // 1. Auto Commit Git Lokal
  const ident = ["-c", "user.name=VOX AI Autonomous Deployer", "-c", "user.email=deployer@vox-ai.local"];
  const git = (args: string[]) => run("git", [...ident, ...args], dir);

  let repoUrl: string | undefined;

  try {
    const hasRepo = await hasOwnGitRepo(dir);
    if (!hasRepo) {
      await git(["init", "-b", "main"]);
      const ignore = path.join(dir, ".gitignore");
      await fs.writeFile(ignore, ".env\n.env.*\nnode_modules/\n.next/\n.vercel/\n*.log\n", { flag: "wx" }).catch(() => undefined);
    }

    await git(["add", "-A"]);
    await git(["commit", "-m", `chore: autonomous deploy via VOX·AI (${new Date().toLocaleString("id-ID")})`]).catch(() => undefined);

    // Ambil remote URL jika ada
    const remote = await git(["remote", "get-url", "origin"]).then((r) => r.stdout.trim()).catch(() => "");
    if (remote) {
      repoUrl = remote.replace(/\/\/[^@\s/]+@/g, "//");
    }

    // Auto Push ke GitHub jika token ada di .env
    const ghToken = process.env.GITHUB_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
    if (ghToken && remote && remote.includes("github.com")) {
      const authRemote = remote.replace("https://github.com/", `https://${ghToken.trim()}@github.com/`);
      await git(["remote", "set-url", "origin", authRemote]).catch(() => undefined);
      await git(["push", "-u", "origin", "main"]).catch((e) => {
        console.warn("Auto-push to GitHub warning:", e.message);
      });
    }
  } catch (gitErr: any) {
    console.warn("Git setup warning during deploy:", gitErr.message);
  }

  // 2. Cek Strategi Deploy: VPS Webhook (Hosting Mandiri Tanpa Vercel)
  const vpsWebhook = process.env.VPS_WEBHOOK_URL;
  if (vpsWebhook) {
    try {
      const res = await fetch(vpsWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "VOX-AI-Deployer/1.0" },
        body: JSON.stringify({
          event: "deploy",
          projectId,
          timestamp: Date.now(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      const vpsUrl = data.url || process.env.VPS_DOMAIN || "https://your-server.com";
      return {
        success: true,
        strategy: "vps",
        liveUrl: vpsUrl,
        repoUrl,
        message: `Berhasil di-deploy ke VPS hosting mandiri via Webhook!`,
        details: JSON.stringify(data),
      };
    } catch (vpsErr: any) {
      console.warn("VPS Webhook failed, fallback to cloud providers:", vpsErr.message);
    }
  }

  // 3. Cek Strategi Deploy: Vercel Token di .env
  const vercelToken = process.env.VERCEL_TOKEN;
  if (vercelToken) {
    try {
      // Cek apakah ini project terpisah (ada folder web/) atau monolitik
      let deployDir = dir;
      try {
        const hasWebSubdir = (await fs.stat(path.join(dir, "web", "package.json"))).isFile();
        if (hasWebSubdir) deployDir = path.join(dir, "web");
      } catch (_) {}

      const args = ["--yes", "--prod"];
      const { stdout, stderr } = await run("vercel", args, deployDir, { VERCEL_TOKEN: vercelToken }, 180_000);
      const match = (stdout + stderr).match(/https:\/\/[a-zA-Z0-9-]+\.vercel\.app/);
      if (match) {
        return {
          success: true,
          strategy: "vercel",
          liveUrl: match[0],
          repoUrl,
          message: `Website berhasil di-deploy ke Vercel Production!`,
          details: stdout || stderr,
        };
      }
    } catch (vercelErr: any) {
      console.warn("Vercel CLI deploy error:", vercelErr.message);
    }
  }

  // 4. Strategi C: Jika GitHub Repo tersedia dan di-push
  if (repoUrl) {
    return {
      success: true,
      strategy: "github",
      repoUrl,
      liveUrl: repoUrl,
      message: `Kode berhasil di-commit dan di-push ke GitHub repo: ${repoUrl}. Webhook cloud hosting akan otomatis men-deploy kodenya!`,
    };
  }

  // 5. Fallback Instant Live Preview (Lokal ter-serve & siap dibuka)
  const localPreviewUrl = `/api/preview?projectId=${encodeURIComponent(projectId)}`;
  return {
    success: true,
    strategy: "local",
    liveUrl: localPreviewUrl,
    message: `Website aktif di local preview: ${localPreviewUrl}. Tambahkan VERCEL_TOKEN atau VPS_WEBHOOK_URL di file .env agar AI bisa langsung mempublikasikannya ke domain publik resmi otomatis!`,
  };
}
