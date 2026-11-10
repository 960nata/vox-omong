"use client";

import React, { useEffect, useRef } from "react";

/**
 * Putar animasi Lottie (JSON hasil ekspor After Effects / LottieFiles) di dalam halaman.
 * lottie-web hanya dimuat di browser. `src` = URL file .json (mis. /animations/loading.json).
 */
export function LottiePlayer({ src, loop = true, className }: { src: string; loop?: boolean; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let anim: { destroy: () => void } | null = null;
    let cancelled = false;
    void import("lottie-web").then((mod) => {
      if (cancelled || !host.current) return;
      anim = mod.default.loadAnimation({ container: host.current, renderer: "svg", loop, autoplay: !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, path: src });
    });
    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [src, loop]);
  return <div ref={host} className={className} aria-hidden />;
}
