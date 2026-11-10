/**
 * Parser JSON toleran untuk keluaran model kecil: buang pagar ```, teks pembuka/penutup,
 * koma menggantung, kutip keriting, komentar, dan tutup kurung yang terpotong.
 * Memperbaiki dengan kode = tidak perlu memanggil model lagi.
 */
export function parseLoose<T = unknown>(text: string): T | null {
  if (!text) return null;
  let s = text.replace(/```(?:json|javascript|js)?/gi, "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
  const iObj = s.indexOf("{"), iArr = s.indexOf("[");
  const start = iObj === -1 ? iArr : iArr === -1 ? iObj : Math.min(iObj, iArr);
  if (start === -1) return null;
  s = s.slice(start);

  // potong di akhir struktur pertama yang seimbang; catat kurung yang belum tertutup
  const stack: string[] = [];
  let inStr = false, escp = false, end = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (escp) escp = false;
      else if (c === "\\") escp = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") {
      stack.pop();
      if (!stack.length) { end = i; break; }
    }
  }
  let body = end >= 0 ? s.slice(0, end + 1) : s;
  const tries: string[] = [body];
  const clean = (x: string) => x.replace(/,\s*([}\]])/g, "$1").replace(/^\s*\/\/[^\n]*$/gm, "");
  tries.push(clean(body));
  if (end < 0) {
    // terpotong: tutup string, buang pasangan kunci yang belum lengkap, tutup kurung
    if (inStr) body += '"';
    body = body.replace(/,\s*"[^"]*"\s*:?\s*$/, "").replace(/[,:]\s*$/, "");
    tries.push(clean(body + stack.reverse().join("")));
  }
  for (const t of tries) {
    try { return JSON.parse(t) as T; } catch {}
  }
  return null;
}
