import React from "react";

/** Tanda VOX: lingkaran tinta dengan titik aksen yang berdenyut saat aktif. */
export function Logo({ active = false, className = "w-7 h-7" }: { active?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={`${className} relative grid place-items-center rounded-full bg-ink shrink-0`}>
      <svg viewBox="0 0 24 24" className="w-[55%] h-[55%]" fill="none">
        {[5, 9, 12, 15, 19].map((x, i) => {
          const h = [4, 9, 14, 9, 4][i];
          return (
            <rect
              key={x}
              x={x - 1}
              y={12 - h / 2}
              width="2"
              height={h}
              rx="1"
              fill={i === 2 ? "var(--accent)" : "var(--on-ink)"}
              style={{
                transformOrigin: `${x}px 12px`,
                animation: active ? `logo-bar 0.9s var(--ease-out-expo) ${i * 0.08}s infinite alternate` : undefined,
              }}
            />
          );
        })}
      </svg>
      <style>{`@keyframes logo-bar{to{transform:scaleY(0.35)}}`}</style>
    </span>
  );
}
