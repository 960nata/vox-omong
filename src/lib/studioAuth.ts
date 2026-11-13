import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "vox_studio_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function signature(value: string, pin: string) {
  return createHmac("sha256", pin).update(`vox-studio:${value}`).digest("hex");
}

export function issueStudioSession(pin: string): string {
  const timestamp = String(Date.now());
  return `${timestamp}.${signature(timestamp, pin)}`;
}

export function studioSessionCookie(value: string, secure: boolean): string {
  return `${COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}${secure ? "; Secure" : ""}`;
}

export function hasStudioSession(req: Request): boolean {
  const pin = process.env.STUDIO_PIN?.trim();
  if (!pin) return false;
  const encoded = req.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!encoded) return false;
  const [timestamp, supplied] = encoded.split(".");
  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_SECONDS * 1000 || !/^[a-f0-9]{64}$/.test(supplied || "")) return false;
  const expected = Buffer.from(signature(timestamp, pin), "hex");
  return timingSafeEqual(expected, Buffer.from(supplied, "hex"));
}
