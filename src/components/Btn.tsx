import React from "react";

/** Panah diagonal ganda: yang lama terbang keluar, yang baru masuk saat hover. */
export function ArrowIcon({ className = "" }: { className?: string }) {
  const path = <path d="M3 1.5h7.5V9M10.5 1.5 1.5 10.5" stroke="currentColor" strokeWidth="1.5" />;
  return (
    <span aria-hidden="true" className={`arrow-icon ${className}`}>
      <svg viewBox="0 0 12 12" fill="none" className="arrow-icon__svg">{path}</svg>
      <svg viewBox="0 0 12 12" fill="none" className="arrow-icon__svg">{path}</svg>
    </span>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "outline";
  size?: "xs" | "sm" | "md" | "lg";
  /** Ikon di dalam chip bulat; default panah. false = tanpa chip. */
  icon?: React.ReactNode | false;
};

/** Tombol pill bergaya studio: fill melingkar menyebar dari chip saat hover. */
export function Btn({ variant = "primary", size = "md", icon, children, className = "", ...rest }: BtnProps) {
  const hasIcon = icon !== false;
  return (
    <button
      type="button"
      {...rest}
      className={`btn ${className}`}
      data-variant={variant}
      data-size={size}
      data-icon={hasIcon ? "true" : undefined}
    >
      <span aria-hidden="true" className="btn__fill" />
      <span className="btn__label">{children}</span>
      {hasIcon && (
        <span aria-hidden="true" className="btn__chip">
          {icon ?? <ArrowIcon />}
        </span>
      )}
    </button>
  );
}
