import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET() {
  try {
    let isLinked = false;
    let projectInfo = "";

    try {
      const { stdout } = await execAsync("vercel project ls", {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PATH: `${process.env.PATH}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/indragandi/npm-global/bin`,
        },
      });
      projectInfo = stdout;
      isLinked = true;
    } catch {
      isLinked = false;
    }

    return NextResponse.json({
      success: true,
      isLinked,
      projectInfo,
      vercelPath: "/Users/indragandi/npm-global/bin/vercel",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { token, isProd = false } = await req.json();

    const activeToken = token || process.env.VERCEL_TOKEN;
    const tokenFlag = activeToken ? `--token=${activeToken}` : "";
    const prodFlag = isProd ? "--prod" : "";

    const cmd = `vercel ${prodFlag} --yes ${tokenFlag}`.trim();

    const { stdout, stderr } = await execAsync(cmd, {
      cwd: process.cwd(),
      timeout: 120000,
      env: {
        ...process.env,
        PATH: `${process.env.PATH}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/indragandi/npm-global/bin`,
      },
    });

    // Extract deployed URL if found in output
    const match = (stdout + stderr).match(/https:\/\/[a-zA-Z0-9-]+\.vercel\.app/);
    const deployUrl = match ? match[0] : null;

    return NextResponse.json({
      success: true,
      message: isProd ? "Deploy ke Vercel Production Berhasil!" : "Deploy ke Vercel Preview Berhasil!",
      deployUrl,
      output: stdout || stderr,
    });
  } catch (error: any) {
    console.error("POST /api/vercel error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.stderr || error.message || "Vercel deploy failed",
        output: error.stdout,
      },
      { status: 500 }
    );
  }
}
