"use client";

import React, { useEffect, useRef } from "react";

interface VoiceVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  audioStream: MediaStream | null;
  error?: string | null;
}

type Mode = "idle" | "listening" | "speaking" | "processing";

const COPY: Record<Mode, { eyebrow: string; title: string; hint: string }> = {
  idle: {
    eyebrow: "Siaga",
    title: "Siap dengerin",
    hint: "Klik mikrofon atau ketik pesan di bawah",
  },
  listening: {
    eyebrow: "Mic aktif",
    title: "Lagi dengerin…",
    hint: "Ngomong aja. Diam sebentar buat ngirim",
  },
  processing: {
    eyebrow: "Memproses",
    title: "Lagi mikir…",
    hint: "Nyusun jawaban dan ngerjain tugasnya",
  },
  speaking: {
    eyebrow: "Suara keluar",
    title: "Lagi ngomong",
    hint: "Klik tombol stop buat motong",
  },
};

function cssColor(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function rgba(hex: string, a: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function VoiceVisualizer({ isListening, isSpeaking, isProcessing, audioStream, error }: VoiceVisualizerProps) {
  const orbRef = useRef<HTMLCanvasElement | null>(null);
  const waveRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const mode: Mode = isListening ? "listening" : isSpeaking ? "speaking" : isProcessing ? "processing" : "idle";
  const modeRef = useRef<Mode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Analyser mikrofon
  useEffect(() => {
    if (!isListening || !audioStream) {
      analyserRef.current = null;
      return;
    }
    let ctx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    try {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      source = ctx.createMediaStreamSource(audioStream);
      source.connect(analyser);
      analyserRef.current = analyser;
    } catch (err) {
      console.warn("AudioContext setup failed:", err);
    }
    return () => {
      analyserRef.current = null;
      source?.disconnect();
      if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
    };
  }, [isListening, audioStream]);

  // Satu loop animasi untuk telur + gelombang
  useEffect(() => {
    const orb = orbRef.current;
    const wave = waveRef.current;
    if (!orb || !wave) return;
    const ectx = orb.getContext("2d");
    const wctx = wave.getContext("2d");
    if (!ectx || !wctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const readColors = () => ({
      ink: cssColor("--fg", "#12121c"),
      faint: cssColor("--fg-4", "#9a9ab2"),
      accent: cssColor("--accent", "#5b45f0"),
      accentHi: cssColor("--accent-hi", "#7059ff"),
      glow: cssColor("--glow", "#db2777"),
      lagoon: cssColor("--lagoon", "#0284c7"),
    });
    let C = readColors();
    const onTheme = () => {
      C = readColors();
    };
    window.addEventListener("vox-theme", onTheme);

    const freq = new Uint8Array(128);
    const time = new Uint8Array(256);
    let level = 0;
    let raf = 0;

    const fit = (c: HTMLCanvasElement, g: CanvasRenderingContext2D) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    };

    const render = (now: number) => {
      const m = modeRef.current;
      const analyser = analyserRef.current;
      const t = reduceMotion ? 0 : now / 1000;

      // ---- level suara 0..1
      let target = 0;
      if (m === "listening" && analyser) {
        analyser.getByteFrequencyData(freq);
        analyser.getByteTimeDomainData(time);
        let sum = 0;
        for (let i = 2; i < 48; i++) sum += freq[i];
        target = Math.min(1, sum / (46 * 150));
      } else if (m === "speaking") {
        target = 0.45 + 0.3 * Math.sin(t * 9) * Math.sin(t * 3.3) + 0.15 * Math.sin(t * 17);
      } else if (m === "processing") {
        target = 0.25 + 0.1 * Math.sin(t * 4);
      } else {
        target = 0.08 + 0.04 * Math.sin(t * 1.4);
      }
      level += (Math.max(0, target) - level) * 0.18;

      // ---- Orb
      {
        const { w, h } = fit(orb, ectx);
        ectx.clearRect(0, 0, w, h);
        const cx = w / 2;
        const cy = h / 2;
        const base = Math.min(w, h) * 0.24;
        const r = base * (1 + level * 0.35);
        const active = m !== "idle";
        const main = m === "speaking" ? C.glow : m === "processing" ? C.lagoon : C.accent;

        // halo
        const halo = ectx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.3);
        halo.addColorStop(0, rgba(main, active ? 0.22 : 0.06));
        halo.addColorStop(1, rgba(main, 0));
        ectx.fillStyle = halo;
        ectx.fillRect(0, 0, w, h);

        // cincin berdenyut dari audio
        for (let k = 0; k < 3; k++) {
          const ph = reduceMotion ? 0.3 * k : (t * (active ? 0.7 : 0.25) + k / 3) % 1;
          ectx.strokeStyle = rgba(main, (1 - ph) * (active ? 0.55 : 0.2));
          ectx.lineWidth = 1.2;
          ectx.beginPath();
          ectx.arc(cx, cy, r * (1 + ph * 0.9), 0, Math.PI * 2);
          ectx.stroke();
        }

        // badan orb: bentuk bergelombang mengikuti suara
        ectx.beginPath();
        const steps = 90;
        for (let i = 0; i <= steps; i++) {
          const ang = (i / steps) * Math.PI * 2;
          const bump =
            m === "listening" && analyser
              ? (freq[(i * 2) % 64] / 255) * 0.22
              : (Math.sin(ang * 3 + t * 2.2) + Math.sin(ang * 5 - t * 1.7)) * (0.018 + level * 0.07);
          const rr = r * (1 + bump);
          const x = cx + Math.cos(ang) * rr;
          const y = cy + Math.sin(ang) * rr;
          if (i === 0) ectx.moveTo(x, y);
          else ectx.lineTo(x, y);
        }
        ectx.closePath();
        ectx.fillStyle = rgba(main, active ? 0.14 : 0.06);
        ectx.fill();
        ectx.strokeStyle = rgba(main, 0.95);
        ectx.lineWidth = 1.5;
        ectx.stroke();

        // crosshair
        ectx.strokeStyle = rgba(main, 0.5);
        ectx.lineWidth = 1;
        ectx.beginPath();
        ectx.moveTo(cx - r * 0.3, cy); ectx.lineTo(cx + r * 0.3, cy);
        ectx.moveTo(cx, cy - r * 0.3); ectx.lineTo(cx, cy + r * 0.3);
        ectx.stroke();

        // orbit saat memproses
        if (m === "processing") {
          const a = reduceMotion ? 0 : t * 3.6;
          ectx.strokeStyle = rgba(C.lagoon, 0.9);
          ectx.lineWidth = 2;
          ectx.lineCap = "round";
          ectx.beginPath();
          ectx.arc(cx, cy, r * 1.45, a, a + 1.4);
          ectx.stroke();
          ectx.beginPath();
          ectx.arc(cx, cy, r * 1.45, a + Math.PI, a + Math.PI + 0.6);
          ectx.stroke();
        }
      }

      // ---- Gelombang
      {
        const { w, h } = fit(wave, wctx);
        wctx.clearRect(0, 0, w, h);
        const mid = h / 2;
        const color = m === "listening" ? C.accent : m === "speaking" ? C.glow : m === "processing" ? C.lagoon : C.faint;

        // garis dasar putus-putus
        wctx.strokeStyle = rgba(C.ink, 0.12);
        wctx.setLineDash([2, 5]);
        wctx.lineWidth = 1;
        wctx.beginPath();
        wctx.moveTo(0, mid);
        wctx.lineTo(w, mid);
        wctx.stroke();
        wctx.setLineDash([]);

        const pts = Math.max(40, Math.floor(w / 4));
        const draw = (amp: number, phase: number, alpha: number, width: number) => {
          wctx.strokeStyle = rgba(color, alpha);
          wctx.lineWidth = width;
          wctx.lineJoin = "round";
          wctx.beginPath();
          for (let i = 0; i <= pts; i++) {
            const u = i / pts;
            const x = u * w;
            const env = Math.sin(Math.PI * u); // meruncing di ujung
            let v: number;
            if (m === "listening" && analyser) {
              v = (time[Math.floor(u * 255)] - 128) / 128;
              v *= 2.4;
            } else if (m === "processing") {
              const head = ((t * 0.6) % 1.4) - 0.2;
              v = Math.exp(-Math.pow((u - head) * 9, 2)) * Math.sin(u * 60 - t * 10);
            } else {
              v = Math.sin(u * 14 + t * 3 + phase) * 0.6 + Math.sin(u * 31 - t * 4.2 + phase) * 0.4;
            }
            const y = mid + v * env * amp * (h * 0.42);
            if (i === 0) wctx.moveTo(x, y);
            else wctx.lineTo(x, y);
          }
          wctx.stroke();
        };
        const amp = m === "idle" ? 0.12 : Math.min(1, 0.25 + level);
        draw(amp * 0.6, 1.7, 0.3, 1);
        draw(amp, 0, 0.95, 2);
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("vox-theme", onTheme);
    };
  }, []);

  const copy = COPY[mode];

  return (
    <section
      aria-live="polite"
      aria-label={error || copy.title}
      title={error || copy.hint}
      className="relative isolate w-full h-[54px] shrink-0 rounded-full bg-base shadow-[inset_0_0_0_1px_var(--line)] pl-1.5 pr-4 py-1 flex items-center gap-3 overflow-hidden"
    >
      <canvas ref={orbRef} aria-hidden="true" className="w-11 h-11 shrink-0" style={{ animationDelay: "220ms" }} />

      <div className="flex flex-1 items-baseline gap-2.5 min-w-0">
        <span className="shrink-0 max-w-full text-[14px] font-medium tracking-[-0.01em] text-fg truncate">
          {error || copy.title}
        </span>
        {!error && <span className="hidden sm:inline text-[12px] text-fg-3 truncate">{copy.hint}</span>}
      </div>

      <canvas ref={waveRef} aria-hidden="true" className="w-20 sm:w-28 shrink-0 h-8 hidden min-[420px]:block" />
    </section>
  );
}
