"use client";

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FolderPlus, RotateCcw, Square } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

export interface TerminalPaneHandle {
  /** Ketik dan jalankan satu perintah di sesi yang sedang hidup. */
  run: (command: string) => void;
}

interface SessionInfo { id: string; cwd: string; pty: boolean; running: boolean }

const PROJECT = "__project__";

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Terminal interaktif: shell hidup di server (sesi), output mengalir lewat SSE, ketikan dikirim balik.
 * Di mode PTY shell yang menampilkan ketikan; di mode sederhana komponen ini yang menampilkannya per baris.
 */
export const TerminalPane = forwardRef<TerminalPaneHandle, { projectId?: string }>(function TerminalPane({ projectId }, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const sessionRef = useRef<SessionInfo | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const lineRef = useRef("");
  const pendingRef = useRef("");
  const flushRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [roots, setRoots] = useState<string[]>([]);
  const [where, setWhere] = useState<string>(PROJECT);
  const [status, setStatus] = useState("Menyiapkan terminal...");
  const [newRoot, setNewRoot] = useState("");
  const [adding, setAdding] = useState(false);
  const [generation, setGeneration] = useState(0);

  const post = useCallback((body: unknown) => {
    const s = sessionRef.current;
    if (!s) return;
    void fetch(`/api/terminal/session/${s.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
  }, []);

  // Ketikan dikumpulkan sebentar supaya tidak satu request per huruf
  const send = useCallback((data: string) => {
    pendingRef.current += data;
    if (flushRef.current) return;
    flushRef.current = setTimeout(() => {
      flushRef.current = null;
      const chunk = pendingRef.current;
      pendingRef.current = "";
      if (chunk) post({ data: chunk });
    }, 15);
  }, [post]);

  const interrupt = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    if (s.pty) send("\x03");
    else { lineRef.current = ""; termRef.current?.write("^C\r\n"); post({ action: "interrupt" }); }
  }, [post, send]);

  const onKeys = useCallback((data: string) => {
    const s = sessionRef.current;
    const term = termRef.current;
    if (!s || !term) return;
    if (s.pty) return send(data);
    for (const ch of data) {
      if (ch === "\r") { term.write("\r\n"); send(lineRef.current + "\n"); lineRef.current = ""; }
      else if (ch === "\x7f") { if (lineRef.current) { lineRef.current = lineRef.current.slice(0, -1); term.write("\b \b"); } }
      else if (ch === "\x03") interrupt();
      else if (ch >= " " || ch === "\t") { lineRef.current += ch; term.write(ch); }
    }
  }, [interrupt, send]);

  useImperativeHandle(ref, () => ({
    run(command: string) {
      const s = sessionRef.current;
      if (!s) return;
      if (!s.pty) termRef.current?.write(command + "\r\n");
      send(command + (s.pty ? "\r" : "\n"));
      termRef.current?.focus();
    },
  }), [send]);

  useEffect(() => {
    void fetch("/api/terminal/roots").then((r) => r.json()).then((d) => { if (Array.isArray(d.roots)) setRoots(d.roots); }).catch(() => {});
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
      if (disposed || !hostRef.current) return;
      const term = new Terminal({ fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", cursorBlink: true, scrollback: 5000, theme: { background: "#0b0d10" } });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(hostRef.current);
      try { fit.fit(); } catch {}
      termRef.current = term;
      const keys = term.onData(onKeys);
      const observer = new ResizeObserver(() => { try { fit.fit(); } catch {} });
      observer.observe(hostRef.current);
      cleanup = () => { keys.dispose(); observer.disconnect(); term.dispose(); termRef.current = null; };

      try {
        const res = await fetch("/api/terminal/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, cols: term.cols, rows: term.rows, ...(where !== PROJECT ? { cwd: where } : {}) }),
        });
        const data = await res.json();
        if (disposed) { if (data.session?.id) void fetch(`/api/terminal/session/${data.session.id}`, { method: "DELETE" }); return; }
        if (!data.success) { setStatus(data.error || "Gagal membuka terminal."); term.write(`\r\n${data.error || "Gagal membuka terminal."}\r\n`); return; }
        const session: SessionInfo = data.session;
        sessionRef.current = session;
        term.options.convertEol = !session.pty;
        setStatus(`${session.cwd}${session.pty ? "" : " · mode sederhana"}`);
        const source = new EventSource(`/api/terminal/session/${session.id}`);
        sourceRef.current = source;
        source.addEventListener("data", (e) => term.write(decodeBase64((e as MessageEvent).data)));
        source.addEventListener("exit", () => { term.write("\r\n[terminal ditutup]\r\n"); setStatus("Terminal ditutup. Tekan tombol ulang untuk membuka lagi."); source.close(); });
        term.focus();
      } catch {
        setStatus("Gagal menghubungi server.");
      }
    })();
    return () => {
      disposed = true;
      sourceRef.current?.close();
      sourceRef.current = null;
      const s = sessionRef.current;
      sessionRef.current = null;
      lineRef.current = "";
      if (s) void fetch(`/api/terminal/session/${s.id}`, { method: "DELETE", keepalive: true }).catch(() => {});
      cleanup();
    };
  }, [projectId, where, generation, onKeys]);

  const addRoot = async (e: React.FormEvent) => {
    e.preventDefault();
    const dir = newRoot.trim();
    if (!dir) return;
    const res = await fetch("/api/terminal/roots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roots: [...roots, dir] }) });
    const data = await res.json();
    if (!data.success) { setStatus(data.error || "Folder ditolak."); return; }
    setRoots(data.roots);
    setNewRoot("");
    setAdding(false);
    setWhere(data.roots[data.roots.length - 1] ?? PROJECT);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#0b0d10]">
      <div className="h-8 shrink-0 px-3 flex items-center gap-2 border-b border-line bg-raised text-[11px]">
        <select value={where} onChange={(e) => setWhere(e.target.value)} className="bg-transparent text-fg border border-line-strong rounded-md px-1.5 py-0.5 max-w-[45%]" title="Folder tempat terminal dibuka">
          <option value={PROJECT}>Proyek aktif</option>
          {roots.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {adding ? (
          <form onSubmit={addRoot} className="flex items-center gap-1 flex-1 min-w-0">
            <input autoFocus value={newRoot} onChange={(e) => setNewRoot(e.target.value)} placeholder="/Users/kamu/Documents/proyek" className="flex-1 min-w-0 bg-transparent border border-line-strong rounded-md px-1.5 py-0.5 text-fg outline-hidden" />
            <button type="submit" className="px-2 py-0.5 rounded-md bg-accent text-on-accent font-semibold">Tambah</button>
            <button type="button" onClick={() => setAdding(false)} className="px-1.5 py-0.5 text-fg-3 hover:text-fg">Batal</button>
          </form>
        ) : (
          <>
            <button onClick={() => setAdding(true)} title="Izinkan folder lain di komputer ini" className="p-1 text-fg-3 hover:text-fg rounded-md"><FolderPlus className="w-3.5 h-3.5" /></button>
            <span className="truncate text-fg-3 flex-1 min-w-0">{status}</span>
          </>
        )}
        <button onClick={interrupt} title="Hentikan perintah (Ctrl-C)" className="p-1 text-fg-3 hover:text-danger rounded-md shrink-0"><Square className="w-3.5 h-3.5" /></button>
        <button onClick={() => setGeneration((n) => n + 1)} title="Buka ulang terminal" className="p-1 text-fg-3 hover:text-fg rounded-md shrink-0"><RotateCcw className="w-3.5 h-3.5" /></button>
      </div>
      <div ref={hostRef} className="flex-1 min-h-0 px-2 py-1 overflow-hidden" />
    </div>
  );
});
