"use client";

import React, { useMemo, useState } from "react";
import type { ArtifactItem } from "@/lib/types";
import { Btn } from "./Btn";
import { AlertTriangle, ChevronDown, Code2, Download, Eye, Users } from "lucide-react";

const ROLE_STYLE: Record<string, { label: string; dot: string }> = {
  arsitek: { label: "Arsitek", dot: "bg-lagoon" },
  aset: { label: "Aset", dot: "bg-fg-3" },
  developer: { label: "Developer", dot: "bg-accent" },
  reviewer: { label: "Reviewer", dot: "bg-glow" },
  revisi: { label: "Revisi", dot: "bg-moss" },
};

function shortModel(m: string) {
  if (!m || m === "-") return "—";
  return m.replace(/^@cf\//, "").split("/").pop()!.replace(/-instruct.*|-fp8.*|:free$/g, "");
}

/** Pewarnaan sintaks HTML ringan (tag, atribut, string, komentar). */
export function highlight(line: string) {
  const esc = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Satu kali lewat supaya span yang disisipkan tidak ikut ter-highlight lagi
  return esc.replace(
    /(&lt;!--.*?--&gt;)|(&lt;\/?)([a-zA-Z][a-zA-Z0-9-]*)|(\s)([a-zA-Z_:@.-]+)(?==)|("[^"]*"|'[^']*')/g,
    (_m, comment, open, tag, sp, attr, str) => {
      if (comment) return `<span class="text-fg-4 italic">${comment}</span>`;
      if (open) return `${open}<span class="text-accent font-semibold">${tag}</span>`;
      if (attr) return `${sp}<span class="text-lagoon">${attr}</span>`;
      if (str) return `<span class="text-glow">${str}</span>`;
      return _m;
    }
  );
}

export function WebsiteCard({ artifact }: { artifact: ArtifactItem }) {
  const site = artifact.website!;
  const [showMeeting, setShowMeeting] = useState(false);
  const meeting = site.meeting || [];
  const models = Array.from(new Set(meeting.map((m) => shortModel(m.model)).filter((m) => m !== "—" && m !== "otomatis")));

  const lines = useMemo(() => site.html.split("\n"), [site.html]);
  const kb = (new Blob([site.html]).size / 1024).toFixed(1);
  const modeLabel = site.mode === "edit" ? "Diubah" : site.mode === "undo" ? "Dikembalikan" : "Baru";

  const download = () => {
    const blob = new Blob([site.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(artifact.title || "website").replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openStudio = (t: "preview" | "code" = "preview") => {
    window.dispatchEvent(new CustomEvent("vox_open_studio", { detail: { artifact, tab: t } }));
  };

  return (
    <div className="w-full rounded-2xl border border-line bg-raised overflow-hidden">
      {/* Header */}
      <div className="px-3.5 pt-3 pb-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-accent-wash text-accent text-[10px] font-mono uppercase tracking-[0.14em]">{modeLabel}</span>
            <span className="font-mono text-[10px] text-fg-4">index.html · {lines.length} baris · {kb} KB</span>
          </div>
          <div className="font-display text-base font-bold text-fg mt-1 truncate">{artifact.title}</div>
          {artifact.summary && <div className="text-xs text-fg-3 mt-0.5 line-clamp-2">{artifact.summary}</div>}
        </div>
      </div>

      {/* Notulen rapat tim AI */}
      {meeting.length > 0 && (
        <div className="mx-2.5 mb-2 rounded-xl bg-base/80 border border-line">
          <button
            onClick={() => setShowMeeting(!showMeeting)}
            aria-expanded={showMeeting}
            className="w-full px-3 py-2 flex items-center gap-2 text-left cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="text-xs text-fg-2 font-medium">Rapat tim AI</span>
            <span className="text-[11px] text-fg-4 truncate">
              {meeting.length} giliran · {models.length} model{site.score ? ` · skor review ${site.score}/10` : ""}
            </span>
            <div className="ml-auto flex -space-x-1 shrink-0">
              {meeting.slice(0, 5).map((m, i) => (
                <span key={i} className={`w-2.5 h-2.5 rounded-full ring-2 ring-base ${ROLE_STYLE[m.role]?.dot || "bg-fg-4"}`} />
              ))}
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-fg-3 transition-transform ${showMeeting ? "rotate-180" : ""}`} />
          </button>
          {showMeeting && (
            <ol className="px-3 pb-3 space-y-2.5 animate-rise">
              {meeting.map((m, i) => (
                <li key={i} className="relative pl-5">
                  <span className={`absolute left-0 top-1.5 w-2 h-2 rounded-full ${ROLE_STYLE[m.role]?.dot || "bg-fg-4"}`} />
                  {i < meeting.length - 1 && <span className="absolute left-[3.5px] top-4 bottom-[-12px] w-px bg-line" />}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-fg">{ROLE_STYLE[m.role]?.label || m.agent}</span>
                    <span className="font-mono text-[10px] text-fg-4">
                      {shortModel(m.model)}
                      {m.durationMs ? ` · ${Math.max(1, Math.round(m.durationMs / 1000))} dtk` : ""}
                    </span>
                  </div>
                  <p className="text-xs text-fg-3 leading-relaxed mt-0.5">{m.note}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Peringatan yang diukur mesin (bukan klaim model) */}
      {site.warnings && site.warnings.length > 0 && (
        <div className="mx-2.5 mb-2 rounded-xl border border-glow/30 bg-glow-wash/60 px-3 py-2 flex gap-2 text-xs text-fg-2 leading-relaxed">
          <AlertTriangle className="w-3.5 h-3.5 text-glow shrink-0 mt-0.5" />
          <ul className="space-y-1 min-w-0">
            {site.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Aksi: preview membuka panel dari kanan */}
      <div className="px-3.5 pb-3.5 flex flex-wrap items-center gap-2">
        <Btn size="xs" onClick={() => openStudio("preview")} icon={<Eye className="w-[0.9em] h-[0.9em]" strokeWidth={1.75} />}>
          Preview
        </Btn>
        <Btn size="xs" variant="outline" onClick={() => openStudio("code")} icon={<Code2 className="w-[0.85em] h-[0.85em]" strokeWidth={1.75} />}>
          Struktur & kode
        </Btn>
        <button
          type="button"
          onClick={download}
          title="Unduh .html"
          aria-label="Unduh .html"
          className="icon-btn ml-auto"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
