"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ThemePref = "system" | "light" | "dark";
import { THEME_STORAGE_KEY as KEY } from "./themeBoot";

function resolve(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") delete root.dataset.theme;
  else root.dataset.theme = pref;
  window.dispatchEvent(new CustomEvent("vox-theme"));
}

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {}
  return "system";
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onMq = () => {
    window.dispatchEvent(new CustomEvent("vox-theme"));
  };
  mq.addEventListener("change", onMq);
  window.addEventListener("vox-theme", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    mq.removeEventListener("change", onMq);
    window.removeEventListener("vox-theme", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as ThemePref);
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolve(readPref()),
    () => "light" as const
  );

  /** Ganti tema; `origin` = titik klik untuk animasi lingkaran. */
  const setTheme = useCallback((next: ThemePref, origin?: { x: number; y: number }) => {
    const commit = () => {
      try {
        if (next === "system") localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, next);
      } catch {}
      apply(next); // memicu "vox-theme" → hook membaca ulang
    };

    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition || reduce || resolve(next) === resolve(pref)) {
      commit();
      return;
    }
    const x = origin?.x ?? window.innerWidth - 40;
    const y = origin?.y ?? 28;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const root = document.documentElement;
    root.style.setProperty("--vt-x", `${x}px`);
    root.style.setProperty("--vt-y", `${y}px`);
    root.style.setProperty("--vt-r", `${r}px`);
    doc.startViewTransition(commit);
  }, [pref]);

  return { pref, resolved, setTheme };
}
