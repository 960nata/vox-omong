#!/usr/bin/env node
/**
 * 🤖 JARVIS WHATSAPP WALKIE-TALKIE & VOICE BOT
 * 
 * Fitur:
 * 1. Tanpa verifikasi Meta (cukup scan QR code sekali pakai nomor WA kamu).
 * 2. Menerima Voice Note (VN) audio pengguna di WhatsApp.
 * 3. Transkripsi audio otomatis via Groq Whisper / OpenAI / Gemini.
 * 4. Berpikir menggunakan Jarvis AI & menghasilkan jawaban ringkas dan alami.
 * 5. Mengirim balik jawaban sebagai Voice Note suara (PTT / Voice Note hijau di WhatsApp) via MsEdgeTTS.
 * 6. Bisa juga menerima dan membalas chat teks biasa.
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  downloadMediaMessage,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import fs from "fs";
import path from "path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// 1. Muat environment variable dari .env dan .env.local
function loadEnv() {
  const envFiles = [".env", ".env.local"];
  for (const file of envFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const idx = trimmed.indexOf("=");
          if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
            if (val && !process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      }
    }
  }
}
loadEnv();

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const GROQ_KEY = process.env.GROQ_API_KEY || "";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const GATEWAY_URL = process.env.AI_GATEWAY_URL || "https://router.classai.id/v1";
const GATEWAY_KEY = process.env.AI_GATEWAY_KEY || process.env.AI_GATEWAY_KEY_CHEAP || "";

// 2. Fungsi Transkripsi Audio (Whisper via Groq / OpenAI / Gemini)
async function transcribeAudio(audioBuffer) {
  // Opsi A: Groq Whisper (Sangat cepat ~300ms)
  if (GROQ_KEY) {
    try {
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: "audio/ogg" });
      formData.append("file", blob, "audio.ogg");
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("language", "id");

      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_KEY}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text?.trim()) return data.text.trim();
      }
    } catch (e) {
      console.warn("Groq transcription failed, trying fallback...", e.message);
    }
  }

  // Opsi B: OpenAI Whisper
  if (OPENAI_KEY) {
    try {
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: "audio/ogg" });
      formData.append("file", blob, "audio.ogg");
      formData.append("model", "whisper-1");
      formData.append("language", "id");

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text?.trim()) return data.text.trim();
      }
    } catch (e) {
      console.warn("OpenAI transcription failed...", e.message);
    }
  }

  // Opsi C: Gemini Multimodal Audio
  if (GEMINI_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inline_data: {
                      mime_type: "audio/ogg",
                      data: audioBuffer.toString("base64"),
                    },
                  },
                  {
                    text: "Tolong transkripsikan audio percakapan bahasa Indonesia ini secara persis dan akurat kata per kata. Hanya keluarkan transkrip teksnya tanpa pengantar.",
                  },
                ],
              },
            ],
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text?.trim()) return text.trim();
      }
    } catch (e) {
      console.warn("Gemini transcription failed...", e.message);
    }
  }

  throw new Error("Tidak ada API key (Groq / OpenAI / Gemini) yang berhasil mentranskripsi audio.");
}

// 3. Fungsi Tanya AI (Next.js Local API / Gemini / Gateway)
async function getAIResponse(userText) {
  // Coba Next.js API lokal terlebih dahulu jika server berjalan
  try {
    const localRes = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userText,
        language: "id-ID",
      }),
    });

    if (localRes.ok) {
      const data = await localRes.json();
      const reply = data.reply || data.conversation?.messages?.slice(-1)[0]?.content;
      if (reply) return reply;
    }
  } catch {
    // Next.js server tidak aktif di port 3000, fallback ke AI langsung
  }

  // Fallback Gemini API
  if (GEMINI_KEY) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: "Kamu adalah Jarvis, asisten AI pintar berbahasa Indonesia. Berikan jawaban yang ramah, ringkas, padat, dan natural untuk didengarkan sebagai pesan suara telepon/VN. Hindari format markdown yang rumit seperti tabel atau banyak bintang/bold.",
              },
            ],
          },
          contents: [{ role: "user", parts: [{ text: userText }] }],
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) return reply;
    }
  }

  // Fallback AI Gateway
  if (GATEWAY_KEY) {
    const res = await fetch(`${GATEWAY_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GATEWAY_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        messages: [
          {
            role: "system",
            content:
              "Kamu adalah Jarvis, asisten AI berbahasa Indonesia santai dan to the point. Jawab singkat dan enak didengar via voice note.",
          },
          { role: "user", content: userText },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "Halo! Ada yang bisa saya bantu?";
    }
  }

  return "Halo! Saya sudah mendengar pesanmu. Sistem Jarvis siap membantu!";
}

// 4. Fungsi Buat Audio Suara (Text-to-Speech via Edge TTS)
async function generateTTSAudio(text, voice = "id-ID-ArdiNeural") {
  const clean = text
    .replace(/[*#`_\[\]()]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .slice(0, 1000)
    .trim();

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(clean, { rate: "+5%", pitch: "+0%" });

  return new Promise((resolve, reject) => {
    const chunks = [];
    audioStream.on("data", (chunk) => chunks.push(chunk));
    audioStream.on("end", () => {
      tts.close();
      resolve(Buffer.concat(chunks));
    });
    audioStream.on("error", (err) => {
      tts.close();
      reject(err);
    });
  });
}

// 5. Inisialisasi Bot Baileys
async function startBot() {
  const sessionDir = path.join(process.cwd(), ".data", "wa_session");
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["Jarvis AI Assistant", "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.clear();
      console.log("\n=======================================================");
      console.log("📲 SCAN QR CODE DI BAWAH PAKAI WHATSAPP HP KAMU:");
      console.log("=======================================================\n");
      qrcode.generate(qr, { small: true });
      console.log("\nBuka WhatsApp di HP → Perangkat Tertaut → Tautkan Perangkat.");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`\n⚠️ Koneksi terputus (status: ${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === "open") {
      console.clear();
      console.log("\n=======================================================");
      console.log("🚀 JARVIS WHATSAPP VOICE & WALKIE-TALKIE BOT SIAP!");
      console.log("=======================================================");
      console.log("✅ Terhubung ke nomor WhatsApp.");
      console.log("🎙️ Coba kirim Voice Note (VN) atau pesan teks ke nomor ini.");
      console.log("📞 Jarvis akan mendengarkan dan membalas pakai VN suara!");
      console.log("=======================================================\n");
    }
  });

  // Handle Pesan Masuk
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const senderJid = msg.key.remoteJid;
    if (senderJid.includes("@broadcast")) return;

    const isAudio = Boolean(msg.message.audioMessage);
    const textContent =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    console.log(`\n📥 Pesan masuk dari: ${senderJid.split("@")[0]}`);

    try {
      // Skenario A: Pengguna Mengirim Voice Note (VN)
      if (isAudio) {
        console.log("🎙️ Menerima Voice Note! Sedang mengunduh audio...");
        await sock.sendMessage(senderJid, { react: { text: "⏳", key: msg.key } });

        const audioBuffer = await downloadMediaMessage(
          msg,
          "buffer",
          {},
          { logger: pino({ level: "silent" }), reuploadRequest: sock.updateMediaMessage }
        );

        console.log(`🎧 Audio berhasil diunduh (${audioBuffer.length} bytes). Mentranskripsikan...`);
        const userSpokenText = await transcribeAudio(audioBuffer);
        console.log(`🗣️ Transkripsi Pengguna: "${userSpokenText}"`);

        // Update reaction to thinking
        await sock.sendMessage(senderJid, { react: { text: "🧠", key: msg.key } });

        // Tanya AI
        const aiAnswer = await getAIResponse(userSpokenText);
        console.log(`🤖 Jawaban Jarvis: "${aiAnswer}"`);

        // Buat Audio Suara Balasan (Edge TTS)
        console.log("🔊 Menghasilkan audio suara balasan (Edge TTS)...");
        const ttsAudioBuffer = await generateTTSAudio(aiAnswer, "id-ID-ArdiNeural");

        // Kirim balik sebagai Voice Note WhatsApp (PTT)
        await sock.sendMessage(
          senderJid,
          {
            audio: ttsAudioBuffer,
            mimetype: "audio/mp4",
            ptt: true, // ptt: true menjadikannya Voice Note asli di WhatsApp
          },
          { quoted: msg }
        );

        // Hapus reaction / tandai selesai
        await sock.sendMessage(senderJid, { react: { text: "✅", key: msg.key } });
        console.log("✨ Voice Note balasan berhasil dikirim!");
        return;
      }

      // Skenario B: Pengguna Mengirim Pesan Teks
      if (textContent.trim()) {
        console.log(`💬 Pesan teks: "${textContent}"`);

        // Jika user minta suara / ketik !vn, kita balas dengan VN
        const wantsVoice =
          textContent.startsWith("!vn") ||
          /voice note|kirim suara|pakai suara|ngomong dong/i.test(textContent);

        await sock.sendMessage(senderJid, { react: { text: "⏳", key: msg.key } });

        const cleanText = textContent.replace(/^!vn\s*/i, "");
        const aiAnswer = await getAIResponse(cleanText);

        if (wantsVoice) {
          console.log("🔊 Menghasilkan Voice Note untuk permintaan teks...");
          const ttsAudioBuffer = await generateTTSAudio(aiAnswer, "id-ID-ArdiNeural");
          await sock.sendMessage(
            senderJid,
            {
              audio: ttsAudioBuffer,
              mimetype: "audio/mp4",
              ptt: true,
            },
            { quoted: msg }
          );
        } else {
          // Balas teks biasa + sertakan link Web Phone
          const replyMessage =
            `${aiAnswer}\n\n` +
            `───────────────\n` +
            `💡 *Tips:* Kamu bisa langsung kirim *Voice Note (VN)* ke chat ini untuk ngobrol suara, atau telepon langsung di web browser: http://localhost:3000/call`;

          await sock.sendMessage(senderJid, { text: replyMessage }, { quoted: msg });
        }

        await sock.sendMessage(senderJid, { react: { text: "✅", key: msg.key } });
      }
    } catch (err) {
      console.error("❌ Terjadi kesalahan saat memproses pesan:", err);
      await sock.sendMessage(
        senderJid,
        {
          text: `⚠️ Maaf, Jarvis mengalami kendala memproses pesan: ${err.message}`,
        },
        { quoted: msg }
      );
    }
  });
}

startBot().catch((err) => {
  console.error("Fatal bot error:", err);
});
