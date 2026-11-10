"use client";

import React, { useState } from "react";
import { Check, Copy, Play, ChevronDown } from "lucide-react";

type Part = { kind: "text"; text: string } | { kind: "code"; lang: string; code: string };

/** Pecah pesan jadi teks & blok kode. Blok yang tidak ditutup (jawaban terpotong) tetap dianggap kode. */
function parse(content: string): Part[] {
  // Lampiran dokumen ditampilkan sebagai chip kecil, bukan teks panjang
  content = content.replace(/<<lampiran:([^>\n]{1,200})>>\n?([\s\S]*?)<<\/lampiran>>/g, (_, n: string, t: string) => `\n📎 **${n}** · ${t.length.toLocaleString("id-ID")} karakter`);
  const trimmed = content.trim();
  // HTML mentah tanpa ``` → anggap satu blok kode
  if (/^<!DOCTYPE html|^<html[\s>]/i.test(trimmed)) return [{ kind: "code", lang: "html", code: trimmed }];

  const parts: Part[] = [];
  const re = /```([\w+-]*)[^\n]*\n([\s\S]*?)(?:```|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (m.index > last) parts.push({ kind: "text", text: content.slice(last, m.index) });
    parts.push({ kind: "code", lang: (m[1] || "").toLowerCase(), code: m[2].replace(/\n$/, "") });
    last = re.lastIndex;
  }
  if (last < content.length) parts.push({ kind: "text", text: content.slice(last) });
  return parts.filter((p) => (p.kind === "text" ? p.text.trim() : p.code.trim()));
}

/** **tebal**, `kode`, dan judul markdown ringan. */
function Inline({ text }: { text: string }) {
  const lines = text.replace(/^\n+|\n+$/g, "").split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const heading = line.match(/^#{1,4}\s+(.*)$/);
        const body = heading ? heading[1] : line;
        const tokens = body.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((t, k) => {
          if (/^\*\*[^*]+\*\*$/.test(t)) return <strong key={k} className="font-semibold text-fg">{t.slice(2, -2)}</strong>;
          if (/^`[^`]+`$/.test(t))
            return (
              <code key={k} className="px-1.5 py-0.5 rounded-md bg-hover font-mono text-[0.85em] text-fg-2">
                {t.slice(1, -1)}
              </code>
            );
          return <React.Fragment key={k}>{t}</React.Fragment>;
        });
        return (
          <React.Fragment key={i}>
            {heading ? <span className="block font-display font-bold text-fg mt-2">{tokens}</span> : tokens}
            {i < lines.length - 1 && !heading && "\n"}
          </React.Fragment>
        );
      })}
    </>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const lines = code.split("\n").length;
  const isHtml = lang === "html" || /^<!DOCTYPE html|<html[\s>]/i.test(code.trim());
  const long = lines > 18;

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const runInPreview = async () => {
    setRunning(true);
    try {
      let html = code;
      if (!/<html[\s>]/i.test(html)) {
        html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><script src="https://cdn.tailwindcss.com"></script></head><body>${html}</body></html>`;
      }
      if (!html.includes("<!-- vox-ai:generated -->")) html = html.replace(/<head([^>]*)>/i, "<head$1>\n  <!-- vox-ai:generated -->");
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "default-workspace", html }),
      });
      const data = await res.json();
      if (data.success) {
        window.dispatchEvent(new CustomEvent("vox_open_preview", { detail: { url: `${data.url}&t=${Date.now()}` } }));
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="my-2.5 rounded-2xl border border-line bg-base overflow-hidden not-italic">
      <div className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 border-b border-line">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{lang || "kode"}</span>
        <span className="font-mono text-[10px] text-fg-4">{lines} baris</span>
        <div className="ml-auto flex items-center gap-0.5">
          {isHtml && (
            <button
              onClick={runInPreview}
              disabled={running}
              className="lift flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-accent text-on-accent hover:bg-accent-hi cursor-pointer disabled:opacity-60"
            >
              <Play className="w-3 h-3" />
              {running ? "Membuka…" : "Jalankan di Preview"}
            </button>
          )}
          <button
            onClick={copy}
            title={copied ? "Tersalin" : "Salin kode"}
            aria-label="Salin kode"
            className="lift p-1.5 rounded-full text-fg-3 hover:text-fg hover:bg-hover cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-moss" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <div className={`relative ${long && !expanded ? "max-h-72" : "max-h-[70vh]"} overflow-auto`}>
        <pre className="px-3.5 py-3 text-[12.5px] leading-[1.6] font-mono text-fg-2 whitespace-pre select-text">
          <code>{code}</code>
        </pre>
        {long && !expanded && (
          <div className="sticky bottom-0 h-16 -mt-16 bg-gradient-to-t from-base to-transparent pointer-events-none" />
        )}
      </div>
      {long && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-1.5 border-t border-line text-[11px] text-fg-3 hover:text-fg hover:bg-hover cursor-pointer"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Ringkas" : `Lihat semua ${lines} baris`}
        </button>
      )}
    </div>
  );
}

export function MessageContent({ content }: { content: string }) {
  const parts = parse(content);
  return (
    <div className="text-[15px] leading-relaxed text-fg break-words select-text">
      {parts.map((p, i) =>
        p.kind === "code" ? (
          <CodeBlock key={i} lang={p.lang} code={p.code} />
        ) : (
          <div key={i} className="whitespace-pre-wrap">
            <Inline text={p.text} />
          </div>
        )
      )}
    </div>
  );
}
