"use client";

import React, { useState } from "react";
import { Check, Copy, Play, ChevronDown, Loader2, Rocket, Globe, Maximize2, ExternalLink, X } from "lucide-react";

type Part =
  | { kind: "text"; text: string }
  | { kind: "code"; lang: string; code: string }
  | { kind: "division_card"; divisions: string };

/** Pecah pesan jadi teks, blok kode, dan kartu divisi. */
function parse(content: string): Part[] {
  // Lampiran dokumen ditampilkan sebagai chip kecil, bukan teks panjang
  content = content.replace(/<<lampiran:([^>\n]{1,200})>>\n?([\s\S]*?)<<\/lampiran>>/g, (_, n: string, t: string) => `\n📎 **${n}** · ${t.length.toLocaleString("id-ID")} karakter`);
  const trimmed = content.trim();
  // HTML mentah tanpa ``` → anggap satu blok kode
  if (/^<!DOCTYPE html|^<html[\s>]/i.test(trimmed)) return [{ kind: "code", lang: "html", code: trimmed }];

  const parts: Part[] = [];
  const re = /(```([\w+-]*)[^\n]*\n([\s\S]*?)(?:```|$)|<<rekomendasi_divisi:([^>]+)>>)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (m.index > last) parts.push({ kind: "text", text: content.slice(last, m.index) });
    if (m[1].startsWith("<<rekomendasi_divisi:")) {
      parts.push({ kind: "division_card", divisions: m[4] || "" });
    } else {
      parts.push({ kind: "code", lang: (m[2] || "").toLowerCase(), code: (m[3] || "").replace(/\n$/, "") });
    }
    last = re.lastIndex;
  }
  if (last < content.length) parts.push({ kind: "text", text: content.slice(last) });
  return parts.filter((p) => (p.kind === "text" ? p.text.trim() : true));
}

/** Kartu pratinjau screenshot browser yang responsif, rapi, dan bisa di-zoom */
function BrowserScreenshotPreview({ url, alt }: { url: string; alt?: string }) {
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <>
      <div className="my-3 w-full max-w-2xl rounded-2xl border border-line bg-card shadow-sm overflow-hidden transition-all hover:border-line-strong">
        {/* Mock Browser Top Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-hover/70 border-b border-line text-[11px] text-fg-3 select-none">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 shrink-0" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 shrink-0" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 shrink-0" />
            <span className="ml-2 font-mono text-[10px] text-fg-3 truncate max-w-[180px] sm:max-w-xs flex items-center gap-1">
              <Globe className="w-3 h-3 text-accent shrink-0" />
              <span>{alt || "Tangkapan Layar Browser"}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsZoomed(true)}
              title="Perbesar tangkapan layar"
              className="p-1 rounded-md text-fg-3 hover:text-fg hover:bg-hover transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
              <span className="hidden sm:inline">Perbesar</span>
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title="Buka gambar di tab baru"
              className="p-1 rounded-md text-fg-3 hover:text-accent hover:bg-hover transition-colors flex items-center gap-1 text-[11px]"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Responsive Image Frame with Object Top */}
        <div
          onClick={() => setIsZoomed(true)}
          className="relative bg-white/95 cursor-zoom-in overflow-hidden max-h-[240px] sm:max-h-[320px] flex items-start justify-center group"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- screenshot lokal dinamis */}
          <img
            src={url}
            alt={alt || "Screenshot browser"}
            loading="lazy"
            className="w-full h-auto object-cover object-top transition-transform duration-200 group-hover:scale-[1.01]"
          />
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/50 via-black/20 to-transparent pointer-events-none flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] text-white/90 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1">
              <Maximize2 className="w-2.5 h-2.5" /> Klik untuk perbesar tampilan penuh
            </span>
          </div>
        </div>
      </div>

      {/* Modal Zoom Fullscreen */}
      {isZoomed && (
        <div
          onClick={() => setIsZoomed(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-zoom-out animate-rise"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-5xl max-h-[92vh] bg-base border border-line-strong rounded-2xl p-2 overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between pb-2 px-2 border-b border-line text-xs text-fg-3">
              <span className="font-mono truncate">{alt || "Screenshot Penuh"}</span>
              <button
                type="button"
                onClick={() => setIsZoomed(false)}
                className="p-1 rounded-lg hover:bg-hover text-fg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-auto max-h-[85vh] p-2 flex items-center justify-center bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Preview Penuh"
                className="max-h-[80vh] max-w-full rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** **tebal**, `kode`, dan judul markdown ringan. */
function Inline({ text }: { text: string }) {
  const lines = text.replace(/^\n+|\n+$/g, "").split("\n");
  return (
    <>
      {lines.map((line, i) => {
        // Deteksi screenshot atau markdown image apa pun
        const imgMatch = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (imgMatch) {
          return <BrowserScreenshotPreview key={i} url={imgMatch[2]} alt={imgMatch[1]} />;
        }

        const heading = line.match(/^#{1,4}\s+(.*)$/);
        const body = heading ? heading[1] : line;
        const tokens = body
          .split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|\/)[^\s)]*\)|https?:\/\/[^\s<>'"]+)/g)
          .map((t, k) => {
            // Markdown link: [Title](https://...)
            const link = t.match(/^\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]*)\)$/);
            if (link && !link[2].startsWith("//")) {
              const isLongText = link[1].length > 40 && !link[1].includes(" ");
              const displayLabel = isLongText ? link[1].slice(0, 36) + "..." : link[1];
              return (
                <a
                  key={k}
                  href={link[2]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline underline-offset-2 break-all inline"
                  title={link[1]}
                >
                  {displayLabel}
                </a>
              );
            }
            // Naked URL: https://...
            if (/^https?:\/\/[^\s<>'"]+$/i.test(t)) {
              let displayUrl = t;
              try {
                const u = new URL(t);
                displayUrl = u.hostname.replace(/^www\./, "") + (u.pathname.length > 20 ? u.pathname.slice(0, 18) + "..." : u.pathname);
              } catch {
                displayUrl = t.length > 40 ? t.slice(0, 36) + "..." : t;
              }
              return (
                <a
                  key={k}
                  href={t}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline underline-offset-2 break-all inline"
                  title={t}
                >
                  {displayUrl}
                </a>
              );
            }
            if (/^\*\*[^*]+\*\*$/.test(t))
              return (
                <strong key={k} className="font-semibold text-fg">
                  {t.slice(2, -2)}
                </strong>
              );
            if (/^`[^`]+`$/.test(t))
              return (
                <code
                  key={k}
                  className="px-1.5 py-0.5 rounded-md bg-hover font-mono text-[0.85em] text-fg-2 break-all"
                >
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

function DivisionActivationCard({ divisionsStr }: { divisionsStr: string }) {
  const [activated, setActivated] = useState(false);
  const [loading, setLoading] = useState(false);
  const divisions = divisionsStr.split(",").map((d) => d.trim()).filter(Boolean);

  const handleActivate = async () => {
    setLoading(true);
    try {
      const activeProj = (typeof window !== "undefined" && (window as any).__activeVoxProject) || "default-workspace";
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "activate_divisions",
          sessionId: activeProj,
          divisions,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActivated(true);
        window.dispatchEvent(new CustomEvent("vox_teams_updated"));
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const getLabel = (d: string) => {
    switch (d) {
      case "founder": return "🚀 Founder";
      case "developer": return "💻 Developer";
      case "marketing": return "📢 Marketing";
      case "creative": return "🎨 Kreatif";
      case "trading": return "📈 Trading";
      case "career": return "💼 Karier";
      case "research": return "🎓 Riset";
      default: return d;
    }
  };

  return (
    <div className="my-3 p-3.5 rounded-2xl border border-accent/40 bg-accent/5 max-w-md shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="p-1 rounded-md bg-accent text-white text-xs">🚀</span>
        <span className="text-xs font-bold text-fg">Rekomendasi Struktur Tim AI Proyek</span>
      </div>
      <p className="text-[11px] text-fg-3 mb-2.5">
        Divisi berikut siap diaktifkan ke sidebar proyek kamu:
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {divisions.map((d) => (
          <span key={d} className="px-2 py-0.5 rounded-full bg-hover border border-line text-[10px] font-medium text-fg">
            {getLabel(d)}
          </span>
        ))}
        {divisions.length >= 2 && (
          <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-bold">
            🏛️ Dewan Direksi
          </span>
        )}
      </div>
      {activated ? (
        <div className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500 font-semibold">
          <Check className="w-4 h-4" />
          <span>Divisi Berhasil Diaktifkan di Sidebar!</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleActivate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm transition-all"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
          <span>Aktifkan {divisions.length} Divisi Ini ke Sidebar</span>
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
        ) : p.kind === "division_card" ? (
          <DivisionActivationCard key={i} divisionsStr={p.divisions} />
        ) : (
          <div key={i} className="whitespace-pre-wrap">
            <Inline text={p.text} />
          </div>
        )
      )}
    </div>
  );
}
