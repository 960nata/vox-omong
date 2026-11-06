import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function runGit(cmd: string) {
  return await execAsync(cmd, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: `${process.env.PATH}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
    },
  });
}

export async function GET() {
  try {
    // Check if git is initialized
    let isInitialized = false;
    let branch = "main";
    let statusOutput = "";
    let remoteUrl = "";

    try {
      await runGit("git rev-parse --is-inside-work-tree");
      isInitialized = true;
    } catch {
      isInitialized = false;
    }

    if (isInitialized) {
      try {
        const { stdout: bOut } = await runGit("git branch --show-current");
        branch = bOut.trim() || "main";
      } catch {}

      try {
        const { stdout: sOut } = await runGit("git status --short");
        statusOutput = sOut.trim();
      } catch {}

      try {
        const { stdout: rOut } = await runGit("git remote get-url origin");
        remoteUrl = rOut.trim();
      } catch {}
    }

    return NextResponse.json({
      success: true,
      isInitialized,
      branch,
      hasChanges: Boolean(statusOutput),
      statusOutput,
      remoteUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to query git" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { action, repoUrl, commitMessage = "feat: update project via VOX·AI Studio", token } = await req.json();

    if (action === "init") {
      await runGit("git init");
      await runGit("git branch -M main");
      return NextResponse.json({ success: true, message: "Git repository initialized on branch main." });
    }

    if (action === "set_remote") {
      if (!repoUrl) {
        return NextResponse.json({ success: false, error: "Repository URL is required" }, { status: 400 });
      }

      // If token provided and url is https, embed token safely
      let finalUrl = repoUrl.trim();
      if (token && finalUrl.startsWith("https://github.com/")) {
        const repoPath = finalUrl.replace("https://github.com/", "");
        finalUrl = `https://${token}@github.com/${repoPath}`;
      }

      try {
        await runGit(`git remote remove origin`);
      } catch {}

      await runGit(`git remote add origin ${finalUrl}`);
      return NextResponse.json({ success: true, message: "Remote origin updated successfully." });
    }

    if (action === "commit_and_push") {
      await runGit("git add -A");
      try {
        await runGit(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);
      } catch (e: any) {
        if (!e.message.includes("nothing to commit")) {
          throw e;
        }
      }

      try {
        const { stdout, stderr } = await runGit("git push -u origin main");
        return NextResponse.json({
          success: true,
          message: "Perubahan berhasil di-commit dan di-push ke GitHub!",
          output: stdout || stderr,
        });
      } catch (pushErr: any) {
        return NextResponse.json({
          success: false,
          error: `Gagal push ke GitHub: ${pushErr.stderr || pushErr.message}. Pastikan Remote URL & Token GitHub sudah diset dengan benar.`,
        });
      }
    }

    if (action === "pull") {
      try {
        const { stdout, stderr } = await runGit("git pull origin main");
        return NextResponse.json({
          success: true,
          message: "Git pull berhasil dilakukan.",
          output: stdout || stderr,
        });
      } catch (pullErr: any) {
        return NextResponse.json({
          success: false,
          error: `Gagal pull: ${pullErr.stderr || pullErr.message}`,
        });
      }
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/git error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to perform git action" },
      { status: 500 }
    );
  }
}
