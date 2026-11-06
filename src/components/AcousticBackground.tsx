"use client";

import React, { useEffect, useRef } from "react";

interface AcousticBackgroundProps {
  isListening?: boolean;
  isSpeaking?: boolean;
}

export function AcousticBackground({ isListening = false, isSpeaking = false }: AcousticBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Particle nodes for cyber acoustic constellation
    const particleCount = Math.min(45, Math.floor(width / 35));
    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      baseAlpha: number;
      pulsePhase: number;
    }[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1,
        baseAlpha: Math.random() * 0.3 + 0.1,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    let time = 0;

    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      // 1. Subtle Radial Ambient Vignette
      const bgGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.4,
        width * 0.1,
        width * 0.5,
        height * 0.5,
        width * 0.8
      );
      if (isSpeaking) {
        bgGrad.addColorStop(0, "rgba(234, 88, 12, 0.07)");
        bgGrad.addColorStop(0.5, "rgba(24, 28, 40, 0.4)");
        bgGrad.addColorStop(1, "rgba(8, 10, 14, 0.98)");
      } else if (isListening) {
        bgGrad.addColorStop(0, "rgba(56, 189, 248, 0.08)");
        bgGrad.addColorStop(0.5, "rgba(20, 29, 44, 0.4)");
        bgGrad.addColorStop(1, "rgba(8, 10, 14, 0.98)");
      } else {
        bgGrad.addColorStop(0, "rgba(22, 26, 36, 0.3)");
        bgGrad.addColorStop(1, "rgba(8, 9, 13, 0.98)");
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. High-Tech Grid Lines (Subtle)
      ctx.strokeStyle = "rgba(40, 48, 66, 0.08)";
      ctx.lineWidth = 1;
      const gridSize = 70;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 3. Acoustic Soundwave Horizon Pulse
      const waveY = height * 0.48;
      const waveAmplitude = isSpeaking ? 30 : isListening ? 22 : 12;
      const waveFreq = 0.008;

      ctx.beginPath();
      for (let x = 0; x <= width; x += 15) {
        const y =
          waveY +
          Math.sin(x * waveFreq + time * 1.5) * waveAmplitude * Math.sin(time * 0.8) +
          Math.cos(x * 0.004 - time) * (waveAmplitude * 0.4);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = isSpeaking
        ? "rgba(234, 88, 12, 0.18)"
        : isListening
        ? "rgba(56, 189, 248, 0.18)"
        : "rgba(100, 116, 139, 0.06)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Second harmonic wave
      ctx.beginPath();
      for (let x = 0; x <= width; x += 15) {
        const y =
          waveY +
          Math.sin(x * (waveFreq * 1.3) - time * 1.2) * (waveAmplitude * 0.6) +
          Math.sin(time) * 5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = isSpeaking
        ? "rgba(249, 115, 22, 0.1)"
        : isListening
        ? "rgba(56, 189, 248, 0.1)"
        : "rgba(71, 85, 105, 0.04)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // 4. Moving Constellation Particles with Connector Lines
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Pulse alpha
        const pulse = Math.sin(time * 2 + p.pulsePhase);
        const currentAlpha = Math.max(0.05, p.baseAlpha + pulse * 0.12);

        // Particle Dot
        ctx.fillStyle = isSpeaking
          ? `rgba(234, 88, 12, ${currentAlpha})`
          : isListening
          ? `rgba(56, 189, 248, ${currentAlpha})`
          : `rgba(148, 163, 184, ${currentAlpha * 0.7})`;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Connect nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            const lineAlpha = (1 - dist / 110) * 0.12;
            ctx.strokeStyle = isSpeaking
              ? `rgba(234, 88, 12, ${lineAlpha})`
              : isListening
              ? `rgba(56, 189, 248, ${lineAlpha})`
              : `rgba(100, 116, 139, ${lineAlpha * 0.6})`;
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isListening, isSpeaking]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 select-none opacity-90 transition-opacity duration-700"
    />
  );
}
