import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { projectDir } from "@/lib/projectDir";

const execAsync = promisify(exec);

// Allowed command prefixes for developer safety
const BLOCKED_PATTERNS = [/rm\s+-rf\s+\/($|\s)/, /mkfs/, /dd\s+if=/, />\s*\/dev\/sd/];

export async function POST(req: Request) {
  try {
    const { command, projectId } = await req.json();

    if (!command || typeof command !== "string" || !command.trim()) {
      return NextResponse.json({ success: false, error: "Command is required" }, { status: 400 });
    }

    const cleanCommand = command.trim();

    // Safety check
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(cleanCommand)) {
        return NextResponse.json(
          { success: false, error: "Perintah berbahaya ditolak oleh sistem keamanan." },
          { status: 403 }
        );
      }
    }

    const startTime = Date.now();
    // Terminal bekerja di folder PROJECT AKTIF, bukan folder aplikasi Jarvis
    const workingDir = await projectDir(projectId);

    try {
      const { stdout, stderr } = await execAsync(cleanCommand, {
        cwd: workingDir,
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 5, // 5MB
        env: {
          ...process.env,
          PATH: `${process.env.PATH}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/indragandi/npm-global/bin`,
        },
      });

      const durationMs = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        command: cleanCommand,
        stdout: stdout || "",
        stderr: stderr || "",
        exitCode: 0,
        durationMs,
        workingDir,
      });
    } catch (execError: any) {
      const durationMs = Date.now() - startTime;
      return NextResponse.json({
        success: false,
        command: cleanCommand,
        stdout: execError.stdout || "",
        stderr: execError.stderr || execError.message || "Command failed",
        exitCode: execError.code ?? 1,
        durationMs,
        workingDir,
      });
    }
  } catch (error: any) {
    console.error("POST /api/terminal error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
