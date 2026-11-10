import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export const dynamic = "force-dynamic";

/**
 * Text-to-speech Edge Neural, di-stream:
 * - GET  /api/tts?text=..&voice=..&rate=..&pitch=..  → <audio src> bisa mulai main sebelum file selesai
 * - POST /api/tts {text, voice, rate, pitch}         → kompatibel dengan klien lama
 * Kalimat pendek yang sering dipakai (mis. "oke, bentar ya") di-cache di memori.
 */

const cache = new Map<string, Uint8Array>();
const CACHE_MAX = 80;

function cleanText(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#+\s/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function pct(n: number) {
  const p = Math.round((n - 1) * 100);
  return p >= 0 ? `+${p}%` : `${p}%`;
}

async function synthesize(text: string, voice: string, rate: number, pitch: number): Promise<Response> {
  const clean = cleanText(text).slice(0, 1200);
  if (!clean) return Response.json({ success: false, error: "Text is required" }, { status: 400 });

  const key = `${voice}|${rate}|${pitch}|${clean}`;
  const hit = cache.get(key);
  const headers = { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" };
  if (hit) return new Response(hit.slice(), { headers });

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(clean, { rate: pct(rate), pitch: pct(pitch) });

  const chunks: Uint8Array[] = [];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      audioStream.on("data", (chunk: Buffer) => {
        const u = new Uint8Array(chunk);
        chunks.push(u);
        controller.enqueue(u);
      });
      audioStream.on("end", () => {
        controller.close();
        tts.close();
        if (clean.length <= 160) {
          const total = chunks.reduce((a, c) => a + c.length, 0);
          const all = new Uint8Array(total);
          let off = 0;
          for (const c of chunks) {
            all.set(c, off);
            off += c.length;
          }
          cache.set(key, all);
          if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
        }
      });
      audioStream.on("error", (err: Error) => {
        controller.error(err);
        tts.close();
      });
    },
    cancel() {
      tts.close();
    },
  });

  return new Response(stream, { headers });
}

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    return await synthesize(
      q.get("text") || "",
      q.get("voice") || "id-ID-GadisNeural",
      Number(q.get("rate")) || 1,
      Number(q.get("pitch")) || 1
    );
  } catch (error) {
    console.error("GET /api/tts error:", error);
    return Response.json({ success: false, error: "Failed to synthesize speech" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { text = "", voice = "id-ID-GadisNeural", rate = 1, pitch = 1 } = await req.json();
    return await synthesize(String(text), voice, Number(rate) || 1, Number(pitch) || 1);
  } catch (error) {
    console.error("POST /api/tts error:", error);
    return Response.json({ success: false, error: "Failed to synthesize speech" }, { status: 500 });
  }
}
