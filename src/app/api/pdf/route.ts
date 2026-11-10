import { getBrowser } from "@/lib/browser";

export const runtime = "nodejs";

/** HTML (dokumen/invoice/surat buatan app) -> file PDF asli lewat Chrome headless. */
export async function POST(req: Request) {
  let body: { html?: string; filename?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "body tidak valid" }, { status: 400 }); }
  const html = String(body.html || "");
  if (!html || html.length > 4_000_000) return Response.json({ error: "html kosong atau terlalu besar" }, { status: 400 });
  const name = (String(body.filename || "dokumen").replace(/[^\w\- ]+/g, "").trim() || "dokumen").slice(0, 80);
  const b = await getBrowser();
  const ctx = await b.newContext({ serviceWorkers: "block", acceptDownloads: false, javaScriptEnabled: false });
  try {
    await ctx.route("**/*", (r) => {
      const u = r.request().url();
      return /^(data:|about:|https:\/\/(images\.unsplash\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\/)/.test(u) ? r.continue() : r.abort();
    });
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 20000 });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` },
    });
  } catch (e) {
    return Response.json({ error: `gagal membuat PDF: ${(e as Error).message.slice(0, 160)}` }, { status: 500 });
  } finally {
    await ctx.close().catch(() => {});
  }
}
