"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, Bot, MousePointer, Play, Check, X, ShieldAlert , MousePointer2, Folder } from "lucide-react";

export interface CoworkerAction {
  type: "move" | "click" | "type" | "scroll" | "wait";
  targetSelector?: string;
  x?: number;
  y?: number;
  text?: string;
  label?: string;
  durationMs?: number;
}

interface CoworkerCursorOperatorProps {
  onSpeak?: (text: string) => void;
  onSwitchTab?: (tab: "preview" | "explorer" | "terminal" | "deploy") => void;
  onOpenRightPanel?: () => void;
}

export interface CoworkerRef {
  executeTask: (taskName: string, actions: CoworkerAction[]) => Promise<void>;
  runAutonomousTour: () => Promise<void>;
  clickSelector: (selector: string, label: string) => Promise<boolean>;
  isOperating: boolean;
}

export const CoworkerCursorContext = React.createContext<{
  isOperating: boolean;
  currentTask: string;
  runTour: () => void;
  clickElement: (selector: string, label: string) => Promise<boolean>;
}>({
  isOperating: false,
  currentTask: "",
  runTour: () => {},
  clickElement: async () => false,
});

export function CoworkerCursorOperator({
  onSpeak,
  onSwitchTab,
  onOpenRightPanel,
}: CoworkerCursorOperatorProps) {
  const [isOperating, setIsOperating] = useState(false);
  const [currentTask, setCurrentTask] = useState("");
  const [cursorPos, setCursorPos] = useState({ x: 300, y: 300 });
  const [cursorState, setCursorState] = useState<"idle" | "moving" | "clicking" | "typing">("idle");
  const [cursorLabel, setCursorLabel] = useState("VOX Coworker");
  const [ripples, setRipples] = useState<{ id: string; x: number; y: number }[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const stopRequestedRef = useRef(false);

  // Synthesize tactile click sound via Web Audio API
  const playTactileClick = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }, []);

  // Smoothly glide virtual cursor to target (x, y)
  const animateMove = useCallback(
    (targetX: number, targetY: number, durationMs: number = 600): Promise<void> => {
      return new Promise((resolve) => {
        setCursorState("moving");
        const startX = cursorPos.x;
        const startY = cursorPos.y;
        const startTime = performance.now();

        function easeInOutCubic(t: number): number {
          return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }

        function step(now: number) {
          if (stopRequestedRef.current) {
            resolve();
            return;
          }

          const elapsed = now - startTime;
          const progress = Math.min(elapsed / durationMs, 1);
          const eased = easeInOutCubic(progress);

          const curX = startX + (targetX - startX) * eased;
          const curY = startY + (targetY - startY) * eased;

          setCursorPos({ x: curX, y: curY });

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            setCursorState("idle");
            resolve();
          }
        }

        requestAnimationFrame(step);
      });
    },
    [cursorPos]
  );

  // Trigger click effect and dispatch real click
  const triggerClick = useCallback(
    (x: number, y: number, targetElement?: HTMLElement): Promise<void> => {
      return new Promise((resolve) => {
        setCursorState("clicking");
        playTactileClick();

        const rippleId = `rip-${Date.now()}`;
        setRipples((prev) => [...prev, { id: rippleId, x, y }]);
        setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== rippleId));
        }, 600);

        if (targetElement) {
          targetElement.classList.add("ring-2", "ring-accent", "ring-offset-1");
          setTimeout(() => {
            targetElement.classList.remove("ring-2", "ring-accent", "ring-offset-1");
          }, 400);

          try {
            targetElement.click();
          } catch (e) {
            console.warn("Click dispatch error:", e);
          }
        }

        setTimeout(() => {
          setCursorState("idle");
          resolve();
        }, 250);
      });
    },
    [playTactileClick]
  );

  // Click element by selector
  const clickElementBySelector = useCallback(
    async (selector: string, label: string): Promise<boolean> => {
      const el = document.querySelector(selector) as HTMLElement;
      if (!el) {
        setLogs((prev) => [...prev, `[FAIL] Element ${selector} not found`]);
        return false;
      }

      setCursorLabel(label || `Clicking ${selector}`);
      const rect = el.getBoundingClientRect();
      const targetX = rect.left + rect.width / 2;
      const targetY = rect.top + rect.height / 2;

      await animateMove(targetX, targetY, 650);
      await triggerClick(targetX, targetY, el);

      setLogs((prev) => [...prev, `[OK] Clicked: ${label || selector}`]);
      return true;
    },
    [animateMove, triggerClick]
  );

  // Autonomous Coworker Tour Demonstration
  const runAutonomousTour = useCallback(async () => {
    if (isOperating) return;

    setIsOperating(true);
    stopRequestedRef.current = false;
    setCurrentTask("Autonomous Studio Navigation");
    setLogs((prev) => [...prev, "[START] Coworker Auto-Operator Tour initiated"]);

    if (onOpenRightPanel) onOpenRightPanel();
    if (onSpeak) onSpeak("Mode Coworker aktif cuy! Saya akan mendemonstrasikan kendali cursor otomatis.");

    await new Promise((r) => setTimeout(r, 800));

    // 1. Move to Website Preview tab
    setCursorLabel("Navigasi ke Tab Preview");
    if (onSwitchTab) onSwitchTab("preview");
    const previewBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("PREVIEW")
    );
    if (previewBtn) {
      const rect = previewBtn.getBoundingClientRect();
      await animateMove(rect.left + rect.width / 2, rect.top + rect.height / 2, 700);
      await triggerClick(rect.left + rect.width / 2, rect.top + rect.height / 2, previewBtn);
    }

    await new Promise((r) => setTimeout(r, 1200));

    // 2. Move to Folder Project Explorer tab
    setCursorLabel("Buka Folder Explorer");
    if (onSpeak) onSpeak("Sekarang saya arahkan cursor ke tab Folder Project.");
    const explorerBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("EXPLORER")
    );
    if (explorerBtn) {
      const rect = explorerBtn.getBoundingClientRect();
      await animateMove(rect.left + rect.width / 2, rect.top + rect.height / 2, 700);
      await triggerClick(rect.left + rect.width / 2, rect.top + rect.height / 2, explorerBtn);
      if (onSwitchTab) onSwitchTab("explorer");
    }

    await new Promise((r) => setTimeout(r, 1200));

    // 3. Move to Terminal tab
    setCursorLabel("Buka Developer Terminal");
    if (onSpeak) onSpeak("Lalu saya klik tab Terminal untuk melihat status runtime.");
    const terminalBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("TERMINAL")
    );
    if (terminalBtn) {
      const rect = terminalBtn.getBoundingClientRect();
      await animateMove(rect.left + rect.width / 2, rect.top + rect.height / 2, 700);
      await triggerClick(rect.left + rect.width / 2, rect.top + rect.height / 2, terminalBtn);
      if (onSwitchTab) onSwitchTab("terminal");
    }

    await new Promise((r) => setTimeout(r, 1200));

    // 4. Move to Auto Deploy tab
    setCursorLabel("Cek Auto Deploy Hub");
    const deployBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("AUTO DEPLOY")
    );
    if (deployBtn) {
      const rect = deployBtn.getBoundingClientRect();
      await animateMove(rect.left + rect.width / 2, rect.top + rect.height / 2, 700);
      await triggerClick(rect.left + rect.width / 2, rect.top + rect.height / 2, deployBtn);
      if (onSwitchTab) onSwitchTab("deploy");
    }

    await new Promise((r) => setTimeout(r, 1000));

    // 5. Move back to mic button in chat area
    setCursorLabel("Kembali ke Mikrofon Suara");
    const micBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.getAttribute("title")?.includes("Mikrofon") || b.textContent?.includes("TEKAN & BICARA")
    );
    if (micBtn) {
      const rect = micBtn.getBoundingClientRect();
      await animateMove(rect.left + rect.width / 2, rect.top + rect.height / 2, 800);
    }

    if (onSpeak) {
      onSpeak("Tour otomatis selesai cuy! Saya siap dikontrol via suara kapan pun kamu mau.");
    }

    setCursorLabel("VOX Coworker (Standby)");
    setIsOperating(false);
    setCurrentTask("");
    setLogs((prev) => [...prev, "[DONE] Coworker tour completed"]);
  }, [isOperating, animateMove, triggerClick, onOpenRightPanel, onSwitchTab, onSpeak]);

  // Listen to global voice trigger for coworker tour
  useEffect(() => {
    const handleVoiceTrigger = () => {
      runAutonomousTour();
    };
    window.addEventListener("vox_trigger_coworker", handleVoiceTrigger);
    return () => window.removeEventListener("vox_trigger_coworker", handleVoiceTrigger);
  }, [runAutonomousTour]);

  const handleStop = () => {
    stopRequestedRef.current = true;
    setIsOperating(false);
    setCurrentTask("");
    setCursorState("idle");
    setCursorLabel("VOX Coworker (Stopped)");
  };

  return (
    <>
      {/* Ghost Virtual Cursor Overlay (Rendered above everything when operating or active) */}
      {(isOperating || cursorState !== "idle") && (
        <div className="fixed inset-0 pointer-events-none z-100 overflow-hidden">
          {/* Animated Cursor Pointer */}
          <div
            style={{
              transform: `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0)`,
              transition: cursorState === "moving" ? "none" : "transform 0.1s ease-out",
            }}
            className="absolute top-0 left-0 -ml-1 -mt-1 flex items-start gap-2 select-none"
          >
            {/* Custom SVG Sleek Cursor */}
            <div className="relative">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`drop-shadow-lg transition-transform duration-100 ${
                  cursorState === "clicking" ? "scale-90 rotate-[-8deg]" : "scale-100"
                }`}
              >
                <path
                  d="M4.5 3L11.5 21L14.5 13.5L21.5 10.5L4.5 3Z"
                  fill="#23786e"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Cursor glow aura */}
              <div className="absolute inset-0 bg-accent/40 blur-xs rounded-full pointer-events-none animate-ping" />
            </div>

            {/* Operator Label Tag */}
            <div className="bg-raised/95 text-fg text-[11px] font-mono px-2 py-1 rounded-lg border border-accent shadow-2xl flex items-center gap-1.5 whitespace-nowrap">
              <Bot className="w-3.5 h-3.5 text-accent animate-pulse" />
              <span className="font-semibold text-accent-hi">{cursorLabel}</span>
              {cursorState === "clicking" && (
                <span className="text-[10px] text-moss font-bold">CLICK!</span>
              )}
            </div>
          </div>

          {/* Click Ripple Waves */}
          {ripples.map((rip) => (
            <div
              key={rip.id}
              style={{
                left: `${rip.x}px`,
                top: `${rip.y}px`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-accent bg-accent/20 pointer-events-none animate-ping"
            />
          ))}
        </div>
      )}

      {/* Floating Coworker Mini Trigger / Controller in Top Right */}
      <div className="fixed bottom-52 sm:bottom-20 right-3 sm:right-4 z-40 font-mono text-xs select-none">
        {isOperating ? (
          <div className="flex items-center gap-2 p-2 bg-accent-wash border border-accent rounded-lg shadow-2xl animate-pulse">
            <Bot className="w-4 h-4 text-accent animate-spin" />
            <div className="text-[11px] text-fg">
              <div className="font-semibold text-accent-hi">COWORKER ACTIVE</div>
              <div className="text-[10px] text-fg-2 truncate max-w-[140px]">{currentTask}</div>
            </div>
            <button
              onClick={handleStop}
              className="p-1.5 bg-accent hover:bg-accent-hi text-on-accent rounded-md text-[10px]"
              title="Hentikan Coworker"
            >
              STOP
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className="lift flex items-center gap-1.5 px-3.5 py-2 bg-raised/90 backdrop-blur hover:bg-raised text-fg border border-line hover:border-accent/60 rounded-full shadow-[0_12px_28px_-16px_rgba(0,0,0,0.6)] font-sans cursor-pointer"
              title="Autonomous Coworker & Cursor Control"
            >
              <Bot className="w-4 h-4 text-accent" />
              <span className="font-medium text-xs hidden sm:inline">Coworker</span>
            </button>

            {/* Quick Popout Menu */}
            {isPanelOpen && (
              <div className="absolute bottom-11 right-0 w-64 bg-raised border border-line-strong rounded-lg shadow-2xl p-3 space-y-2.5 animate-rise">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <div className="flex items-center gap-1.5 text-fg font-semibold text-xs">
                    <Bot className="w-3.5 h-3.5 text-accent" />
                    <span>COWORKER AGENT</span>
                  </div>
                  <button onClick={() => setIsPanelOpen(false)} className="text-fg-3 hover:text-fg">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-[10px] text-fg-2 leading-relaxed">
                  Asisten coworker yang dapat menggerakkan kursor, mengeklik tab, dan mendemonstrasikan studio secara otonom.
                </p>

                <div className="space-y-1.5 pt-1">
                  <button
                    onClick={() => {
                      setIsPanelOpen(false);
                      runAutonomousTour();
                    }}
                    className="w-full py-1.5 px-2.5 bg-accent hover:bg-accent-hi text-on-accent rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    <span>JALANKAN TOUR OTOMATIS</span>
                  </button>

                  <button
                    onClick={async () => {
                      setIsPanelOpen(false);
                      if (onOpenRightPanel) onOpenRightPanel();
                      await clickElementBySelector("button:has(.lucide-globe), button:contains('PREVIEW')", "Tab Preview");
                    }}
                    className="w-full py-1.5 px-2 bg-raised hover:bg-hover text-fg border border-line-strong rounded-lg text-[11px] text-left transition-colors"
                  >
                    <MousePointer2 className="inline w-3 h-3 mr-1" />Gerakkan &amp; Klik Tab Preview
                  </button>

                  <button
                    onClick={async () => {
                      setIsPanelOpen(false);
                      if (onOpenRightPanel) onOpenRightPanel();
                      await clickElementBySelector("button:has(.lucide-hard-drive), button:contains('EXPLORER')", "Tab Explorer");
                    }}
                    className="w-full py-1.5 px-2 bg-raised hover:bg-hover text-fg border border-line-strong rounded-lg text-[11px] text-left transition-colors"
                  >
                    <Folder className="inline w-3 h-3 mr-1" />Gerakkan &amp; Klik Tab Explorer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
