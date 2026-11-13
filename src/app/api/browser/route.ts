import { NextResponse } from "next/server";
import { launchInteractiveLoginWindow, openPage, readShot } from "@/lib/browser";

export async function GET(req: Request) {
  const shot = new URL(req.url).searchParams.get("shot") || "";
  const buf = await readShot(shot);
  if (!buf) return NextResponse.json({ success: false, error: "Tidak ada" }, { status: 404 });
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.action === "login_window") {
      const res = await launchInteractiveLoginWindow(body.url || "https://www.linkedin.com/login");
      return NextResponse.json({ success: true, ...res });
    }
    const { url, screenshot, fullPage } = body;
    if (typeof url !== "string" || !url.trim()) return NextResponse.json({ success: false, error: "url kosong" }, { status: 400 });
    const page = await openPage(url.trim(), { screenshot: !!screenshot, fullPage: !!fullPage });
    return NextResponse.json({ success: true, ...page });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
  }
}
