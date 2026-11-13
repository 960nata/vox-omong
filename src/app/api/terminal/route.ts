import { NextResponse } from "next/server";
import { executeTerminal, getTerminalStatus, stopTerminal, TerminalCommandError } from "@/lib/terminalRuntime";

export const runtime = "nodejs";

function failure(error: unknown) {
  return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Terminal gagal." }, { status: error instanceof TerminalCommandError ? error.status : 400 });
}

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    return NextResponse.json(await getTerminalStatus(params.get("projectId") || undefined, params.get("cwd") || undefined));
  } catch (error) { return failure(error); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") throw new TerminalCommandError("Permintaan terminal tidak valid.");
    for (const key of ["projectId", "cwd"] as const) {
      if (body[key] !== undefined && typeof body[key] !== "string") throw new TerminalCommandError(`${key} harus berupa teks.`);
    }
    if (body.action === "status") return NextResponse.json(await getTerminalStatus(body.projectId, body.cwd));
    if (body.action === "stop") return NextResponse.json(await stopTerminal(body.projectId, body.cwd));
    if (body.action && body.action !== "execute") throw new TerminalCommandError("Action terminal tidak dikenal.");
    if (typeof body.command !== "string") throw new TerminalCommandError("Command is required");
    return NextResponse.json(await executeTerminal({ command: body.command, projectId: body.projectId, cwd: body.cwd }));
  } catch (error) { return failure(error); }
}
