"use client";

import React, { useState, useRef, useEffect } from "react";
import { Terminal as TerminalIcon, X, Play, Trash2, GitBranch, Cloud, RefreshCw, Check, AlertCircle } from "lucide-react";

interface TerminalLog {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
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
        stderr: data.stderr || "",
        exitCode: data.exitCode ?? (data.success ? 0 : 1),
        durationMs: data.durationMs || Date.now() - startTime,
        timestamp: new Date().toLocaleTimeString(),
      };

      setLogs((prev) => [...prev, newLog]);
      setInputCmd("");

      if (onTriggerVoiceFeedback) {
        if (data.success) {
          onTriggerVoiceFeedback(`Perintah ${cmdToRun.split(" ")[0]} selesai dijalankan dengan sukses.`);
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
    <div className="fixed inset-x-0 bottom-0 z-40 h-80 sm:h-96 bg-[#0e1014] border-t-2 border-[#ea580c]/80 flex flex-col shadow-2xl font-mono text-xs text-[#e4e7ec]">
      {/* Top Header Bar */}
      <div className="h-9 bg-[#14171d] border-b border-[#242934] px-4 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-[#ea580c]" />
          <span className="font-semibold text-[#f3f4f6] text-[11px] tracking-wider">
            PROJECT TERMINAL & RUNTIME
          </span>
          <span className="w-1.5 h-1.5 rounded-[1px] bg-[#10b981] animate-pulse" />
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => executeCommand("git status")}
            disabled={isRunning}
            className="px-2 py-0.5 bg-[#1b1f28] hover:bg-[#252a36] text-[#9ca3af] hover:text-[#f3f4f6] border border-[#2e3444] rounded-[3px] text-[10px] flex items-center gap-1 transition-colors"
          >
            <GitBranch className="w-3 h-3 text-[#f97316]" />
            git status
          </button>

          <button
            onClick={() => executeCommand("git add -A && git status")}
            disabled={isRunning}
            className="px-2 py-0.5 bg-[#1b1f28] hover:bg-[#252a36] text-[#9ca3af] hover:text-[#f3f4f6] border border-[#2e3444] rounded-[3px] text-[10px] flex items-center gap-1 transition-colors"
          >
            <GitBranch className="w-3 h-3 text-[#10b981]" />
            git add all
          </button>

          <button
            onClick={() => executeCommand("npm run build")}
            disabled={isRunning}
            className="px-2 py-0.5 bg-[#1b1f28] hover:bg-[#252a36] text-[#9ca3af] hover:text-[#f3f4f6] border border-[#2e3444] rounded-[3px] text-[10px] flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3 text-[#38bdf8]" />
            npm build
          </button>

          <button
            onClick={() => executeCommand("vercel --version")}
            disabled={isRunning}
            className="px-2 py-0.5 bg-[#1b1f28] hover:bg-[#252a36] text-[#9ca3af] hover:text-[#f3f4f6] border border-[#2e3444] rounded-[3px] text-[10px] flex items-center gap-1 transition-colors"
          >
            <Cloud className="w-3 h-3 text-[#f3f4f6]" />
            vercel info
          </button>

          <button
            onClick={() => setLogs([])}
            title="Bersihkan Output"
            className="p-1 text-[#646e82] hover:text-white rounded-[3px] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="p-1 text-[#8c94a5] hover:text-white rounded-[3px] transition-colors ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Output logs */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#0a0c0f] font-mono select-text scrollbar-thin">
        {logs.map((log) => (
          <div key={log.id} className="space-y-1">
            <div className="flex items-center gap-2 text-[#7d869a] text-[11px]">
              <span className="text-[#ea580c] font-bold">vox@workspace:~$</span>
              <span className="text-[#f3f4f6] font-semibold">{log.command}</span>
              <span className="text-[10px] text-[#555d6e] ml-auto">
                {log.durationMs}ms · {log.timestamp}
              </span>
            </div>

            {log.stdout && (
              <pre className="text-[#a6b0c2] whitespace-pre-wrap pl-3 border-l-2 border-[#222734] leading-relaxed text-[11px]">
                {log.stdout}
              </pre>
            )}

            {log.stderr && (
              <pre className="text-[#ef4444] whitespace-pre-wrap pl-3 border-l-2 border-[#ef4444]/40 leading-relaxed text-[11px]">
                {log.stderr}
              </pre>
            )}

            <div className="flex items-center gap-1.5 text-[10px]">
              {log.exitCode === 0 ? (
                <span className="text-[#10b981] flex items-center gap-1">
                  <Check className="w-3 h-3" /> Exited with code 0
                </span>
              ) : (
                <span className="text-[#ef4444] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Exited with code {log.exitCode}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={terminalEndRef} />
      </div>

      {/* Bottom Command Input Bar */}
      <form onSubmit={handleSubmit} className="h-10 bg-[#12141a] border-t border-[#232835] px-3 flex items-center gap-2">
        <span className="text-[#ea580c] font-bold select-none text-xs">$&gt;</span>
        <input
          type="text"
          value={inputCmd}
          onChange={(e) => setInputCmd(e.target.value)}
          disabled={isRunning}
          placeholder="Ketik perintah shell (contoh: git status, npm run build, ls -la, vercel deploy)..."
          className="flex-1 bg-transparent text-[#f3f4f6] outline-hidden placeholder-[#525b6c] text-xs font-mono"
        />
        <button
          type="submit"
          disabled={!inputCmd.trim() || isRunning}
          className="px-3 py-1 bg-[#ea580c] hover:bg-[#f97316] text-white rounded-[3px] font-mono text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
        >
          <Play className="w-3 h-3" />
          <span>Jalankan</span>
        </button>
      </form>
    </div>
  );
}
