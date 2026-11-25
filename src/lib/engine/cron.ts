/**
 * Cron 5 field (`menit jam tanggal bulan hari`) dengan timezone IANA.
 *
 * Yang didukung per field: bintang, angka, daftar `1,15`, rentang `1-5`, dan langkah (slash), mis. tiap 5 menit.
 * Hari minggu: 0–7 (0 dan 7 = Minggu). Kalau tanggal dan hari dua-duanya dibatasi, keduanya harus cocok
 * (lebih ketat daripada cron Unix, tapi lebih gampang ditebak orang).
 *
 * Perhitungan dilakukan di timezone target, jadi "0 7 * * *" di `Asia/Jakarta` tetap jam 7 WIB
 * walau server jalan di UTC — termasuk saat timezone-nya punya DST.
 */

export class CronError extends Error {}

export interface CronFields {
  minute: Set<number>;
  hour: Set<number>;
  dayOfMonth: Set<number> | null;
  month: Set<number>;
  dayOfWeek: Set<number> | null;
}

function parseField(raw: string, min: number, max: number, label: string): Set<number> | null {
  const text = raw.trim();
  if (!text) throw new CronError(`Field ${label} kosong.`);
  if (text === "*") return null;
  const values = new Set<number>();
  for (const part of text.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) throw new CronError(`Langkah "${part}" di ${label} tidak valid.`);
    let from: number;
    let to: number;
    if (rangePart.trim() === "*") {
      from = min;
      to = max;
    } else if (rangePart.includes("-")) {
      const [a, b] = rangePart.split("-").map((n) => Number(n.trim()));
      if (!Number.isInteger(a) || !Number.isInteger(b)) throw new CronError(`Rentang "${part}" di ${label} tidak valid.`);
      from = a;
      to = b;
    } else {
      const value = Number(rangePart.trim());
      if (!Number.isInteger(value)) throw new CronError(`Nilai "${part}" di ${label} tidak valid.`);
      from = value;
      to = stepPart === undefined ? value : max;
    }
    if (from < min || to > max || from > to) throw new CronError(`"${part}" di luar jangkauan ${label} (${min}-${max}).`);
    for (let value = from; value <= to; value += step) values.add(value);
  }
  return values;
}

export function parseCron(expression: string): CronFields {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) throw new CronError("Cron harus 5 field: menit jam tanggal bulan hari.");
  const dayOfWeek = parseField(parts[4], 0, 7, "hari");
  if (dayOfWeek?.has(7)) dayOfWeek.add(0);
  return {
    minute: parseField(parts[0], 0, 59, "menit") ?? new Set(Array.from({ length: 60 }, (_u, i) => i)),
    hour: parseField(parts[1], 0, 23, "jam") ?? new Set(Array.from({ length: 24 }, (_u, i) => i)),
    dayOfMonth: parseField(parts[2], 1, 31, "tanggal"),
    month: parseField(parts[3], 1, 12, "bulan") ?? new Set(Array.from({ length: 12 }, (_u, i) => i + 1)),
    dayOfWeek: dayOfWeek ? new Set([...dayOfWeek].filter((d) => d <= 6)) : null,
  };
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "short",
        hour12: false,
      });
    } catch {
      throw new CronError(`Timezone "${timezone}" tidak dikenal.`);
    }
    formatters.set(timezone, formatter);
  }
  return formatter;
}

/** Pecah sebuah `Date` jadi komponen tanggal/jam di timezone tertentu. */
export function zonedParts(date: Date, timezone: string): ZonedParts {
  const parts = formatterFor(timezone).formatToParts(date);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(pick("hour"));
  return {
    year: Number(pick("year")),
    month: Number(pick("month")),
    day: Number(pick("day")),
    // Beberapa runtime menulis tengah malam sebagai "24" dengan hour12:false.
    hour: hour === 24 ? 0 : hour,
    minute: Number(pick("minute")),
    weekday: WEEKDAYS[pick("weekday")] ?? 0,
  };
}

const MINUTE = 60_000;
/** Batas aman pencarian: 4 tahun ke depan, dihitung per hari/jam/menit (bukan brute force tiap menit). */
const MAX_STEPS = 4 * 366 * 24;

function dateMatches(fields: CronFields, parts: ZonedParts): boolean {
  if (!fields.month.has(parts.month)) return false;
  if (fields.dayOfMonth && !fields.dayOfMonth.has(parts.day)) return false;
  if (fields.dayOfWeek && !fields.dayOfWeek.has(parts.weekday)) return false;
  return true;
}

/**
 * Waktu jalan berikutnya setelah `after` (eksklusif), atau `null` kalau tidak ketemu dalam 4 tahun.
 */
export function nextCronRun(expression: string, timezone: string, after: Date = new Date()): Date | null {
  const fields = parseCron(expression);
  // Mulai dari menit berikutnya, dibulatkan ke bawah ke batas menit.
  let cursor = new Date(Math.floor(after.getTime() / MINUTE) * MINUTE + MINUTE);
  for (let step = 0; step < MAX_STEPS; step++) {
    const parts = zonedParts(cursor, timezone);
    if (!dateMatches(fields, parts)) {
      // Lompat ke tengah malam berikutnya di timezone target.
      cursor = new Date(cursor.getTime() + (24 * 60 - (parts.hour * 60 + parts.minute)) * MINUTE);
      continue;
    }
    if (!fields.hour.has(parts.hour)) {
      cursor = new Date(cursor.getTime() + (60 - parts.minute) * MINUTE);
      continue;
    }
    if (!fields.minute.has(parts.minute)) {
      cursor = new Date(cursor.getTime() + MINUTE);
      continue;
    }
    return cursor;
  }
  return null;
}

/** Semua waktu jalan yang terlewat di antara dua titik waktu (untuk kebijakan missed-run). */
export function missedRuns(
  expression: string,
  timezone: string,
  from: Date,
  to: Date,
  limit = 50
): Date[] {
  const found: Date[] = [];
  let cursor = from;
  while (found.length < limit) {
    const next = nextCronRun(expression, timezone, cursor);
    if (!next || next.getTime() > to.getTime()) break;
    found.push(next);
    cursor = next;
  }
  return found;
}
