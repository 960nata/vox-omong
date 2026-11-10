"use client";

import React from "react";

interface AcousticBackgroundProps {
  isListening?: boolean;
  isSpeaking?: boolean;
}

/** Latar bersih; hanya garis tipis di atas yang menyala saat mic / suara aktif. */
export function AcousticBackground({ isListening = false, isSpeaking = false }: AcousticBackgroundProps) {
  const active = isListening || isSpeaking;
  return (
    <div aria-hidden="true" className="fixed inset-x-0 top-14 z-40 h-px pointer-events-none overflow-hidden">
      <div
        className="h-full w-full bg-accent origin-left"
        style={{ transform: `scaleX(${active ? 1 : 0})`, transition: "transform 1.2s var(--ease-out-expo)" }}
      />
    </div>
  );
}
