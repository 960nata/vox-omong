import type { BrowserContext, Page } from "playwright-core";
import { newGuardedContext } from "./browser";

const TTL = 15 * 60_000;
const MAX_SESSIONS = 5;
type Session = { context: BrowserContext; page: Page; touched: number; busy: boolean; timer?: NodeJS.Timeout; tasks: string[] };
const sessions = new Map<string, Session>();
const creating = new Set<string>();

function alive(s: Session) {
  return !s.page.isClosed() && s.context.browser()?.isConnected();
}

export function browserSessionUrl(id: string): string | undefined {
  const s = sessions.get(id);
  return s && alive(s) && /^https?:\/\//i.test(s.page.url()) && (s.busy || Date.now() - s.touched < TTL) ? s.page.url() : undefined;
}

async function dispose(id: string, s: Session) {
  if (sessions.get(id) === s) sessions.delete(id);
  clearTimeout(s.timer);
  await s.context.close().catch(() => {});
}

function schedule(id: string, s: Session) {
  clearTimeout(s.timer);
  s.timer = setTimeout(() => {
    if (s.busy) schedule(id, s);
    else void dispose(id, s);
  }, TTL);
  s.timer.unref?.();
}

export async function closeBrowserSession(id: string): Promise<boolean> {
  const s = sessions.get(id);
  if (!s) return false;
  if (s.busy) throw new Error("Browser masih mengerjakan tugas sebelumnya.");
  await dispose(id, s);
  return true;
}

/** Satu halaman per chat, maksimal satu tugas pada halaman itu pada satu waktu. */
export async function acquireBrowserSession(id: string) {
  if (creating.has(id)) throw new Error("Browser untuk chat ini sedang dibuka. Coba lagi sebentar.");
  let s = sessions.get(id);
  if (s?.busy) throw new Error("Browser masih mengerjakan tugas sebelumnya.");
  if (s && (!alive(s) || Date.now() - s.touched >= TTL)) {
    creating.add(id);
    await dispose(id, s);
    s = undefined;
  }
  if (!s) {
    creating.add(id);
    try {
      if (sessions.size + creating.size > MAX_SESSIONS) {
        const oldest = [...sessions.entries()].filter(([, v]) => !v.busy).sort((a, b) => a[1].touched - b[1].touched)[0];
        if (!oldest) throw new Error("Semua sesi browser sedang dipakai. Coba lagi setelah tugas selesai.");
        await dispose(...oldest);
      }
      const context = await newGuardedContext();
      try {
        s = { context, page: await context.newPage(), touched: Date.now(), busy: true, tasks: [] };
        sessions.set(id, s);
      } catch (e) {
        await context.close().catch(() => {});
        throw e;
      }
    } finally {
      creating.delete(id);
    }
  }
  s.busy = true;
  s.touched = Date.now();
  const session = s;
  schedule(id, session);
  return {
    page: session.page,
    previousTasks: [...session.tasks],
    release(task: string) {
      session.tasks = [...session.tasks, task.slice(0, 600)].slice(-4);
      session.busy = false;
      session.touched = Date.now();
      schedule(id, session);
    },
  };
}
