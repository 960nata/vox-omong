import { NextResponse } from "next/server";
import { hasStudioSession, issueStudioSession, studioSessionCookie } from "@/lib/studioAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const pin = process.env.STUDIO_PIN;
  return NextResponse.json({
    required: Boolean(pin && pin.trim().length > 0),
    authorized: hasStudioSession(req),
  });
}

export async function POST(req: Request) {
  const pin = process.env.STUDIO_PIN;
  if (!pin || pin.trim().length === 0) {
    return NextResponse.json({ ok: true, message: "No PIN required" });
  }

  try {
    const body = await req.json();
    if (String(body.pin).trim() === pin.trim()) {
      const response = NextResponse.json({ ok: true, authorized: true });
      response.headers.set("Set-Cookie", studioSessionCookie(issueStudioSession(pin.trim()), new URL(req.url).protocol === "https:"));
      return response;
    }
    return NextResponse.json({ ok: false, error: "PIN Salah!" }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}
