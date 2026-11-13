#!/usr/bin/env node
import { spawn } from "child_process";
import http from "http";

console.clear();
console.log("\x1b[36m%s\x1b[0m", "=====================================================");
console.log("\x1b[1m\x1b[32m%s\x1b[0m", "   🚀 VOX·AI REMOTE & MOBILE LAUNCHER (ZERO BUDGET)  ");
console.log("\x1b[36m%s\x1b[0m", "=====================================================");

// 1. Check if Dev Server (port 3001) is active
function checkServer(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log("\x1b[90m%s\x1b[0m", "🔍 Memeriksa VOX·AI Studio di port 3001...");
  let isRunning = await checkServer(3001);

  let nextProc = null;
  if (!isRunning) {
    console.log("\x1b[33m%s\x1b[0m", "⚡ Menyala-kan Next.js Dev Server (port 3001)...");
    nextProc = spawn("npm", ["run", "dev"], { stdio: "ignore" });
    // wait for it
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await checkServer(3001)) {
        isRunning = true;
        break;
      }
    }
  }

  if (!isRunning) {
    console.error("\x1b[31m%s\x1b[0m", "❌ Gagal mendeteksi VOX·AI di port 3001. Pastikan `npm run dev` jalan.");
    process.exit(1);
  }

  console.log("\x1b[32m%s\x1b[0m", "✅ VOX·AI Studio aktif di http://localhost:3001");

  // 2. Prevent Mac from Sleeping using caffeinate
  let caffeinateProc = null;
  if (process.platform === "darwin") {
    try {
      caffeinateProc = spawn("caffeinate", ["-d", "-i", "-m", "-u"], { stdio: "ignore" });
      console.log("\x1b[35m%s\x1b[0m", "☕ Anti-Sleep Aktif (Mac tidak akan tidur meski layar mati / ditutup)");
    } catch (e) {
      // ignore
    }
  }

  // 3. Start Cloudflare Tunnel for Free HTTPS
  console.log("\x1b[90m%s\x1b[0m", "🌐 Menghubungkan ke Cloudflare Quick Tunnel (Gratis & Resmi HTTPS)...");
  const tunnelProc = spawn("npx", ["--yes", "cloudflared", "tunnel", "--url", "http://localhost:3001"]);

  let publicUrl = null;
  tunnelProc.stderr.on("data", (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && !publicUrl) {
      publicUrl = match[0];
      onTunnelReady(publicUrl);
    }
  });

  function onTunnelReady(url) {
    console.log("\n\x1b[42m\x1b[30m%s\x1b[0m", " 🎉 LINK MOBILE HTTPS SIAP! ");
    console.log("\x1b[1m\x1b[36m%s\x1b[0m\n", ` 👉 ${url}`);

    // Generate terminal QR code
    const qrProc = spawn("npx", ["--yes", "qrcode-terminal", url, "small"], { stdio: "inherit" });
    qrProc.on("close", () => {
      console.log("\n\x1b[1m\x1b[33m%s\x1b[0m", "📱 CARA PAKAI DI HP:");
      console.log(" 1. Buka Kamera HP ➔ Scan QR Code di atas.");
      console.log(" 2. Tombol Mic suara & Audio di HP langsung aktif via HTTPS.");
      console.log(" 3. Laptop bisa lu tinggal di meja dengan layar mati, sistem tetap nyala!");
      console.log("\n\x1b[90m%s\x1b[0m", "Tekan Ctrl+C untuk mematikan tunnel & anti-sleep.");
    });
  }

  const cleanup = () => {
    console.log("\n\x1b[33m%s\x1b[0m", "🛑 Menutup tunnel dan melepaskan mode Anti-Sleep...");
    if (tunnelProc) tunnelProc.kill();
    if (caffeinateProc) caffeinateProc.kill();
    if (nextProc) nextProc.kill();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch(console.error);
