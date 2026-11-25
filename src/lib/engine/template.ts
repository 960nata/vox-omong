/**
 * Placeholder `{{...}}` untuk input step workflow.
 *
 * Bentuk yang didukung:
 *   {{trigger.kota}}          → field dari trigger
 *   {{riset.ringkasan}}       → field `ringkasan` dari output step `riset`
 *   {{riset}}                 → seluruh output step `riset`
 *   {{riset.items.0.judul}}   → jalur bersarang
 *   {{riset.nama | Tanpa nama}} → nilai default kalau kosong
 *
 * Kalau seluruh string cuma satu placeholder (`"{{riset.jumlah}}"`), nilainya dikembalikan
 * apa adanya (number tetap number). Kalau placeholder ada di tengah teks, hasilnya di-stringify.
 */

export interface TemplateScope {
  /** Output per step, plus kunci khusus `trigger`. */
  [key: string]: unknown;
}

const PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g;

function dig(scope: TemplateScope, pathExpr: string): unknown {
  let current: unknown = scope;
  for (const part of pathExpr.split(".")) {
    const key = part.trim();
    if (!key) return undefined;
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(key);
      if (!Number.isInteger(index)) return undefined;
      current = current[index < 0 ? current.length + index : index];
      continue;
    }
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function resolveExpression(scope: TemplateScope, expression: string): unknown {
  const [pathExpr, ...fallbackParts] = expression.split("|");
  const value = dig(scope, pathExpr);
  if (value !== undefined && value !== null && value !== "") return value;
  if (fallbackParts.length) return fallbackParts.join("|").trim();
  return value;
}

/** Isi placeholder di sebuah string. */
export function fillString(text: string, scope: TemplateScope): unknown {
  const whole = text.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
  if (whole) {
    const value = resolveExpression(scope, whole[1]);
    return value === undefined ? "" : value;
  }
  return text.replace(PLACEHOLDER, (_all, expression: string) =>
    stringify(resolveExpression(scope, expression))
  );
}

/** Isi placeholder di seluruh struktur (objek/array/string) tanpa mengubah input aslinya. */
export function fillTemplate<T>(value: T, scope: TemplateScope): T {
  if (typeof value === "string") return fillString(value, scope) as T;
  if (Array.isArray(value)) return value.map((item) => fillTemplate(item, scope)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = fillTemplate(item, scope);
    }
    return out as T;
  }
  return value;
}

/** Semua ID step yang dirujuk sebuah input — dipakai untuk validasi referensi. */
export function referencedSteps(value: unknown): string[] {
  const found = new Set<string>();
  const walk = (node: unknown) => {
    if (typeof node === "string") {
      for (const match of node.matchAll(PLACEHOLDER)) {
        const head = match[1].split("|")[0].trim().split(".")[0].trim();
        if (head) found.add(head);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === "object") Object.values(node as Record<string, unknown>).forEach(walk);
  };
  walk(value);
  return [...found];
}
