/**
 * Penyimpanan JSON atomic untuk mesin VOX (workflow, routine, memory, akun provider).
 *
 * Pola yang dipakai sama dengan `src/lib/storage.ts`: satu mutex per berkas supaya request
 * paralel nggak saling menimpa, tulis ke `.tmp` lalu `rename` (atomic di POSIX), dan simpan
 * salinan `.bak` sebelum menimpa biar berkas rusak masih bisa dipulihkan.
 */

import fs from "fs/promises";
import path from "path";

const ENGINE_DIR = path.join(process.cwd(), ".data", "engine");

/** Direktori data mesin; dipakai juga oleh automation handshake. */
export function engineDir(): string {
  return process.env.VOX_ENGINE_DIR || ENGINE_DIR;
}

const locks = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(
    key,
    next.catch(() => {})
  );
  return next;
}

function fileOf(name: string): string {
  return path.join(engineDir(), `${name}.json`);
}

async function readRaw<T>(name: string, fallback: T): Promise<T> {
  const file = fileOf(name);
  for (const candidate of [file, `${file}.bak`]) {
    try {
      const text = await fs.readFile(candidate, "utf-8");
      if (!text.trim()) continue;
      return JSON.parse(text) as T;
    } catch {
      // berkas belum ada atau rusak: coba cadangan, lalu fallback
    }
  }
  return fallback;
}

async function writeRaw(name: string, value: unknown): Promise<void> {
  const file = fileOf(name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf-8");
  try {
    const current = await fs.readFile(file, "utf-8");
    if (current.trim()) await fs.writeFile(`${file}.bak`, current, "utf-8");
  } catch {
    // belum ada berkas sebelumnya, nggak perlu cadangan
  }
  await fs.rename(tmp, file);
}

/** Baca isi koleksi (aman dipanggil sebelum berkasnya pernah dibuat). */
export function readCollection<T>(name: string): Promise<T[]> {
  return withLock(name, () => readRaw<T[]>(name, []));
}

/** Ubah koleksi dalam satu kunci: baca → `mutate` → tulis. Mengembalikan nilai dari `mutate`. */
export function updateCollection<T, R>(
  name: string,
  mutate: (items: T[]) => R | Promise<R>
): Promise<R> {
  return withLock(name, async () => {
    const items = await readRaw<T[]>(name, []);
    const result = await mutate(items);
    await writeRaw(name, items);
    return result;
  });
}

/** Baca satu dokumen (bukan koleksi), mis. state scheduler. */
export function readDoc<T>(name: string, fallback: T): Promise<T> {
  return withLock(name, () => readRaw<T>(name, fallback));
}

/** Tulis satu dokumen. */
export function writeDoc<T>(name: string, value: T): Promise<void> {
  return withLock(name, () => writeRaw(name, value));
}

/** ID pendek yang urut waktu, biar gampang dibaca di log. */
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
