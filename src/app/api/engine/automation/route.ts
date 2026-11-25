import { NextRequest, NextResponse } from "next/server";
import {
  bootEngine,
  clearAutomationHandshake,
  handleAutomationCommand,
  verifyAutomationToken,
  writeAutomationHandshake,
} from "@/lib/engine";
import { allowEngineRequest } from "@/lib/engine/guard";
import type { AutomationCommand } from "@/lib/engine";

export const runtime = "nodejs";

/**
 * Control plane untuk `scripts/vox-cli.mjs`.
 *
 * - `GET`  (sesi studio): nyalakan handshake, tulis URL + token ke `.data/engine/automation/`.
 * - `POST` (token automation): perintah dari CLI. Tokennya hanya dari berkas, bukan argumen.
 */
export async function GET(req: NextRequest) {
  if (!allowEngineRequest(req)) {
    return NextResponse.json({ success: false, error: "Butuh sesi studio." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  if (searchParams.get("off") !== null) {
    await clearAutomationHandshake();
    return NextResponse.json({ success: true, enabled: false });
  }
  const origin = new URL(req.url).origin;
  const { url } = await writeAutomationHandshake(`${origin}/api/engine/automation`);
  // Tokennya tidak pernah dikirim balik lewat HTTP; CLI membacanya dari berkas lokal.
  return NextResponse.json({ success: true, enabled: true, url });
}

export async function POST(req: NextRequest) {
  if (!(await verifyAutomationToken(req.headers.get("authorization")))) {
    return NextResponse.json({ ok: false, exit: 5, error: "Token automation tidak sah." }, { status: 401 });
  }
  bootEngine();
  try {
    const command = (await req.json()) as AutomationCommand;
    const result = await handleAutomationCommand(command);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, exit: 1, error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
