import vm from "node:vm";

/**
 * Pemeriksa sintaks JS untuk <script> inline pada website hasil AI.
 * Satu salah ketik (mis. tanda kutip tak tertutup) membuat SELURUH blok script mati,
 * jadi tiap blok di-parse (tanpa dijalankan) dan salah ketik umum diperbaiki otomatis.
 */

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

function syntaxError(code: string): { message: string; line: number } | null {
  try {
    new vm.Script(code, { filename: "inline.js" });
    return null;
  } catch (e) {
    const err = e as Error;
    const m = /inline\.js:(\d+)/.exec(err.stack || "");
    return { message: err.message, line: m ? parseInt(m[1], 10) : 0 };
  }
}

function unescapedCount(line: string, ch: string) {
  let n = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\\") {
      i++;
      continue;
    }
    if (line[i] === ch) n++;
  }
  return n;
}

/** Kandidat perbaikan: sisipkan kutip penutup di beberapa posisi masuk akal. Urutan = peluang terbesar dulu. */
function quoteCandidates(line: string): string[] {
  const out: string[] = [];
  for (const q of ["'", '"', "`"]) {
    if (unescapedCount(line, q) % 2 !== 1) continue;
    const t = line.replace(/\s+$/, "");
    const semi = /(;+)$/.exec(t);
    if (semi) out.push(t.slice(0, t.length - semi[1].length) + q + semi[1]);
    const tail = /([;,)\]}]+)$/.exec(t);
    if (tail) out.push(t.slice(0, t.length - tail[1].length) + q + tail[1]);
    out.push(t + q);
  }
  return [...new Set(out)];
}

export interface RepairResult {
  html: string;
  fixed: string[];
  failed: string[];
}

export function repairInlineScripts(html: string): RepairResult {
  const fixed: string[] = [];
  const failed: string[] = [];
  const out = html.replace(SCRIPT_RE, (whole, attrs: string, code: string) => {
    if (/\bsrc\s*=/i.test(attrs)) return whole;
    if (/type\s*=\s*["']?(?:module|application\/(?:ld\+)?json|importmap|text\/(?:template|html))/i.test(attrs)) return whole;
    if (!code.trim()) return whole;

    let current = code;
    let err = syntaxError(current);
    if (!err) return whole;

    const first = err.message;
    for (let attempt = 0; attempt < 6 && err; attempt++) {
      const lines = current.split("\n");
      const idx = err.line - 1;
      if (idx < 0 || idx >= lines.length) break;
      let progressed = false;
      for (const cand of quoteCandidates(lines[idx])) {
        const trial = [...lines.slice(0, idx), cand, ...lines.slice(idx + 1)].join("\n");
        const e2 = syntaxError(trial);
        // diterima bila script lolos, atau error pindah ke baris setelahnya (ada kemajuan)
        if (!e2 || e2.line > err.line) {
          current = trial;
          err = e2;
          progressed = true;
          break;
        }
      }
      if (!progressed) break;
    }
    if (!err) {
      fixed.push(first);
      return `<script${attrs}>${current}</script>`;
    }
    failed.push(`${first} (baris ${err.line})`);
    return whole;
  });
  return { html: out, fixed, failed };
}
