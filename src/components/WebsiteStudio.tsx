"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ArtifactItem } from "@/lib/types";
import { injectVoxRuntime } from "@/lib/voxRuntime";
import { highlight } from "./WebsiteCard";
import {
  X,
  Eye,
  Code2,
  Monitor,
  Tablet,
  Smartphone,
  RotateCcw,
  Download,
  Copy,
  Check,
  FileCode2,
  FileType2,
  FileJson,
  Folder,
  Hash,
  PanelLeft,
} from "lucide-react";

type Tab = "preview" | "code";
type Device = "desktop" | "tablet" | "mobile";
type FileId = "index.html" | "style.css" | "script.js";

const DEVICE_W: Record<Device, string> = { desktop: "100%", tablet: "820px", mobile: "390px" };

/** Pecah index.html jadi "file" virtual + kerangka section untuk navigasi. */
function analyze(html: string) {
  const styles = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).map((m) => m[1].trim());
  const scripts = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))
    .map((m) => m[1].trim())
    .filter(Boolean);
  const files: { id: FileId; content: string; Icon: typeof FileCode2 }[] = [{ id: "index.html", content: html, Icon: FileCode2 }];
  if (styles.length) files.push({ id: "style.css", content: styles.join("\n\n"), Icon: FileType2 });
  if (scripts.length) files.push({ id: "script.js", content: scripts.join("\n\n"), Icon: FileJson });

  const outline: { label: string; tag: string; line: number }[] = [];
  html.split("\n").forEach((l, i) => {
    const block = l.match(/<(header|nav|main|section|footer|article|aside|form)\b([^>]*)>/i);
    if (block) {
      const attrs = block[2];
      const id = attrs.match(/\bid=["']([^"']+)/)?.[1];
      const cls = attrs.match(/\bclass=["']([^"'\s]+)/)?.[1];
      outline.push({ tag: block[1].toLowerCase(), label: id || cls || block[1].toLowerCase(), line: i + 1 });
      return;
    }
    const h = l.match(/<h([12])[^>]*>(.*?)<\/h\1>/i);
    if (h) {
      const text = h[2].replace(/<[^>]+>/g, "").trim();
      if (text) outline.push({ tag: `h${h[1]}`, label: text.slice(0, 48), line: i + 1 });
    }
  });
  return { files, outline: outline.slice(0, 60) };
}

function plain(line: string) {
  return line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function WebsiteStudio() {
  const [artifact, setArtifact] = useState<ArtifactItem | null>(null);
  const [tab, setTab] = useState<Tab>("preview");
  const [device, setDevice] = useState<Device>("desktop");
  const [file, setFile] = useState<FileId>("index.html");
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showTree, setShowTree] = useState(true);
  const [closing, setClosing] = useState(false);
  const codeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent).detail as { artifact: ArtifactItem; tab?: Tab };
      if (!d?.artifact?.website) return;
      setArtifact(d.artifact);
      setTab(d.tab || "preview");
      setFile("index.html");
      setFocusLine(null);
      setClosing(false);
    };
    window.addEventListener("vox_open_studio", onOpen);
    return () => window.removeEventListener("vox_open_studio", onOpen);
  }, []);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setArtifact(null);
      setClosing(false);
    }, 420);
  }, []);

  useEffect(() => {
    if (!artifact) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [artifact, close]);

  const site = artifact?.website;
  const { files, outline } = useMemo(() => (site ? analyze(site.html) : { files: [], outline: [] }), [site]);
  const current = files.find((f) => f.id === file) || files[0];
  const lines = useMemo(() => (current ? current.content.split("\n") : []), [current]);
  const previewHtml = useMemo(
    () => (site ? injectVoxRuntime(site.html, site.projectId, typeof window !== "undefined" ? window.location.origin : undefined) : ""),
    [site]
  );

  // Gulir ke baris yang dipilih dari kerangka
  useEffect(() => {
    if (tab !== "code" || !focusLine || !codeRef.current) return;
    const row = codeRef.current.querySelector(`[data-line="${focusLine}"]`) as HTMLElement | null;
    row?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusLine, tab, file]);

  if (!artifact || !site) return null;

  const kb = (new Blob([site.html]).size / 1024).toFixed(1);

  const copy = () => {
    navigator.clipboard.writeText(current.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    const blob = new Blob([current.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = current.id;
    a.click();
    URL.revokeObjectURL(url);
  };

  const projectName = (artifact.title || "website").replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();

  return (
    <>
    <div
      aria-hidden="true"
      onClick={close}
      className="fixed inset-0 z-[69] bg-scrim/45 backdrop-blur-[2px]"
      style={{ animation: `${closing ? "veil-out" : "veil-in"} ${closing ? 0.35 : 0.5}s ease both` }}
    />
    <div
      role="dialog"
      aria-modal="true"
      aria-label={artifact.title}
      className="fixed inset-y-0 right-0 z-[70] w-full md:w-[min(1280px,92vw)] bg-canvas text-fg flex flex-col md:border-l md:border-line shadow-[-30px_0_80px_-30px_rgba(0,0,0,0.55)]"
      style={{
        animation: `${closing ? "studio-out" : "studio-in"} ${closing ? 0.38 : 0.6}s cubic-bezier(0.16, 1, 0.3, 1) both`,
      }}
    >
      <style>{`
        @keyframes studio-in { from { transform: translateX(100%); } to { transform: none; } }
        @keyframes studio-out { from { transform: none; } to { transform: translateX(100%); } }
        @keyframes veil-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes veil-out { from { opacity: 1; } to { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { [role="dialog"] { animation-duration: .01ms !important; } }
      `}</style>

      {/* Bar atas */}
      <div className="h-14 shrink-0 border-b border-line px-2 sm:px-4 flex items-center gap-2 sm:gap-4">
        <button onClick={() => setShowTree(!showTree)} aria-pressed={showTree} className="icon-btn hidden md:grid" aria-label="Struktur file" title="Struktur file">
          <PanelLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium tracking-[-0.01em] truncate">{artifact.title}</div>
          <div className="font-mono text-[10px] text-fg-4 truncate">
            {files.length} file · {site.html.split("\n").length} baris · {kb} KB{site.score ? ` · review ${site.score}/10` : ""}
          </div>
        </div>

        {/* Toggle Preview / Kode dengan indikator geser */}
        <div role="tablist" className="relative grid grid-cols-2 p-1 rounded-full bg-base shadow-[inset_0_0_0_1px_var(--line)] text-[12px] font-medium">
          <span
            aria-hidden="true"
            className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-ink transition-transform duration-700"
            style={{ transform: tab === "code" ? "translateX(100%)" : "none", transitionTimingFunction: "var(--ease-out-expo)" }}
          />
          {(
            [
              ["preview", "Preview", Eye],
              ["code", "Kode", Code2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`relative z-10 flex items-center justify-center gap-1.5 px-3 sm:px-4 h-8 rounded-full cursor-pointer transition-colors duration-500 ${
                tab === id ? "text-on-ink" : "text-fg-3 hover:text-fg"
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5">
          {tab === "preview" ? (
            <>
              <div className="hidden sm:flex items-center">
                {(
                  [
                    ["desktop", Monitor, "Desktop"],
                    ["tablet", Tablet, "Tablet"],
                    ["mobile", Smartphone, "HP"],
                  ] as const
                ).map(([d, Icon, label]) => (
                  <button key={d} onClick={() => setDevice(d)} aria-pressed={device === d} className="icon-btn" title={label} aria-label={label}>
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                ))}
              </div>
              <button onClick={() => setReloadKey((k) => k + 1)} className="icon-btn" title="Muat ulang" aria-label="Muat ulang">
                <RotateCcw className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </>
          ) : (
            <button onClick={copy} className="icon-btn" title="Salin file" aria-label="Salin file">
              {copied ? <Check className="w-4 h-4 text-moss" /> : <Copy className="w-4 h-4" strokeWidth={1.5} />}
            </button>
          )}
          <button onClick={download} className="icon-btn hidden sm:grid" title={`Unduh ${current.id}`} aria-label="Unduh">
            <Download className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <button onClick={close} className="icon-btn" title="Tutup (Esc)" aria-label="Tutup">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* File (mobile: chip horizontal) */}
      <div className="md:hidden flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-line">
        {files.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setFile(f.id);
              setTab("code");
            }}
            className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full font-mono text-[11px] transition-colors ${
              tab === "code" && file === f.id ? "bg-ink text-on-ink" : "text-fg-2 shadow-[inset_0_0_0_1px_var(--line)]"
            }`}
          >
            <f.Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
            {f.id}
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Pohon file + kerangka halaman */}
        <aside
          className="hidden md:flex flex-col shrink-0 border-r border-line overflow-hidden transition-[width] duration-700"
          style={{ width: showTree ? 260 : 0, transitionTimingFunction: "var(--ease-out-expo)" }}
        >
          <div className="w-[260px] flex-1 overflow-y-auto p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-4 px-2 pb-2">File</div>
            <div className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-fg-2">
              <Folder className="w-4 h-4 text-fg-3" strokeWidth={1.5} />
              <span className="truncate">{projectName}</span>
            </div>
            <ul className="ml-3 border-l border-line">
              {files.map((f, i) => {
                const active = tab === "code" && file === f.id;
                return (
                  <li key={f.id} className="card-in" style={{ ["--i" as string]: i + 3 }}>
                    <button
                      onClick={() => {
                        setFile(f.id);
                        setTab("code");
                        setFocusLine(null);
                      }}
                      className={`group w-full flex items-center gap-2 pl-3 pr-2 py-1.5 -ml-px border-l text-left font-mono text-[12px] transition-colors duration-300 cursor-pointer ${
                        active ? "border-accent text-fg" : "border-transparent text-fg-3 hover:text-fg"
                      }`}
                    >
                      <f.Icon className={`w-3.5 h-3.5 ${active ? "text-accent" : ""}`} strokeWidth={1.5} />
                      <span className="flex-1 truncate">{f.id}</span>
                      <span className="text-[10px] text-fg-4">{f.content.split("\n").length}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {outline.length > 0 && (
              <>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-4 px-2 pt-6 pb-2">Struktur halaman</div>
                <ul className="space-y-px">
                  {outline.map((o, i) => (
                    <li key={i}>
                      <button
                        onClick={() => {
                          setFile("index.html");
                          setTab("code");
                          setFocusLine(o.line);
                        }}
                        className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[12px] transition-colors cursor-pointer hover:bg-base ${
                          /^h[1-6]$/.test(o.tag) ? "pl-6 text-fg-3" : "text-fg-2"
                        } ${focusLine === o.line && tab === "code" ? "bg-base text-fg" : ""}`}
                      >
                        <Hash className="w-3 h-3 shrink-0 text-fg-4 group-hover:text-accent transition-colors" strokeWidth={1.5} />
                        <span className="flex-1 truncate">{o.label}</span>
                        <span className="font-mono text-[10px] text-fg-4">{o.tag}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </aside>

        {/* Area utama */}
        <main className="flex-1 min-w-0 relative bg-base">
          {tab === "preview" ? (
            <div key="p" className="chat-in absolute inset-0 flex justify-center p-0 sm:p-4">
              <div
                className="h-full bg-white overflow-hidden sm:rounded-2xl sm:shadow-[0_0_0_1px_var(--line),0_30px_80px_-40px_rgba(0,0,0,0.35)] transition-[width] duration-700 max-w-full"
                style={{ width: DEVICE_W[device], transitionTimingFunction: "var(--ease-out-expo)" }}
              >
                <iframe
                  key={reloadKey}
                  srcDoc={previewHtml}
                  title={artifact.title}
                  sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation"
                  allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
                  className="w-full h-full border-0 bg-white"
                />
              </div>
            </div>
          ) : (
            <div key={`c-${file}`} ref={codeRef} className="chat-in absolute inset-0 overflow-auto bg-canvas">
              <div className="sticky top-0 z-10 flex items-center gap-2 px-4 h-9 bg-canvas/90 backdrop-blur border-b border-line font-mono text-[11px] text-fg-3">
                <current.Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                {projectName}/<span className="text-fg">{current.id}</span>
                {current.id !== "index.html" && <span className="text-fg-4">· diekstrak dari index.html</span>}
              </div>
              <table className="border-collapse text-[12.5px] leading-[1.7] font-mono">
                <tbody>
                  {lines.map((l, i) => {
                    const n = i + 1;
                    const hit = focusLine === n && current.id === "index.html";
                    return (
                      <tr key={i} data-line={n} className={hit ? "bg-accent-wash" : ""}>
                        <td className={`sticky left-0 text-right pl-4 pr-4 select-none align-top tabular-nums ${hit ? "bg-accent-wash text-accent" : "bg-canvas text-fg-4"}`}>
                          {n}
                        </td>
                        <td
                          className="pr-6 whitespace-pre text-fg-2"
                          dangerouslySetInnerHTML={{ __html: (current.id === "index.html" ? highlight(l) : plain(l)) || " " }}
                        />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
    </>
  );
}
