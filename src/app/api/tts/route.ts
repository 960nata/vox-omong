import { NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { text, voice = "id-ID-GadisNeural", rate = 1.0, pitch = 1.0 } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ success: false, error: "Text is required" }, { status: 400 });
    }

    // Clean text: strip markdown stars, code blocks, links to ensure smooth reading
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/#+\s/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();

    const tts = new MsEdgeTTS();

    // Select format
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    // Rate & Pitch prosody format for Edge TTS: e.g. "+0%", "+10%", "-10%"
    const ratePercent = Math.round((rate - 1.0) * 100);
    const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

    const pitchPercent = Math.round((pitch - 1.0) * 100);
    const pitchStr = pitchPercent >= 0 ? `+${pitchPercent}%` : `${pitchPercent}%`;

    const { audioStream } = tts.toStream(cleanText, {
      rate: rateStr,
      pitch: pitchStr,
    });

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      audioStream.on("end", () => resolve());
      audioStream.on("error", (err: Error) => reject(err));
    });

    const audioBuffer = Buffer.concat(chunks);

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("POST /api/tts error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to synthesize speech" },
      { status: 500 }
    );
  }
}
