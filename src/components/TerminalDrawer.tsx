"use client";

import React, { useState, useRef, useEffect } from "react";
import { Terminal as TerminalIcon, X, Play, Trash2, GitBranch, Cloud, RefreshCw, Check, AlertCircle } from "lucide-react";

interface TerminalLog {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  running?: boolean;
  ready?: boolean;
  durationMs: number;
  timestamp: string;
}

interface TerminalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerVoiceFeedback?: (text: string) => void;
}

export function TerminalDrawer({ isOpen, onClose, onTriggerVoiceFeedback }: TerminalDrawerProps) {
  const [logs, setLogs] = useState<TerminalLog[]>([
    {
      id: "initial-log",
      command: "echo 'VOX·AI Studio Developer Console Ready.'",
      stdout: "VOX·AI Studio Developer Console Ready.\nConnected to project runtime.",
      stderr: "",
      exitCode: 0,
      durationMs: 4,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputCmd, setInputCmd] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isOpen]);

  const executeCommand = async (cmdToRun: string) => {
    if (!cmdToRun.trim() || isRunning) return;

    setIsRunning(true);
    const startTime = Date.now();

    try {
      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmdToRun.trim() }),
      });

      const data = await res.json();
      const newLog: TerminalLog = {
        id: `term-${Date.now()}`,
        command: cmdToRun.trim(),
        stdout: data.stdout || "",
        stderr: data.stderr || data.error || "",
        exitCode: data.exitCode === null ? null : data.exitCode ?? (data.success ? 0 : 1),
        running: !!data.running,
        ready: !!data.ready,
        durationMs: data.durationMs || Date.now() - startTime,
        timestamp: new Date().toLocaleTimeString(),
      };

      setLogs((prev) => [...prev, newLog]);
      setInputCmd("");

      if (onTriggerVoiceFeedback) {
        if (data.success) {
          onTriggerVoiceFeedback(data.running ? data.ready ? "Server sudah berjalan." : "Proses berjalan, menunggu server siap." : `Perintah ${cmdToRun.split(" ")[0]} selesai dijalankan dengan sukses.`);
        } else {
          onTriggerVoiceFeedback(`Perintah selesai dengan kode error.`);
        }
      }
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          id: `term-${Date.now()}`,
          command: cmdToRun.trim(),
          stdout: "",
          stderr: err.message || "Failed to execute command",
          exitCode: 1,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeCommand(inputCmd);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 h-80 sm:h-96 bg-base border-t-2 border-accent/80 flex flex-col shadow-2xl font-mono text-xs text-fg">
      {/* Top Header Bar */}
      <div className="h-9 bg-raised border-b border-line px-4 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-accent" />
          <span className="font-semibold text-fg text-[11px] tracking-wider">
            PROJECT TERMINAL & RUNTIME
          </span>
          <span className="w-1.5 h-1.5 rounded-sm bg-moss animate-pulse" />
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => executeCommand("node -v && npm -v")}
            disabled={isRunning}
            className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-2 hover:text-fg border border-line-strong rounded-lg text-[10px] flex items-center gap-1 transition-colors text-accent font-medium shrink-0"
            title="Cek versi Node & NPM"
          >
            node & npm
          </button>

          <button
            onClick={() => executeCommand("npm init -y")}
            disabled={isRunning}
            className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-2 hover:text-fg border border-line-strong rounded-lg text-[10px] flex items-center gap-1 transition-colors text-glow shrink-0"
            title="Inisialisasi package.json"
          >
            npm init
          </button>

          <button
            onClick={() => executeCommand("npm install")}
            disabled={isRunning}
            className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-2 hover:text-fg border border-line-strong rounded-lg text-[10px] flex items-center gap-1 transition-colors text-moss shrink-0"
            title="Install dependensi npm"
          >
            npm install
          </button>

          <button
            onClick={() => executeCommand("git status")}
            disabled={isRunning}
            className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-2 hover:text-fg border border-line-strong rounded-lg text-[10px] flex items-center gap-1 transition-colors shrink-0"
          >
            <GitBranch className="w-3 h-3 text-accent-hi" />
            git status
          </button>

          <button
            onClick={() => executeCommand("git add -A && git status")}
            disabled={isRunning}
            className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-2 hover:text-fg border border-line-strong rounded-lg text-[10px] flex items-center gap-1 transition-colors shrink-0"
          >
            <GitBranch className="w-3 h-3 text-moss" />
            git add all
          </button>

          <button
            onClick={() => executeCommand("npm run build")}
            disabled={isRunning}
            className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-2 hover:text-fg border border-line-strong rounded-lg text-[10px] flex items-center gap-1 transition-colors shrink-0"
          >
            <RefreshCw className="w-3 h-3 text-lagoon" />
            npm build
          </button>

          <button
            onClick={() => executeCommand("vercel --version")}
            disabled={isRunning}
            className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-2 hover:text-fg border border-line-strong rounded-lg text-[10px] flex items-center gap-1 transition-colors shrink-0"
          >
            <Cloud className="w-3 h-3 text-fg" />
            vercel info
          </button>

          <button
            onClick={() => setLogs([])}
            title="Bersihkan Output"
            className="p-1 text-fg-3 hover:text-fg rounded-lg transition-colors ml-auto shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="p-1 text-fg-3 hover:text-fg rounded-lg transition-colors ml-1 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Output logs */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-canvas font-mono select-text scrollbar-thin">
        {logs.map((log) => (
          <div key={log.id} className="space-y-1">
            <div className="flex items-center gap-2 text-fg-3 text-[11px]">
              <span className="text-accent font-bold">vox@workspace:~$</span>
              <span className="text-fg font-semibold">{log.command}</span>
              <span className="text-[10px] text-fg-4 ml-auto">
                {log.durationMs}ms · {log.timestamp}
              </span>
            </div>

            {log.stdout && (
              <pre className="text-fg-2 whitespace-pre-wrap pl-3 border-l-2 border-line leading-relaxed text-[11px]">
                {log.stdout}
              </pre>
            )}

            {log.stderr && (
              <pre className="text-danger whitespace-pre-wrap pl-3 border-l-2 border-danger/40 leading-relaxed text-[11px]">
                {log.stderr}
              </pre>
            )}

            <div className="flex items-center gap-1.5 text-[10px]">
              {log.running ? <span className="text-accent">{log.ready ? "Server berjalan · HTTP diperiksa" : "Proses berjalan · menunggu server siap"}</span> : log.exitCode === null ? <span className="text-fg-3">Proses berhenti / tidak aktif</span> : log.exitCode === 0 ? (
                <span className="text-moss flex items-center gap-1">
                  <Check className="w-3 h-3" /> Exited with code 0
                </span>
              ) : (
                <span className="text-danger flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Exited with code {log.exitCode}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={terminalEndRef} />
      </div>

      {/* Bottom Command Input Bar */}
      <form onSubmit={handleSubmit} className="h-10 bg-raised border-t border-line px-3 flex items-center gap-2">
        <span className="text-accent font-bold select-none text-xs">$&gt;</span>
        <input
          type="text"
          value={inputCmd}
          onChange={(e) => setInputCmd(e.target.value)}
          disabled={isRunning}
          placeholder="Ketik perintah shell (contoh: npm i lucide-react, npm run dev, git status, ls -la)..."
          className="flex-1 bg-transparent text-fg outline-hidden placeholder-fg-4 text-xs font-mono"
        />
        <button
          type="submit"
          disabled={!inputCmd.trim() || isRunning}
          className="px-3 py-1 bg-accent hover:bg-accent-hi text-on-accent rounded-lg font-mono text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
        >
          <Play className="w-3 h-3" />
          <span>Jalankan</span>
        </button>
      </form>
    </div>
  );
}
