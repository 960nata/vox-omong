import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { issueStudioSession, hasStudioSession, isLoopbackRequest } from "../src/lib/studioAuth";

describe("Studio Auth & Route Guard", () => {
  const originalPin = process.env.STUDIO_PIN;

  beforeEach(() => {
    process.env.STUDIO_PIN = "123456";
  });

  afterEach(() => {
    process.env.STUDIO_PIN = originalPin;
  });

  it("authenticates via valid cookie HMAC session", () => {
    const sessionVal = issueStudioSession("123456");
    const req = new Request("http://localhost:3000/api/terminal", {
      headers: {
        cookie: `vox_studio_session=${sessionVal}`,
      },
    });
    expect(hasStudioSession(req)).toBe(true);
  });

  it("authenticates via x-studio-pin header", () => {
    const req = new Request("http://localhost:3000/api/terminal", {
      headers: {
        "x-studio-pin": "123456",
      },
    });
    expect(hasStudioSession(req)).toBe(true);
  });

  it("authenticates via Authorization Bearer token", () => {
    const req = new Request("http://localhost:3000/api/terminal", {
      headers: {
        authorization: "Bearer 123456",
      },
    });
    expect(hasStudioSession(req)).toBe(true);
  });

  it("rejects invalid PIN", () => {
    const req = new Request("http://localhost:3000/api/terminal", {
      headers: {
        "x-studio-pin": "999999",
      },
    });
    expect(hasStudioSession(req)).toBe(false);
  });

  it("detects loopback localhost vs remote requests correctly", () => {
    const localReq1 = new Request("http://localhost:3000/api/fs", {
      headers: { host: "localhost:3000" },
    });
    const localReq2 = new Request("http://127.0.0.1:3000/api/fs", {
      headers: { host: "127.0.0.1:3000" },
    });
    const remoteReq = new Request("http://192.168.1.50:3000/api/fs", {
      headers: { host: "192.168.1.50:3000" },
    });

    expect(isLoopbackRequest(localReq1)).toBe(true);
    expect(isLoopbackRequest(localReq2)).toBe(true);
    expect(isLoopbackRequest(remoteReq)).toBe(false);
  });
});
