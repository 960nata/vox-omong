import { NextRequest, NextResponse } from "next/server";
import { allProviderStatus, providerStatus, runProvider } from "@/lib/providers";
import type { ProviderId } from "@/lib/providers";
import { allowEngineRequest } from "@/lib/engine/guard";

export const runtime = "nodejs";

const denied = () => NextResponse.json({ success: false, error: "Butuh sesi studio." }, { status: 401 });

/**
 * Status CLI provider langganan (ChatGPT Plus, Claude Pro/Max, Google AI Pro).
 * Tidak pernah mengembalikan token — hanya terpasang/belum, versinya, dan mode login.
 */
export async function GET(req: NextRequest) {
  if (!allowEngineRequest(req)) return denied();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") as ProviderId | null;
  try {
    if (id) return NextResponse.json({ success: true, provider: await providerStatus(id) });
    const providers = await allProviderStatus();
    return NextResponse.json({
      success: true,
      providers,
      ready: providers.filter((p) => p.bin && p.auth === "subscription").map((p) => p.id),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}

/** Jalankan satu prompt lewat CLI provider. Mode tulis harus diminta eksplisit. */
export async function POST(req: NextRequest) {
  if (!allowEngineRequest(req)) return denied();
  try {
    const body = await req.json();
    const result = await runProvider({
      provider: String(body.provider ?? "codex") as ProviderId,
      prompt: String(body.prompt ?? ""),
      model: body.model ? String(body.model) : undefined,
      cwd: body.cwd ? String(body.cwd) : undefined,
      write: body.write === true,
      timeoutMs: Number.isFinite(body.timeoutMs) ? Number(body.timeoutMs) : undefined,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
