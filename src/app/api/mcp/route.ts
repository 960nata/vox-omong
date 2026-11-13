import { NextResponse } from "next/server";
import { isMcpProvider, listMcpTools, mcpProviderStatus, mcpRequiresStudioSession } from "@/lib/mcpConnections";
import { setMcpCredential, removeMcpCredential } from "@/lib/mcpCredentials";
import { hasStudioSession } from "@/lib/studioAuth";
import { spawn } from "child_process";
import fs from "fs/promises";

export const maxDuration = 30;

export async function GET(req: Request) {
  return NextResponse.json({
    providers: mcpProviderStatus().map((provider) => ({
      ...provider,
      locked: mcpRequiresStudioSession(provider.id) && !hasStudioSession(req),
    })),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const action = body?.action;
  const provider = body?.provider;

  if (!isMcpProvider(provider)) {
    return NextResponse.json({ error: "Pilihan MCP tidak valid." }, { status: 400 });
  }

  if (mcpRequiresStudioSession(provider) && !hasStudioSession(req)) {
    return NextResponse.json({ error: "Aktifkan PIN Studio dan masuk dulu untuk memakai MCP ini." }, { status: 403 });
  }

  // 1. Action: Save Token & Connect
  if (action === "connect") {
    try {
      const { token, customUrl } = body;
      await setMcpCredential(provider, { token, customUrl });
      const tools = await listMcpTools(provider);
      return NextResponse.json({
        success: true,
        connected: true,
        toolCount: tools.length,
        readableTools: tools.filter((t) => t.readOnly).length,
      });
    } catch (error) {
      const message = (error as Error).message;
      return NextResponse.json({ connected: false, error: message }, { status: 400 });
    }
  }

  // 2. Action: Disconnect & Remove Token
  if (action === "disconnect") {
    await removeMcpCredential(provider);
    return NextResponse.json({ success: true, connected: false });
  }

  // 3. Action: Auto-Launch Local Server (Chrome DevTools / Playwright)
  if (action === "start_local") {
    if (provider === "chrome-devtools") {
      try {
        const candidates = [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/usr/bin/google-chrome",
          "/usr/bin/chromium",
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        ];
        let chromeBin = "";
        for (const c of candidates) {
          try {
            await fs.access(c);
            chromeBin = c;
            break;
          } catch {}
        }
        if (!chromeBin) {
          return NextResponse.json({ error: "Google Chrome tidak terdeteksi di laptop ini." }, { status: 404 });
        }

        const child = spawn(chromeBin, ["--remote-debugging-port=9222", "--headless=new", "--no-first-run", "--disable-extensions"], {
          detached: true,
          stdio: "ignore",
        });
        child.unref();

        // Wait a moment for port 9222 to bind
        await new Promise((r) => setTimeout(r, 1500));
        return NextResponse.json({
          success: true,
          message: "Chrome DevTools berhasil diluncurkan di background pada port 9222!",
        });
      } catch (err) {
        return NextResponse.json({ error: `Gagal meluncurkan Chrome: ${(err as Error).message}` }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "Peluncuran lokal hanya didukung untuk Chrome DevTools." }, { status: 400 });
  }

  // 4. Action: Test Connection
  try {
    const tools = await listMcpTools(provider);
    return NextResponse.json({ connected: true, toolCount: tools.length, readableTools: tools.filter((tool) => tool.readOnly).length });
  } catch (error) {
    const message = (error as Error).message;
    let reason = message.slice(0, 180);
    if (/401|403|unauthoriz|forbidden/i.test(message)) {
      reason = "Izin akun atau API key ditolak.";
    } else if (/ECONNREFUSED|fetch failed|network/i.test(message)) {
      if (provider === "chrome-devtools") {
        reason = "Server lokal port 9222 belum aktif di laptop.";
      } else if (provider === "playwright") {
        reason = "Server lokal port 8931 belum aktif di laptop.";
      } else {
        reason = "Server MCP belum bisa dijangkau.";
      }
    }
    return NextResponse.json({ connected: false, error: reason }, { status: 502 });
  }
}
