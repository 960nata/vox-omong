/**
 * Ringkas output terminal sebelum masuk percakapan/LLM: baris error + ekor output.
 * Log `npm install` 2.000 baris tidak perlu dibaca model; yang penting gagalnya di mana dan akhirnya apa.
 */
const ANSI = /\u001b\[[0-9;?]*[a-zA-Z]|\u001b\][^\u0007]*\u0007|\r(?!\n)/g;
const ERROR_LINE = /\b(?:error|err!|failed|failure|exception|traceback|fatal|cannot find|not found|undefined is not|denied|ENOENT|EACCES|ELIFECYCLE)\b|✖|✗/i;

export function stripAnsi(text: string): string {
  return text.replace(ANSI, "");
}

export function digestOutput(raw: string, opts: { tail?: number; errors?: number; maxChars?: number } = {}): string {
  const tail = opts.tail ?? 40, maxErrors = opts.errors ?? 12, maxChars = opts.maxChars ?? 4000;
  const lines: string[] = [];
  let repeat = 0;
  for (const line of stripAnsi(raw).split("\n").map((l) => l.trimEnd())) {
    if (lines.length && line === lines[lines.length - 1]) { repeat++; continue; }
    if (repeat) { lines.push(`  (baris di atas berulang ${repeat}x)`); repeat = 0; }
    lines.push(line);
  }
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  if (lines.length <= tail + 5 && lines.join("\n").length <= maxChars) return lines.join("\n");
  const head = lines.slice(0, lines.length - tail);
  const errors = head.filter((l) => ERROR_LINE.test(l)).slice(0, maxErrors);
  const out = [
    `[${head.length} baris awal dipangkas]`,
    ...(errors.length ? ["Baris error dari bagian yang dipangkas:", ...errors, "--- ekor output ---"] : []),
    ...lines.slice(-tail),
  ].join("\n");
  return out.length > maxChars ? `[dipangkas]\n${out.slice(-maxChars)}` : out;
}
