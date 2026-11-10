import { fileToText, READABLE } from "@/lib/fileText";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_CHARS = 30000;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ success: false, error: "file tidak ada" }, { status: 400 });
    if (!READABLE.test(file.name)) return Response.json({ success: false, error: "format belum didukung" }, { status: 400 });
    if (file.size > MAX_BYTES) return Response.json({ success: false, error: "file lebih dari 15 MB" }, { status: 400 });
    const text = await fileToText(file.name, Buffer.from(await file.arrayBuffer()));
    if (!text) return Response.json({ success: false, error: "tidak ada teks yang bisa dibaca (mungkin PDF hasil scan)" }, { status: 422 });
    return Response.json({ success: true, name: file.name, chars: text.length, truncated: text.length > MAX_CHARS, text: text.slice(0, MAX_CHARS) });
  } catch (e) {
    return Response.json({ success: false, error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
