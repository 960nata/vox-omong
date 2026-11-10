import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9-]{6,40}$/.test(id)) return new Response("not found", { status: 404 });
  const html = new URL(req.url).searchParams.get("f") === "html";
  const file = path.join(process.cwd(), ".data", "videos", `${id}.${html ? "html" : "webm"}`);
  try {
    const buf = await fs.readFile(file);
    return new Response(new Uint8Array(buf), {
      headers: html
        ? { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "sandbox allow-scripts; frame-ancestors 'self'" }
        : { "Content-Type": "video/webm", "Content-Disposition": `inline; filename="video-${id}.webm"`, "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
