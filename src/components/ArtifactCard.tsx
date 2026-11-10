"use client";

import React, { useState } from "react";
import { ArtifactItem, ArtifactFile, InvoiceData, SpreadsheetData, SlideDeckData, WebPreviewData } from "@/lib/types";
import { exportToPptxFile, renderSlideDeckToVideo } from "@/lib/claudeSkills";
import { documentHtml, invoiceHtml, letterHtml, openPrintWindow, toCsv } from "@/lib/claudeSkills/documentRender";
import { downloadDocx, downloadLetterDocx } from "@/lib/claudeSkills/docxExport";
import { getTheme } from "@/lib/claudeSkills/themes";
import { downloadXlsx } from "@/lib/claudeSkills/xlsxExport";
import { SlideView } from "./SlideView";
import { WebsiteCard } from "./WebsiteCard";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  Check,
  Copy,
  Code2,
  Table,
  Presentation,
  Receipt,
  Layout,
  ChevronLeft,
  ChevronRight,
  Printer,
  Film,
  Play,
  RotateCcw,
  Sparkles,
  Loader2,
  Maximize2,
  X,
  Layers,
  Bot,
  CheckCircle2,
  ExternalLink,
  Atom,
} from "lucide-react";

interface ArtifactCardProps {
  artifact: ArtifactItem;
}

/** PDF asli dari server (Chrome headless); gagal -> jendela cetak browser. */
async function downloadPdf(html: string, name: string, fallback: string) {
  try {
    const res = await fetch("/api/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html, filename: name }) });
    if (!res.ok) throw new Error(String(res.status));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await res.blob());
    a.download = `${name.replace(/[^\w\- ]+/g, "").trim() || "dokumen"}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch {
    openPrintWindow(fallback);
  }
}

export function ArtifactCard({ artifact }: ArtifactCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedFile, setSelectedFile] = useState<ArtifactFile | null>(
    artifact.files && artifact.files.length > 0 ? artifact.files[0] : null
  );
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // PPT Video Export & Presentation State
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [showPresentationModal, setShowPresentationModal] = useState(false);
  const [isPlayingSlideshow, setIsPlayingSlideshow] = useState(false);

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = (spreadsheet: SpreadsheetData) => {
    downloadFile(
      spreadsheet.filename || `${spreadsheet.title}.csv`,
      toCsv(spreadsheet.headers, spreadsheet.rows),
      "text/csv;charset=utf-8;"
    );
  };

  const renderFileBadge = (file: ArtifactFile) => {
    const ext = file.type || file.name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "tsx":
      case "jsx":
        return (
          <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-lagoon bg-lagoon-wash border border-lagoon/40 rounded-md">
            <Atom className="w-3 h-3" />
          </span>
        );
      case "ts":
      case "js":
        return (
          <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-lagoon bg-lagoon-wash border border-lagoon/40 rounded-md font-mono">
            TS
          </span>
        );
      case "py":
        return (
          <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-glow bg-glow-wash border border-glow/40 rounded-md font-mono">
            PY
          </span>
        );
      case "pdf":
        return (
          <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-danger bg-danger-wash border border-danger/40 rounded-md font-mono">
            PDF
          </span>
        );
      default:
        return (
          <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-fg-2 bg-hover border border-line-strong rounded-md font-mono">
            {"{ }"}
          </span>
        );
    }
  };

  // =========================================================================
  // 0. WEBSITE (hasil code agent)
  // =========================================================================
  if (artifact.type === "website" && artifact.website) {
    return <WebsiteCard artifact={artifact} />;
  }

  // =========================================================================
  // 1. INVOICE ARTIFACT
  // =========================================================================
  if (artifact.type === "invoice" && artifact.invoice) {
    const inv = artifact.invoice;
    const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: inv.currency || "IDR", maximumFractionDigits: 0 });
    return (
      <div className="w-full max-w-full min-w-0 rounded-2xl border border-line bg-raised overflow-hidden shadow-[0_16px_40px_-30px_rgba(0,0,0,0.8)]">
        <div className="px-3.5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: inv.accent || "var(--accent)" }}>
              <Receipt className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-fg truncate">{inv.clientName}</div>
              <div className="text-[11px] text-fg-3 font-mono truncate">
                {inv.invoiceNumber} · gaya {inv.style || "modern"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div className="text-right mr-1">
              <div className="text-[10px] uppercase tracking-[0.14em] text-fg-4 font-mono">Total</div>
              <div className="font-display font-bold text-fg">{fmt.format(inv.totalAmount)}</div>
            </div>
            <button
              onClick={() => downloadPdf(invoiceHtml(inv), `Invoice ${inv.invoiceNumber}`, invoiceHtml(inv, true))}
              className="px-3 py-1.5 bg-accent hover:bg-accent-hi text-on-accent rounded-full flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
        </div>
        <div className="mx-2.5 mb-2.5 rounded-xl overflow-hidden border border-line bg-white">
          <iframe srcDoc={invoiceHtml(inv)} title={`Invoice ${inv.invoiceNumber}`} sandbox="" className="w-full h-[300px] border-0 pointer-events-none" />
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. SPREADSHEET / EXCEL ARTIFACT
  // =========================================================================
  if (artifact.type === "spreadsheet" && artifact.spreadsheet) {
    const sheet = artifact.spreadsheet;
    return (
      <div className="w-full my-3 bg-raised border border-line-strong rounded-lg p-3.5 shadow-md text-xs">
        <div className="flex items-center justify-between pb-2.5 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-moss-wash border border-moss/50 flex items-center justify-center text-moss">
              <Table className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-sm text-fg">{sheet.title}</div>
              <div className="text-[11px] text-fg-3 font-mono">
                {sheet.rows.length} baris · .xlsx / CSV
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => downloadXlsx(sheet)}
              className="px-3 py-1.5 bg-moss hover:bg-moss text-on-accent rounded-lg flex items-center gap-1.5 font-medium transition-colors font-mono shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel .xlsx</span>
            </button>
            <button onClick={() => handleDownloadCsv(sheet)} className="px-2.5 py-1.5 rounded-lg text-fg-2 hover:bg-hover font-mono">
              CSV
            </button>
          </div>
        </div>

        {/* Spreadsheet Data preview */}
        <div className="mt-3 overflow-x-auto max-h-52 scrollbar-thin">
          <table className="w-full text-left font-mono border-collapse">
            <thead>
              <tr className="bg-raised text-fg-2 border-b border-line">
                {sheet.headers.map((h, i) => (
                  <th key={i} className="py-2 px-3 text-[11px] font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-fg">
              {sheet.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-hover transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="py-1.5 px-3 whitespace-nowrap">
                      {typeof cell === "number" ? cell.toLocaleString("id-ID") : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SWARM BUILD / MULTI-AGENT COMPONENT PIPELINE ARTIFACT
  // =========================================================================
  if (artifact.type === "swarm_build" && artifact.swarmPipeline) {
    const pipeline = artifact.swarmPipeline;

    return (
      <div className="w-full my-3 bg-raised border border-line-strong rounded-lg p-4 shadow-xl text-xs space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-hover border border-lagoon/50 flex items-center justify-center text-lagoon">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm text-fg font-mono flex items-center gap-2">
                <span>SWARM BUILD PIPELINE</span>
                <span className="text-[10px] px-2 py-0.5 bg-moss-wash text-moss border border-moss rounded-md">
                  ASSEMBLED
                </span>
              </div>
              <div className="text-[11px] text-fg-3 font-mono">
                Project: <span className="text-lagoon font-bold">{pipeline.projectName}</span> · Target: <span className="text-accent font-bold">{pipeline.targetPage}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={pipeline.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-accent hover:bg-accent-hi text-on-accent rounded-lg flex items-center gap-1.5 font-mono text-xs font-semibold transition-colors shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Preview Halaman</span>
            </a>
          </div>
        </div>

        {/* Progress Metrics Bar */}
        <div className="p-2.5 bg-raised border border-line-strong rounded-lg flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-lagoon" />
            <span className="text-fg">
              Swarm Workers: <strong className="text-fg">{pipeline.completedComponents}/{pipeline.totalComponents} Items Selesai</strong>
            </span>
          </div>
          <span className="text-moss font-bold">100% COMPLETE</span>
        </div>

        {/* Component Items List */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-fg-3 px-1">
            Komponen Yang Dikerjakan Swarm:
          </div>
          {pipeline.components.map((comp, idx) => (
            <div
              key={idx}
              className="p-2.5 bg-raised border border-line hover:border-lagoon/50 rounded-lg flex items-center justify-between gap-3 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-moss shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-fg font-mono truncate">
                    {comp.name}
                  </div>
                  <div className="text-[11px] text-fg-3 font-sans truncate">
                    {comp.description}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                <span className="text-lagoon bg-lagoon-wash border border-line-strong px-1.5 py-0.5 rounded-md text-[10px]">
                  {comp.role}
                </span>
                <span className="text-moss">+{comp.linesOfCode} lines</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Export Slides to Animated Video (.webm) via Claude Video Animator Engine
  const handleExportVideo = async (deck: SlideDeckData) => {
    if (typeof window === "undefined") return;
    setIsExportingVideo(true);
    setVideoProgress(5);

    try {
      const blob = await renderSlideDeckToVideo(deck, {
        fps: 30,
        slideDurationSec: 3.5,
        onProgress: (pct) => setVideoProgress(pct),
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deck.deckTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}_Presentation.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setVideoProgress(100);
    } catch (err) {
      console.error("Video export error:", err);
      alert("Gagal mengekspor video. Pastikan browser mendukung MediaRecorder API.");
    } finally {
      setIsExportingVideo(false);
    }
  };

  // Export Slides to native PowerPoint (.pptx) via Claude PPTX Skill (pptxgenjs)
  const handleExportPptx = async (deck: SlideDeckData) => {
    if (typeof window === "undefined") return;
    setIsExportingPptx(true);
    try {
      await exportToPptxFile(deck);
    } catch (err) {
      console.error("PPTX export error:", err);
      alert("Gagal membuat file PowerPoint (.pptx).");
    } finally {
      setIsExportingPptx(false);
    }
  };

  // =========================================================================
  // 3. SLIDES / PRESENTATION ARTIFACT (Enhanced Video & Animation)
  // =========================================================================
  if (artifact.type === "slides" && artifact.slides) {
    const deck = artifact.slides;
    const currentSlide = deck.slides[currentSlideIndex] || deck.slides[0];

    return (
      <div className="w-full my-3 bg-raised border border-line-strong rounded-lg p-4 shadow-md text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-line gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-glow-wash border border-glow/50 flex items-center justify-center text-glow shrink-0">
              <Presentation className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm text-fg truncate font-mono">
                {deck.deckTitle}
              </div>
              <div className="text-[11px] text-fg-3 font-mono flex items-center gap-1.5">
                <span>Slide {currentSlideIndex + 1} dari {deck.slides.length}</span>
                <span>•</span>
                <span className="text-lagoon">Tema {getTheme(deck.theme).name}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {/* Download Native PowerPoint .PPTX Button */}
            <button
              type="button"
              onClick={() => handleExportPptx(deck)}
              disabled={isExportingPptx}
              title="Unduh file Microsoft PowerPoint asli (.pptx)"
              className="px-2.5 py-1 text-xs font-mono bg-raised hover:bg-accent-wash border border-accent/50 text-accent-hi rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isExportingPptx ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                  <span>Menyimpan .PPTX...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-accent" />
                  <span>Unduh .PPTX</span>
                </>
              )}
            </button>

            {/* Export to Animated Video Button */}
            <button
              type="button"
              onClick={() => handleExportVideo(deck)}
              disabled={isExportingVideo}
              title="Render slide presentasi menjadi video animasi (.webm)"
              className="px-2.5 py-1 text-xs font-mono bg-raised hover:bg-hover border border-lagoon/50 text-lagoon rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isExportingVideo ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-lagoon" />
                  <span>Render Video {videoProgress}%...</span>
                </>
              ) : (
                <>
                  <Film className="w-3.5 h-3.5 text-lagoon" />
                  <span>Export Video</span>
                </>
              )}
            </button>

            {/* Present Fullscreen Mode */}
            <button
              type="button"
              onClick={() => setShowPresentationModal(true)}
              title="Putar presentasi dalam mode layar penuh / animasi"
              className="px-2.5 py-1 text-xs font-mono bg-accent hover:bg-accent-hi text-on-accent rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer font-medium shadow-xs"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Presentasi</span>
            </button>

            <div className="flex items-center gap-1 ml-1 border-l border-line-strong pl-2">
              <button
                onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentSlideIndex === 0}
                className="p-1 bg-raised hover:bg-hover disabled:opacity-40 text-fg-2 rounded-md border border-line-strong transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-xs px-1.5 text-fg-2">
                {currentSlideIndex + 1}/{deck.slides.length}
              </span>
              <button
                onClick={() =>
                  setCurrentSlideIndex((prev) => Math.min(deck.slides.length - 1, prev + 1))
                }
                disabled={currentSlideIndex === deck.slides.length - 1}
                className="p-1 bg-raised hover:bg-hover disabled:opacity-40 text-fg-2 rounded-md border border-line-strong transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Slide aktif */}
        <div className="mt-3 rounded-xl overflow-hidden border border-line shadow-[0_12px_30px_-24px_rgba(0,0,0,0.9)]">
          <SlideView
            key={currentSlideIndex}
            slide={currentSlide}
            themeId={deck.theme}
            index={currentSlideIndex}
            total={deck.slides.length}
            deckTitle={deck.deckTitle}
            animate
          />
        </div>

        {/* Thumbnail semua slide */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {deck.slides.map((sl, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlideIndex(i)}
              aria-label={`Slide ${i + 1}`}
              className={`shrink-0 w-16 rounded-md overflow-hidden border-2 transition-all cursor-pointer ${
                i === currentSlideIndex ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <div className="pointer-events-none">
                <SlideView slide={sl} themeId={deck.theme} index={i} total={deck.slides.length} deckTitle={deck.deckTitle} />
              </div>
            </button>
          ))}
        </div>

        {currentSlide.speakerNotes && (
          <div className="mt-2 px-3 py-2 rounded-xl bg-base text-[12px] text-fg-3 leading-relaxed">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-4 mr-2">Catatan presenter</span>
            {currentSlide.speakerNotes}
          </div>
        )}

        {/* Fullscreen Presentation Modal */}
        {showPresentationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-4 sm:p-8 backdrop-blur-md animate-rise">
            <div className="w-full max-w-6xl bg-raised border border-line-strong rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[94vh]">
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between px-5 py-3 bg-raised border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-accent" />
                  <span className="font-mono text-xs font-bold text-fg tracking-wider uppercase">
                    {deck.deckTitle}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-fg-3">
                    Slide {currentSlideIndex + 1} dari {deck.slides.length}
                  </span>
                  <button
                    onClick={() => setShowPresentationModal(false)}
                    className="p-1 hover:bg-hover text-fg-3 hover:text-fg rounded-md transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Slide 16:9 */}
              <div className="flex-1 flex items-center justify-center bg-scrim/5 p-3 sm:p-5 overflow-hidden">
                <div className="w-full max-w-[min(100%,calc((90vh-140px)*16/9))] rounded-lg overflow-hidden shadow-2xl">
                  <SlideView
                    key={`p-${currentSlideIndex}`}
                    slide={currentSlide}
                    themeId={deck.theme}
                    index={currentSlideIndex}
                    total={deck.slides.length}
                    deckTitle={deck.deckTitle}
                    animate
                  />
                </div>
              </div>

              {/* Modal Bottom Navigator */}
              <div className="flex items-center justify-between px-5 py-3 bg-raised border-t border-line flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportPptx(deck)}
                    disabled={isExportingPptx}
                    className="px-3 py-1.5 text-xs font-mono bg-raised hover:bg-accent-wash border border-accent/50 text-accent-hi rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-accent" />
                    <span>{isExportingPptx ? "Menyimpan .PPTX..." : "Unduh .PPTX"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportVideo(deck)}
                    disabled={isExportingVideo}
                    className="px-3 py-1.5 text-xs font-mono bg-raised hover:bg-hover border border-lagoon/50 text-lagoon rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>{isExportingVideo ? `Rendering Video ${videoProgress}%...` : "Export ke Video MP4/WebM"}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentSlideIndex === 0}
                    className="px-3 py-1.5 text-xs font-mono bg-raised hover:bg-hover disabled:opacity-40 text-fg rounded-lg border border-line-strong transition-colors cursor-pointer"
                  >
                    Sebelumnya
                  </button>
                  <button
                    onClick={() =>
                      setCurrentSlideIndex((prev) => Math.min(deck.slides.length - 1, prev + 1))
                    }
                    disabled={currentSlideIndex === deck.slides.length - 1}
                    className="px-4 py-1.5 text-xs font-mono bg-accent hover:bg-accent-hi text-on-accent rounded-lg transition-colors cursor-pointer font-semibold shadow-xs"
                  >
                    Selanjutnya &rarr;
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 4. WEB COMPONENT / SANDBOX PREVIEW
  // =========================================================================
  if (artifact.type === "video" && artifact.video) {
    const v = artifact.video;
    return (
      <div className="w-full max-w-full min-w-0 rounded-2xl border border-line bg-raised overflow-hidden">
        <div className="px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center shrink-0">
              <Film className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-fg truncate text-sm">{artifact.title}</div>
              <div className="text-[11px] text-fg-3 font-mono">{Math.round(v.seconds)} detik{v.scenes ? ` · ${v.scenes} adegan` : ""} · .webm</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {v.recorded && (
              <a href={v.url} download={`${artifact.title.replace(/[^\w\- ]+/g, "").trim() || "video"}.webm`} className="px-3 py-1.5 bg-accent hover:bg-accent-hi text-on-accent rounded-full flex items-center gap-1.5 text-xs font-medium">
                <Download className="w-3.5 h-3.5" /> Unduh
              </a>
            )}
            <a href={v.htmlUrl} target="_blank" rel="noopener" className="px-2.5 py-1.5 rounded-full text-xs text-fg-2 hover:bg-hover flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5" /> Animasi HTML
            </a>
          </div>
        </div>
        {v.recorded ? (
          <video src={v.url} controls playsInline preload="metadata" className="w-full aspect-video max-h-72 bg-black" />
        ) : (
          <div className="mx-2.5 mb-2.5 px-3 py-2 rounded-xl bg-base text-[12px] text-fg-3">{v.note}</div>
        )}
      </div>
    );
  }

  if (artifact.type === "web_preview" && artifact.webPreview) {
    return (
      <div className="w-full my-3 bg-raised border border-line-strong rounded-lg p-3.5 shadow-md text-xs">
        <div className="flex items-center justify-between pb-2.5 border-b border-line">
          <div className="flex items-center gap-2">
            <Layout className="w-4 h-4 text-lagoon" />
            <span className="font-semibold text-sm text-fg">
              {artifact.webPreview.title || "Live Web Component Sandbox"}
            </span>
          </div>
          <span className="text-[10px] text-moss bg-moss-wash px-2 py-0.5 rounded-md border border-moss/30 font-mono">
            SANDBOX ACTIVE
          </span>
        </div>

        <div className="mt-3 border border-line rounded-lg overflow-hidden bg-raised">
          <iframe
            srcDoc={artifact.webPreview.html}
            title="Preview"
            sandbox="allow-scripts"
            className="w-full h-64 border-none pointer-events-none"
          />
        </div>
      </div>
    );
  }

  // =========================================================================
  // 5. PDF DOCUMENT ARTIFACT (Enhanced)
  // =========================================================================
  if (artifact.type === "pdf_document") {
    const title = artifact.title || artifact.pdfTitle || "Dokumen";
    const content = artifact.pdfContent || artifact.summary || "";
    const docProps = { title, subtitle: artifact.summary, markdown: content, theme: artifact.docTheme };
    const letter = artifact.letter;
    const htmlOf = (print = false) => (letter ? letterHtml(letter, print) : documentHtml(docProps, print));
    return (
      <div className="w-full max-w-full min-w-0 rounded-2xl border border-line bg-raised overflow-hidden shadow-[0_16px_40px_-30px_rgba(0,0,0,0.8)]">
        <div className="px-3.5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-danger-wash text-danger flex items-center justify-center shrink-0">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-fg truncate">{title}</div>
              <div className="text-[11px] text-fg-3 font-mono">
                {letter ? `Surat ${letter.kind}${letter.kop ? " berkop" : ""} · 1 halaman` : `±${artifact.pdfPages || 1} halaman · tema ${getTheme(artifact.docTheme).name}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <button
              onClick={() => setShowModal(true)}
              className="px-2.5 py-1.5 rounded-full text-xs text-fg-2 hover:bg-hover flex items-center gap-1.5 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Baca penuh
            </button>
            <button
              onClick={() => void (letter ? downloadLetterDocx(letter) : downloadDocx(docProps))}
              className="px-2.5 py-1.5 rounded-full text-xs text-fg-2 hover:bg-hover flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh .DOCX
            </button>
            <button
              onClick={() => downloadPdf(htmlOf(), title, htmlOf(true))}
              className="px-3 py-1.5 bg-accent hover:bg-accent-hi text-on-accent rounded-full flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
        </div>
        <div className="mx-2.5 mb-2.5 rounded-xl overflow-hidden border border-line bg-white">
          <iframe srcDoc={htmlOf()} title={title} sandbox="" className="w-full h-[280px] border-0 pointer-events-none" />
        </div>

        {showModal && (
          <div className="fixed inset-0 z-[60] bg-scrim/70 backdrop-blur-sm p-3 sm:p-8 flex flex-col animate-rise" onClick={() => setShowModal(false)}>
            <div className="flex items-center justify-between pb-2 text-white">
              <span className="font-display font-bold truncate">{title}</span>
              <button onClick={() => setShowModal(false)} aria-label="Tutup" className="p-2 rounded-full hover:bg-white/15 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 max-w-4xl w-full mx-auto rounded-2xl overflow-hidden bg-white" onClick={(e) => e.stopPropagation()}>
              <iframe srcDoc={htmlOf()} title={title} sandbox="" className="w-full h-full border-0" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 6. CODE DIFF ARTIFACT (Matches User Image Exactly)
  // =========================================================================
  const totalAdditions =
    artifact.totalAdditions ??
    artifact.files?.reduce((acc, f) => acc + (f.additions || 0), 0) ??
    0;

  const totalDeletions =
    artifact.totalDeletions ??
    artifact.files?.reduce((acc, f) => acc + (f.deletions || 0), 0) ??
    0;

  return (
    <div className="w-full my-3 bg-raised border border-line rounded-lg overflow-hidden shadow-lg text-fg">
      {/* Top Header bar */}
      <div className="px-3 py-2 flex items-center justify-between bg-raised border-b border-line gap-2 flex-wrap">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 cursor-pointer select-none group min-w-0"
        >
          <span className="text-xs font-semibold text-fg truncate">
            {artifact.files?.length || 0} files changed
          </span>
          <span className="text-xs font-mono font-medium shrink-0">
            <span className="text-moss">+{totalAdditions}</span>{" "}
            <span className="text-danger">-{totalDeletions}</span>
          </span>
          <span className="text-fg-3 group-hover:text-fg transition-colors shrink-0">
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-2 py-1 text-xs font-mono bg-raised hover:bg-hover text-fg hover:text-fg border border-line-strong rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer shrink-0"
        >
          <Code2 className="w-3.5 h-3.5 text-accent" />
          <span>Review</span>
        </button>
      </div>

      {/* Files List */}
      {isExpanded && artifact.files && (
        <div className="divide-y divide-line">
          {artifact.files.map((file, idx) => {
            const isSelected = selectedFile?.name === file.name;
            return (
              <div
                key={idx}
                onClick={() => setSelectedFile(isSelected ? null : file)}
                className={`px-3 py-2 flex items-center justify-between text-xs cursor-pointer transition-colors gap-2 ${
                  isSelected ? "bg-hover" : "hover:bg-raised bg-raised"
                }`}
              >
                {/* Left: Badge + filename + path */}
                <div className="flex items-center gap-2 min-w-0 truncate">
                  {renderFileBadge(file)}
                  <span className="font-mono font-semibold text-fg truncate text-xs">
                    {file.name}
                  </span>
                  <span className="font-mono text-fg-3 text-[11px] truncate hidden md:inline">
                    {file.path}
                  </span>
                </div>

                {/* Right: +Add -Del count */}
                <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
                  <span className="text-moss">+{file.additions}</span>
                  <span className="text-danger">-{file.deletions}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Expanded Code Diff Viewer for selected file */}
      {isExpanded && selectedFile && selectedFile.content && (
        <div className="p-3 bg-base border-t border-line overflow-hidden">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-line text-xs font-mono gap-2 flex-wrap">
            <span className="text-fg-2 flex items-center gap-1.5 min-w-0 truncate">
              <span className="text-accent shrink-0">FILE:</span>
              <span className="truncate">{selectedFile.path}</span>
            </span>
            <button
              onClick={() => handleCopyText(selectedFile.content || "")}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] bg-raised hover:bg-hover text-fg border border-line-strong rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-moss" /> Tersalin
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Salin Kode
                </>
              )}
            </button>
          </div>

          <pre className="p-3 bg-raised border border-line rounded-lg text-xs font-mono text-fg overflow-x-auto max-h-64 scrollbar-thin leading-relaxed select-text min-w-0">
            <code>{selectedFile.content}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
