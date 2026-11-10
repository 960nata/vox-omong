"use client";

import React, { useEffect, useRef } from "react";
import { animate as anime } from "animejs";
import type { SlideItem } from "@/lib/types";
import { getTheme, type DeckTheme } from "@/lib/claudeSkills/themes";

/** Angka pertama di teks naik dari 0 (mis. "Rp 4,5 jt", "85%", "1.200+"): hanya saat animate aktif dan user tidak minta gerak dikurangi. */
function CountUp({ text, run }: { text: string; run: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !run || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const m = text.match(/\d[\d.,]*/);
    if (!m) return;
    const raw = m[0];
    const thousands = /^\d{1,3}([.,]\d{3})+$/.test(raw);
    const sep = raw.includes(".") ? "." : ",";
    const decimalComma = !thousands && /,\d{1,2}$/.test(raw);
    const num = thousands ? parseInt(raw.replace(/[.,]/g, ""), 10) : parseFloat(decimalComma ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, ""));
    if (!isFinite(num) || num === 0) return;
    const decimals = thousands ? 0 : decimalComma ? (raw.split(",")[1] || "").length : /\.\d{1,2}$/.test(raw) ? (raw.split(".")[1] || "").length : 0;
    const fmt = (v: number) => {
      if (thousands) return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
      const s = v.toFixed(decimals);
      return decimalComma ? s.replace(".", ",") : s;
    };
    const pre = text.slice(0, m.index);
    const post = text.slice((m.index ?? 0) + raw.length);
    const state = { v: 0 };
    const a = anime(state, { v: num, duration: 1500, ease: "outExpo", onUpdate: () => (el.textContent = `${pre}${fmt(state.v)}${post}`), onComplete: () => (el.textContent = text) });
    return () => {
      a.pause();
      el.textContent = text;
    };
  }, [text, run]);
  return <span ref={ref}>{text}</span>;
}

/**
 * Satu slide 16:9 bertema. Ukuran font memakai unit container (cqw)
 * sehingga tampil proporsional baik sebagai thumbnail maupun layar penuh.
 */
export function SlideView({
  slide,
  themeId,
  index,
  total,
  deckTitle,
  animate = false,
}: {
  slide: SlideItem;
  themeId?: string;
  index: number;
  total: number;
  deckTitle: string;
  animate?: boolean;
}) {
  const t = getTheme(themeId);
  const c = (hex: string) => `#${hex}`;
  const rawLayout = slide.layout || (index === 0 ? "cover" : index === total - 1 ? "closing" : "bullets");
  const img = slide.image;
  // layout "image" tanpa foto (pencarian gagal / kuota habis) tampil sebagai daftar biasa
  const layout = rawLayout === "image" && !img ? "bullets" : rawLayout;
  const bgPhoto = !!img && (layout === "cover" || layout === "closing");
  const sidePhoto = !!img && (layout === "image" || layout === "bullets");
  const upper = t.titleCase === "upper";
  const kenRef = useRef<HTMLImageElement>(null);
  // Foto latar bergerak pelan (zoom halus) saat slide diputar, seperti Ken Burns di editor video
  useEffect(() => {
    const el = kenRef.current;
    if (!el || !animate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const a = anime(el, { scale: [1, 1.09], duration: 9000, ease: "linear", alternate: true, loop: true });
    return () => {
      a.pause();
      el.style.transform = "";
    };
  }, [animate, img?.url]);
  const anim = (delay: number): React.CSSProperties =>
    animate ? { animation: `rise-in 600ms cubic-bezier(.2,.8,.2,1) ${delay}ms both` } : {};

  const title: React.CSSProperties = {
    fontFamily: t.cssDisplay,
    color: c(t.text),
    textTransform: upper ? "uppercase" : undefined,
    letterSpacing: upper ? "0.01em" : "-0.01em",
    lineHeight: 1.05,
    margin: 0,
  };

  return (
    <div
      className="relative w-full aspect-video overflow-hidden select-text"
      style={{ containerType: "inline-size", background: c(t.bg), color: c(t.text), fontFamily: t.cssBody }}
    >
      {bgPhoto && img && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={kenRef} src={img.url} alt={img.alt} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${c(t.bg)}f5 0%, ${c(t.bg)}e0 42%, ${c(t.bg)}55 100%)` }} />
        </>
      )}
      {!bgPhoto && <Motif t={t} layout={layout} />}
      {sidePhoto && img && (
        <div className="absolute overflow-hidden" style={{ top: "0", right: "0", bottom: "0", width: layout === "image" ? "40%" : "30%", ...anim(120) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.small} alt={img.alt} className="w-full h-full object-cover" draggable={false} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${c(t.bg)}cc 0%, transparent 28%)` }} />
        </div>
      )}

      <div className="absolute inset-0 flex flex-col" style={{ padding: "6cqw 7cqw 5cqw" }}>
        {/* kicker */}
        <div
          style={{ ...anim(0), fontFamily: "var(--font-mono), monospace", fontSize: "1.25cqw", letterSpacing: "0.2em", textTransform: "uppercase", color: c(t.accent) }}
        >
          {slide.kicker || (layout === "cover" ? deckTitle : `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`)}
        </div>

        {layout === "cover" && (
          <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: "78%" }}>
            <h2 style={{ ...title, ...anim(80), fontSize: "6.4cqw" }}>{slide.title}</h2>
            {(slide.subtitle || slide.bullets[0]) && (
              <p style={{ ...anim(180), fontSize: "1.9cqw", color: c(t.muted), marginTop: "2.2cqw", lineHeight: 1.4 }}>
                {slide.subtitle || slide.bullets[0]}
              </p>
            )}
          </div>
        )}

        {layout === "closing" && (
          <div className="flex-1 flex flex-col justify-center items-start">
            <h2 style={{ ...title, ...anim(80), fontSize: "5.6cqw", maxWidth: "80%" }}>{slide.title}</h2>
            {(slide.subtitle || slide.bullets.length > 0) && (
              <p style={{ ...anim(180), fontSize: "1.9cqw", color: c(t.muted), marginTop: "2cqw", maxWidth: "70%", lineHeight: 1.4 }}>
                {slide.subtitle || slide.bullets.join(" · ")}
              </p>
            )}
            <div style={{ ...anim(260), marginTop: "3cqw", height: "0.5cqw", width: "12cqw", background: c(t.accent), borderRadius: 99 }} />
          </div>
        )}

        {layout === "stat" && (
          <div className="flex-1 flex items-center" style={{ gap: "5cqw" }}>
            <div style={{ ...anim(80), fontFamily: t.cssDisplay, fontSize: "13cqw", lineHeight: 0.9, color: c(t.accent), whiteSpace: "nowrap" }}>
              <CountUp text={slide.stat?.value || "—"} run={animate} />
            </div>
            <div style={{ maxWidth: "48%" }}>
              <h2 style={{ ...title, ...anim(160), fontSize: "3.2cqw" }}>{slide.title}</h2>
              <p style={{ ...anim(240), fontSize: "1.8cqw", color: c(t.muted), marginTop: "1.4cqw", lineHeight: 1.4 }}>
                {slide.stat?.label || slide.subtitle || slide.bullets[0]}
              </p>
            </div>
          </div>
        )}

        {layout === "quote" && (
          <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: "84%" }}>
            <div style={{ ...anim(40), fontFamily: t.cssDisplay, fontSize: "10cqw", lineHeight: 0.6, color: c(t.accent) }}>“</div>
            <blockquote style={{ ...title, ...anim(120), fontSize: "3.6cqw", lineHeight: 1.2, textTransform: undefined }}>
              {slide.quote?.text || slide.title}
            </blockquote>
            {(slide.quote?.author || slide.subtitle) && (
              <p style={{ ...anim(220), fontSize: "1.6cqw", color: c(t.muted), marginTop: "2.4cqw" }}>— {slide.quote?.author || slide.subtitle}</p>
            )}
          </div>
        )}

        {layout === "split" && (
          <div className="flex-1 flex flex-col" style={{ marginTop: "2cqw" }}>
            <h2 style={{ ...title, ...anim(60), fontSize: "3.6cqw" }}>{slide.title}</h2>
            <div className="flex-1 grid grid-cols-2" style={{ gap: "3cqw", marginTop: "3cqw" }}>
              {[
                { head: slide.columns?.leftTitle, items: slide.columns?.left || slide.bullets.slice(0, 2), alt: false },
                { head: slide.columns?.rightTitle, items: slide.columns?.right || slide.bullets.slice(2), alt: true },
              ].map((col, i) => (
                <div
                  key={i}
                  style={{
                    ...anim(160 + i * 100),
                    background: col.alt ? c(t.accent) : c(t.surface),
                    color: col.alt ? c(t.bg) : c(t.text),
                    borderRadius: "1.4cqw",
                    padding: "2.4cqw",
                  }}
                >
                  {col.head && (
                    <div style={{ fontFamily: t.cssDisplay, fontSize: "2cqw", marginBottom: "1.2cqw", fontWeight: 700 }}>{col.head}</div>
                  )}
                  <ul style={{ margin: 0, paddingLeft: "1.8cqw", fontSize: "1.55cqw", lineHeight: 1.45 }}>
                    {col.items.map((it, k) => (
                      <li key={k} style={{ marginBottom: "0.7cqw" }}>
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {layout === "image" && (
          <div className="flex-1 flex flex-col" style={{ marginTop: "2cqw", maxWidth: "52%" }}>
            <h2 style={{ ...title, ...anim(60), fontSize: "3.6cqw" }}>{slide.title}</h2>
            {slide.subtitle && <p style={{ ...anim(120), fontSize: "1.6cqw", color: c(t.muted), marginTop: "1.2cqw", lineHeight: 1.4 }}>{slide.subtitle}</p>}
            <ol className="flex-1 flex flex-col justify-center" style={{ listStyle: "none", padding: 0, margin: "1.6cqw 0 0", gap: "1.4cqw" }}>
              {slide.bullets.map((b, i) => (
                <li key={i} className="flex items-baseline" style={{ ...anim(160 + i * 90), gap: "1.6cqw", fontSize: "1.7cqw", lineHeight: 1.35 }}>
                  <span style={{ fontFamily: t.cssDisplay, color: c(t.accent), fontSize: "2cqw", minWidth: "2.6cqw" }}>{String(i + 1).padStart(2, "0")}</span>
                  <span>{b}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {layout === "steps" && (
          <div className="flex-1 flex flex-col" style={{ marginTop: "2cqw" }}>
            <h2 style={{ ...title, ...anim(60), fontSize: "3.8cqw", maxWidth: "85%" }}>{slide.title}</h2>
            <div className="flex-1 flex items-center" style={{ gap: "1.4cqw", marginTop: "1.6cqw" }}>
              {slide.bullets.slice(0, 5).map((b, i) => {
                const [head, ...rest] = b.split(/:\s+/);
                const hasHead = rest.length > 0;
                return (
                  <div key={i} className="flex-1 flex flex-col" style={{ ...anim(140 + i * 100), background: c(t.surface), borderRadius: "1.2cqw", padding: "1.6cqw", minHeight: "17cqw", borderTop: `0.4cqw solid ${c(t.accent)}` }}>
                    <span style={{ fontFamily: t.cssDisplay, color: c(t.accent), fontSize: "3cqw", lineHeight: 1 }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ fontFamily: t.cssDisplay, fontSize: "1.7cqw", marginTop: "1cqw", lineHeight: 1.2 }}>{hasHead ? head : b}</span>
                    {hasHead && <span style={{ fontSize: "1.3cqw", color: c(t.muted), marginTop: "0.8cqw", lineHeight: 1.4 }}>{rest.join(": ")}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {layout === "bullets" && (
          <div className="flex-1 flex flex-col" style={{ marginTop: "2cqw", maxWidth: sidePhoto ? "62%" : undefined }}>
            <h2 style={{ ...title, ...anim(60), fontSize: "4cqw", maxWidth: "85%" }}>{slide.title}</h2>
            <ol className="flex-1 flex flex-col justify-center" style={{ listStyle: "none", padding: 0, margin: "2.4cqw 0 0", gap: "1.6cqw" }}>
              {slide.bullets.map((b, i) => (
                <li key={i} className="flex items-baseline" style={{ ...anim(160 + i * 90), gap: "1.8cqw", fontSize: "1.9cqw", lineHeight: 1.35 }}>
                  <span style={{ fontFamily: t.cssDisplay, color: c(t.accent), fontSize: "2.2cqw", minWidth: "3cqw" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {img && (
        <a
          href={img.authorUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute"
          style={{ right: "1.6cqw", bottom: "1cqw", fontSize: "0.9cqw", color: "#fff", opacity: 0.7, textShadow: "0 0 4px rgba(0,0,0,.7)", textDecoration: "none" }}
        >
          Foto: {img.author} / Unsplash
        </a>
      )}
    </div>
  );
}

function Motif({ t, layout }: { t: DeckTheme; layout: string }) {
  const a = `#${t.accent}`;
  const a2 = `#${t.accent2}`;
  const big = layout === "cover" || layout === "closing";
  switch (t.motif) {
    case "circle":
      return (
        <>
          <div className="absolute rounded-full" style={{ width: big ? "46cqw" : "22cqw", aspectRatio: "1", right: "-10cqw", top: "-12cqw", background: a }} />
          <div className="absolute rounded-full" style={{ width: "10cqw", aspectRatio: "1", right: "18cqw", bottom: "-4cqw", background: a2 }} />
        </>
      );
    case "grid":
      return (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(${a}22 1px, transparent 1px), linear-gradient(90deg, ${a}22 1px, transparent 1px)`,
            backgroundSize: "5cqw 5cqw",
            maskImage: "radial-gradient(ellipse at 80% 20%, black, transparent 70%)",
          }}
        />
      );
    case "rule":
      return (
        <>
          <div className="absolute" style={{ left: "7cqw", right: "7cqw", top: "4.2cqw", height: "0.25cqw", background: `#${t.text}` }} />
          <div className="absolute" style={{ left: "7cqw", right: "7cqw", bottom: "3.4cqw", height: "0.12cqw", background: `#${t.text}` }} />
          {big && <div className="absolute" style={{ right: "7cqw", top: "5.4cqw", width: "3cqw", height: "3cqw", background: a }} />}
        </>
      );
    case "blob":
      return (
        <div
          className="absolute"
          style={{
            width: big ? "50cqw" : "28cqw",
            aspectRatio: "1",
            right: "-14cqw",
            bottom: "-18cqw",
            background: `radial-gradient(circle at 30% 30%, ${a}, ${a2})`,
            borderRadius: "42% 58% 63% 37% / 45% 39% 61% 55%",
            opacity: 0.85,
          }}
        />
      );
    case "bar":
      return <div className="absolute" style={{ left: 0, top: 0, bottom: 0, width: big ? "3.2cqw" : "1.2cqw", background: a }} />;
    case "frame":
      return (
        <>
          <div className="absolute" style={{ inset: "2.2cqw", border: `0.18cqw solid ${a}`, borderRadius: "0.6cqw" }} />
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute"
              style={{
                width: "2cqw",
                height: "2cqw",
                background: a2,
                transform: "rotate(45deg)",
                left: i % 2 ? undefined : "1.2cqw",
                right: i % 2 ? "1.2cqw" : undefined,
                top: i < 2 ? "1.2cqw" : undefined,
                bottom: i >= 2 ? "1.2cqw" : undefined,
              }}
            />
          ))}
        </>
      );
    case "dots":
    default:
      return (
        <div
          className="absolute"
          style={{
            right: "-6cqw",
            top: "-6cqw",
            width: big ? "40cqw" : "24cqw",
            aspectRatio: "0.78",
            borderRadius: "50% 50% 50% 50% / 58% 58% 42% 42%",
            background: `radial-gradient(circle at 50% 62%, ${a} 0 18%, transparent 19%), radial-gradient(circle, #${t.text}22 0.35cqw, transparent 0.4cqw) 0 0 / 3cqw 3cqw, #${t.surface}`,
            boxShadow: `inset 0 0 0 0.2cqw #${t.text}22`,
          }}
        />
      );
  }
}
