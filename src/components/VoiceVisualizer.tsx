"use client";

import React, { useEffect, useRef } from "react";

interface VoiceVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  audioStream: MediaStream | null;
}

export function VoiceVisualizer({
  isListening,
  isSpeaking,
  isProcessing,
  audioStream,
}: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Setup Web Audio Analyser when audioStream is active
  useEffect(() => {
    if (isListening && audioStream) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;

        const source = ctx.createMediaStreamSource(audioStream);
        source.connect(analyser);

        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;
      } catch (err) {
        console.warn("AudioContext setup failed:", err);
      }
    } else {
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      analyserRef.current = null;
    }

    return () => {
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [isListening, audioStream]);

  // Main canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let phase = 0;
    const barCount = 36;
    const dataArray = new Uint8Array(32);

    const render = () => {
      // Handle high DPI
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      phase += 0.08;

      let heights: number[] = [];

      if (isListening && analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        // Map frequency data to bar heights
        for (let i = 0; i < barCount; i++) {
          const freqIndex = Math.floor((i / barCount) * dataArray.length);
          const rawVal = dataArray[freqIndex] || 0;
          const normalized = rawVal / 255;
          const h = Math.max(4, normalized * (height * 0.75));
          heights.push(h);
        }
      } else if (isSpeaking) {
        // Dynamic rhythmic speech wave
        for (let i = 0; i < barCount; i++) {
          const wave =
            Math.sin(phase + i * 0.35) * 0.4 +
            Math.sin(phase * 1.5 + i * 0.2) * 0.3 +
            0.5;
          const h = 6 + wave * (height * 0.6);
          heights.push(h);
        }
      } else if (isProcessing) {
        // Elegant scanner effect
        for (let i = 0; i < barCount; i++) {
          const dist = Math.abs((i - ((phase * 4) % barCount)) / barCount);
          const intensity = Math.max(0, 1 - dist * 3);
          const h = 4 + intensity * (height * 0.5);
          heights.push(h);
        }
      } else {
        // Idle gentle breathing baseline
        for (let i = 0; i < barCount; i++) {
          const wave = Math.sin(phase * 0.5 + i * 0.2) * 0.15 + 0.15;
          const h = 3 + wave * 14;
          heights.push(h);
        }
      }

      // Draw mirrored bars from center
      const barSpacing = width / barCount;
      const barWidth = Math.max(2, barSpacing * 0.55);
      const centerY = height / 2;

      for (let i = 0; i < barCount; i++) {
        const x = i * barSpacing + (barSpacing - barWidth) / 2;
        const h = heights[i] || 4;

        // Distinctive warm terracotta/amber gradient palette (not generic purple AI!)
        let fillStyle = "#383f4d"; // default idle
        if (isListening) {
          // Warm mineral emerald / amber energy
          fillStyle = i % 2 === 0 ? "#10b981" : "#059669";
        } else if (isSpeaking) {
          // Warm terracotta flame
          fillStyle = i % 3 === 0 ? "#f97316" : i % 3 === 1 ? "#ea580c" : "#fb923c";
        } else if (isProcessing) {
          fillStyle = "#eab308";
        }

        ctx.fillStyle = fillStyle;
        // Strictly 3px subtle bevel on bar caps
        const topY = centerY - h / 2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, topY, barWidth, h, 2);
        } else {
          ctx.rect(x, topY, barWidth, h);
        }
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isListening, isSpeaking, isProcessing]);

  return (
    <div className="relative w-full h-28 bg-[#14171d] border border-[#2b303c] rounded-[3px] p-3 flex flex-col justify-between overflow-hidden shadow-inner">
      {/* Top status indicator header */}
      <div className="flex items-center justify-between text-xs font-mono tracking-wider gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-block w-2 h-2 rounded-[2px] shrink-0 transition-colors duration-200 ${
              isListening
                ? "bg-[#10b981] animate-pulse"
                : isSpeaking
                ? "bg-[#f97316] animate-pulse"
                : isProcessing
                ? "bg-[#eab308] animate-pulse"
                : "bg-[#4a5263]"
            }`}
          />
          <span className="text-[#a1a7b4] uppercase truncate text-[11px] sm:text-xs">
            {isListening
              ? "MIC LIVE · MENDENGARKAN"
              : isSpeaking
              ? "AUDIO OUT · BICARA"
              : isProcessing
              ? "AI PROCESSING..."
              : "VOICE ENGINE · SIAGA"}
          </span>
        </div>
        <div className="text-[#6d7585] text-[10px] sm:text-[11px] shrink-0 hidden sm:block">
          {isListening ? "AUDIO IN: ACTIVE" : isSpeaking ? "SPEECH: SYNTHESIS" : "48kHz / PCM"}
        </div>
      </div>

      {/* Spectrum Canvas */}
      <div className="w-full flex-1 relative mt-1 min-w-0">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Subtle bottom audio ruler markings */}
      <div className="flex justify-between items-center text-[10px] text-[#555d6e] font-mono select-none pt-1 border-t border-[#1e232c]">
        <span>-36dB</span>
        <span>-24dB</span>
        <span>-12dB</span>
        <span>-6dB</span>
        <span className="text-[#d97706]">0dB</span>
      </div>
    </div>
  );
}
