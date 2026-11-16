import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
import { issueStudioSession } from "../src/lib/studioAuth";

function call(path: string, init: { method?: string; host?: string; headers?: Record<string, string> } = {}) {
  const host = init.host ?? "localhost:3000";
  const req = new NextRequest(`http://${host}${path}`, { method: init.method ?? "GET", headers: { host, ...(init.headers ?? {}) } });
  return proxy(req);
}
const passed = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("proxy: semua API dijaga", () => {
  const saved = { pin: process.env.STUDIO_PIN, lan: process.env.VOX_ALLOW_LAN };
  beforeEach(() => {
    delete process.env.STUDIO_PIN;
    delete process.env.VOX_ALLOW_LAN;
  });
  afterEach(() => {
    if (saved.pin === undefined) delete process.env.STUDIO_PIN; else process.env.STUDIO_PIN = saved.pin;
    if (saved.lan === undefined) delete process.env.VOX_ALLOW_LAN; else process.env.VOX_ALLOW_LAN = saved.lan;
  });

  describe("dengan STUDIO_PIN", () => {
    beforeEach(() => { process.env.STUDIO_PIN = "123456"; });

    it.each(["/api/chat", "/api/terminal", "/api/fs", "/api/upload", "/api/teams", "/api/codesearch", "/api/mcp", "/api/conversations"])(
      "menolak %s tanpa PIN (401)",
      (path) => {
        expect(call(path, { method: "POST" }).status).toBe(401);
        expect(call(path).status).toBe(401);
      },
    );

    it("chat tidak jadi pintu belakang ke terminal", () => {
      expect(call("/api/chat", { method: "POST", headers: { "sec-fetch-site": "same-origin" } }).status).toBe(401);
    });

    it("meloloskan request dengan sesi valid", () => {
      const cookie = `vox_studio_session=${issueStudioSession("123456")}`;
      expect(passed(call("/api/chat", { method: "POST", headers: { cookie, "sec-fetch-site": "same-origin" } }))).toBe(true);
    });

    it("menolak PIN salah", () => {
      expect(call("/api/terminal", { method: "POST", headers: { "x-studio-pin": "000000" } }).status).toBe(401);
    });

    it("pintu login dan pengecualian tetap terbuka", () => {
      expect(passed(call("/api/auth/pin", { method: "POST", headers: { "sec-fetch-site": "same-origin" } }))).toBe(true);
      expect(passed(call("/api/auth/pin"))).toBe(true);
      expect(passed(call("/api/preview?projectId=x"))).toBe(true);
      expect(passed(call("/api/data/toko/pesanan", { method: "POST" }))).toBe(true);
    });

    it("POST ke /api/preview tetap dijaga", () => {
      expect(call("/api/preview", { method: "POST" }).status).toBe(401);
    });
  });

  describe("tanpa STUDIO_PIN", () => {
    it("localhost boleh", () => {
      expect(passed(call("/api/chat", { method: "POST", headers: { "sec-fetch-site": "same-origin" } }))).toBe(true);
    });

    it("akses lewat IP jaringan ditolak (403)", () => {
      expect(call("/api/chat", { method: "POST", host: "192.168.1.10:3000" }).status).toBe(403);
      expect(call("/api/conversations", { host: "192.168.1.10:3000" }).status).toBe(403);
    });

    it("tunnel (X-Forwarded-For dari luar) ditolak", () => {
      expect(call("/api/terminal", { method: "POST", headers: { "x-forwarded-for": "8.8.8.8" } }).status).toBe(403);
    });

    it("mode jaringan menolak semua API walau Host dipalsukan jadi localhost", () => {
      process.env.VOX_ALLOW_LAN = "1";
      expect(call("/api/terminal", { method: "POST" }).status).toBe(403);
      expect(passed(call("/api/auth/pin"))).toBe(true);
    });
  });

  it("CSRF: mutasi lintas-origin ditolak walau PIN valid", () => {
    process.env.STUDIO_PIN = "123456";
    const res = call("/api/chat", { method: "POST", headers: { "x-studio-pin": "123456", "sec-fetch-site": "cross-site" } });
    expect(res.status).toBe(403);
  });
});
