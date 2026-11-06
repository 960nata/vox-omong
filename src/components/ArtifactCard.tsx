"use client";

import React, { useState } from "react";
import { ArtifactItem, ArtifactFile, InvoiceData, SpreadsheetData, SlideDeckData, WebPreviewData } from "@/lib/types";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
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
} from "lucide-react";

interface ArtifactCardProps {
  artifact: ArtifactItem;
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
    const csvRows = [
      spreadsheet.headers.join(","),
      ...spreadsheet.rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ];
    downloadFile(spreadsheet.filename || `${spreadsheet.title}.csv`, csvRows.join("\n"), "text/csv;charset=utf-8;");
  };

  const handlePrintDocument = (title: string, htmlContent: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; padding: 40px; color: #111; max-width: 800px; margin: 0 auto; }
            h1 { border-bottom: 2px solid #ea580c; padding-bottom: 10px; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
            th { background-color: #f1f5f9; color: #334155; }
            .total-row { font-weight: bold; background-color: #f8fafc; }
            .header-info { color: #64748b; font-size: 13px; margin-bottom: 20px; }
            .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 12px; color: #94a3b8; text-align: right; }
          </style>
        </head>
        <body>
          ${htmlContent}
          <div class="footer">VOX·AI Acoustic Agent Document Engine</div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const renderFileBadge = (file: ArtifactFile) => {
    const ext = file.type || file.name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "tsx":
      case "jsx":
        return (
          <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-[#38bdf8] bg-[#0c2233] border border-[#0284c7]/40 rounded-[2px]">
            ⚛️
          </span>
        );
      case "ts":
      case "js":
        return (
          <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-[#38bdf8] bg-[#0d2338] border border-[#0284c7]/40 rounded-[2px] font-mono">
            TS
          </span>
        );
      case "py":
        return (
          <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-[#facc15] bg-[#2a2410] border border-[#ca8a04]/40 rounded-[2px] font-mono">
            PY
          </span>
        );
      case "pdf":
        return (
          <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-[#f87171] bg-[#2b1616] border border-[#dc2626]/40 rounded-[2px] font-mono">
            PDF
          </span>
        );
      default:
        return (
          <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-[#94a3b8] bg-[#1e232d] border border-[#334155] rounded-[2px] font-mono">
            {"{ }"}
          </span>
        );
    }
  };

  // =========================================================================
  // 1. INVOICE ARTIFACT
  // =========================================================================
  if (artifact.type === "invoice" && artifact.invoice) {
    const inv = artifact.invoice;
    const invoiceHtml = `
      <h1>INVOICE ${inv.invoiceNumber}</h1>
      <div class="header-info">
        <p><strong>Dari:</strong> ${inv.companyName} (${inv.companyAddress})</p>
        <p><strong>Kepada:</strong> ${inv.clientName} (${inv.clientAddress})</p>
        <p><strong>Tanggal:</strong> ${inv.date} | <strong>Jatuh Tempo:</strong> ${inv.dueDate}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Deskripsi</th>
            <th>Qty</th>
            <th>Harga Satuan</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${inv.items
            .map(
              (item) => `
            <tr>
              <td>${item.description}</td>
              <td>${item.quantity}</td>
              <td>${inv.currency} ${item.unitPrice.toLocaleString("id-ID")}</td>
              <td>${inv.currency} ${item.total.toLocaleString("id-ID")}</td>
            </tr>
          `
            )
            .join("")}
          <tr class="total-row">
            <td colspan="3" style="text-align: right;">Subtotal:</td>
            <td>${inv.currency} ${inv.subtotal.toLocaleString("id-ID")}</td>
          </tr>
          <tr class="total-row">
            <td colspan="3" style="text-align: right;">Pajak (${inv.taxRate}%):</td>
            <td>${inv.currency} ${inv.taxAmount.toLocaleString("id-ID")}</td>
          </tr>
          <tr class="total-row" style="font-size: 16px; color: #ea580c;">
            <td colspan="3" style="text-align: right;">Total Bayar:</td>
            <td>${inv.currency} ${inv.totalAmount.toLocaleString("id-ID")}</td>
          </tr>
        </tbody>
      </table>
      ${inv.notes ? `<p style="margin-top: 25px; font-size: 13px; color: #64748b;"><strong>Catatan:</strong> ${inv.notes}</p>` : ""}
    `;

    return (
      <div className="w-full my-3 bg-[#13151b] border border-[#2b3140] rounded-[3px] p-4 shadow-md text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#232835]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[3px] bg-[#291b16] border border-[#ea580c]/50 flex items-center justify-center text-[#ea580c]">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-sm text-[#f3f4f6]">
                Invoice #{inv.invoiceNumber}
              </div>
              <div className="text-[11px] text-[#788195]">
                {inv.clientName} · Jatuh Tempo: {inv.dueDate}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrintDocument(`Invoice-${inv.invoiceNumber}`, invoiceHtml)}
              className="px-3 py-1.5 bg-[#ea580c] hover:bg-[#f97316] text-white rounded-[3px] flex items-center gap-1.5 font-medium transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / Unduh PDF</span>
            </button>
          </div>
        </div>

        {/* Invoice Items summary table */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left font-mono">
            <thead>
              <tr className="text-[11px] text-[#717b8f] border-b border-[#1e232e]">
                <th className="py-1.5">Deskripsi</th>
                <th className="py-1.5 text-center">Qty</th>
                <th className="py-1.5 text-right">Harga</th>
                <th className="py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e232e] text-[#d1d5db]">
              {inv.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-1.5 font-sans">{item.description}</td>
                  <td className="py-1.5 text-center">{item.quantity}</td>
                  <td className="py-1.5 text-right">
                    {inv.currency} {item.unitPrice.toLocaleString("id-ID")}
                  </td>
                  <td className="py-1.5 text-right">
                    {inv.currency} {item.total.toLocaleString("id-ID")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 pt-3 border-t border-[#232835] flex justify-between items-center text-xs">
          <span className="text-[#8892a4]">Status: Siap Ditagihkan</span>
          <div className="text-right">
            <span className="text-[#8892a4] mr-2">Total Akhir:</span>
            <span className="text-base font-bold text-[#f97316] font-mono">
              {inv.currency} {inv.totalAmount.toLocaleString("id-ID")}
            </span>
          </div>
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
      <div className="w-full my-3 bg-[#13151b] border border-[#2b3140] rounded-[3px] p-3.5 shadow-md text-xs">
        <div className="flex items-center justify-between pb-2.5 border-b border-[#232835]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[3px] bg-[#16271c] border border-[#10b981]/50 flex items-center justify-center text-[#10b981]">
              <Table className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-sm text-[#f3f4f6]">{sheet.title}</div>
              <div className="text-[11px] text-[#788195] font-mono">
                {sheet.rows.length} Baris Data · Excel / CSV
              </div>
            </div>
          </div>

          <button
            onClick={() => handleDownloadCsv(sheet)}
            className="px-3 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-[3px] flex items-center gap-1.5 font-medium transition-colors font-mono shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh CSV / Excel</span>
          </button>
        </div>

        {/* Spreadsheet Data preview */}
        <div className="mt-3 overflow-x-auto max-h-52 scrollbar-thin">
          <table className="w-full text-left font-mono border-collapse">
            <thead>
              <tr className="bg-[#181b24] text-[#a1a8b8] border-b border-[#242a38]">
                {sheet.headers.map((h, i) => (
                  <th key={i} className="py-2 px-3 text-[11px] font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e232e] text-[#d1d5db]">
              {sheet.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-[#1a1d26] transition-colors">
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

  // Export Slides to Animated Video (.webm / MP4) via Canvas & MediaRecorder
  const handleExportVideo = async (deck: SlideDeckData) => {
    if (typeof window === "undefined") return;
    setIsExportingVideo(true);
    setVideoProgress(5);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context is not available");

      const stream = canvas.captureStream(30);
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
      } catch {
        recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      }

      const recordedChunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${deck.deckTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}_Presentation.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsExportingVideo(false);
        setVideoProgress(100);
      };

      recorder.start();

      const totalSlides = deck.slides.length;
      const fps = 30;
      const slideDurationSec = 3.5;
      const totalFramesPerSlide = Math.floor(fps * slideDurationSec);

      for (let sIdx = 0; sIdx < totalSlides; sIdx++) {
        const slide = deck.slides[sIdx];

        for (let frame = 0; frame < totalFramesPerSlide; frame++) {
          const progressInSlide = frame / totalFramesPerSlide;

          // 1. Cyber dark studio gradient
          const grad = ctx.createLinearGradient(0, 0, 1280, 720);
          grad.addColorStop(0, "#0a0c10");
          grad.addColorStop(0.5, "#131622");
          grad.addColorStop(1, "#090b0e");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 1280, 720);

          // Grid lines
          ctx.strokeStyle = "rgba(43, 51, 69, 0.25)";
          ctx.lineWidth = 1;
          for (let x = 0; x < 1280; x += 80) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 720);
            ctx.stroke();
          }
          for (let y = 0; y < 720; y += 60) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(1280, y);
            ctx.stroke();
          }

          // Top Header Accent
          ctx.fillStyle = "#ea580c";
          ctx.fillRect(80, 65, 8, 42);

          ctx.font = "bold 16px 'Courier New', monospace";
          ctx.fillStyle = "#ea580c";
          ctx.fillText("VOX·AI PRESENTATION STUDIO", 100, 82);

          ctx.font = "14px 'Courier New', monospace";
          ctx.fillStyle = "#717d96";
          ctx.fillText(`SLIDE ${sIdx + 1} OF ${totalSlides}`, 100, 102);

          // Slide Title
          const titleAlpha = Math.min(1, frame / 12);
          ctx.globalAlpha = titleAlpha;
          ctx.font = "bold 38px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.fillStyle = "#f8fafc";
          ctx.fillText(slide.title, 80, 185);
          ctx.globalAlpha = 1;

          // Divider
          ctx.strokeStyle = "#273042";
          ctx.beginPath();
          ctx.moveTo(80, 215);
          ctx.lineTo(1200, 215);
          ctx.stroke();

          // Bullets Cascade
          slide.bullets.forEach((bullet, bIdx) => {
            const bulletDelayFrame = 12 + bIdx * 18;
            if (frame >= bulletDelayFrame) {
              const bAlpha = Math.min(1, (frame - bulletDelayFrame) / 12);
              ctx.globalAlpha = bAlpha;

              ctx.fillStyle = "#38bdf8";
              ctx.beginPath();
              ctx.arc(95, 280 + bIdx * 65, 6, 0, Math.PI * 2);
              ctx.fill();

              ctx.font = "22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
              ctx.fillStyle = "#cbd5e1";
              ctx.fillText(bullet, 120, 288 + bIdx * 65);
              ctx.globalAlpha = 1;
            }
          });

          // Speaker Notes at bottom
          if (slide.speakerNotes) {
            ctx.fillStyle = "rgba(20, 24, 34, 0.85)";
            ctx.fillRect(80, 595, 1120, 55);
            ctx.strokeStyle = "#2e3748";
            ctx.strokeRect(80, 595, 1120, 55);

            ctx.font = "italic 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            ctx.fillStyle = "#94a3b8";
            ctx.fillText(`Presenter Note: ${slide.speakerNotes}`, 100, 628);
          }

          // Progress Bar
          const overallProgress = (sIdx + progressInSlide) / totalSlides;
          ctx.fillStyle = "#ea580c";
          ctx.fillRect(0, 712, 1280 * overallProgress, 8);

          await new Promise((r) => setTimeout(r, 1000 / fps));
        }

        setVideoProgress(Math.round(((sIdx + 1) / totalSlides) * 100));
      }

      recorder.stop();
    } catch (err) {
      console.error("Video export error:", err);
      alert("Gagal mengekspor video. Pastikan browser mendukung MediaRecorder API.");
      setIsExportingVideo(false);
    }
  };

  // =========================================================================
  // 3. SLIDES / PRESENTATION ARTIFACT (Enhanced Video & Animation)
  // =========================================================================
  if (artifact.type === "slides" && artifact.slides) {
    const deck = artifact.slides;
    const currentSlide = deck.slides[currentSlideIndex] || deck.slides[0];

    return (
      <div className="w-full my-3 bg-[#13151b] border border-[#2b3140] rounded-[3px] p-4 shadow-md text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#232835] gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-[3px] bg-[#292215] border border-[#eab308]/50 flex items-center justify-center text-[#eab308] shrink-0">
              <Presentation className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm text-[#f3f4f6] truncate font-mono">
                {deck.deckTitle}
              </div>
              <div className="text-[11px] text-[#788195] font-mono flex items-center gap-1.5">
                <span>Slide {currentSlideIndex + 1} dari {deck.slides.length}</span>
                <span>•</span>
                <span className="text-[#38bdf8]">ANIMATED DECK</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Export to Animated Video Button */}
            <button
              type="button"
              onClick={() => handleExportVideo(deck)}
              disabled={isExportingVideo}
              title="Render slide presentasi menjadi video animasi (.webm)"
              className="px-2.5 py-1 text-xs font-mono bg-[#1c2230] hover:bg-[#252f44] border border-[#38bdf8]/50 text-[#38bdf8] rounded-[3px] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isExportingVideo ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#38bdf8]" />
                  <span>Render Video {videoProgress}%...</span>
                </>
              ) : (
                <>
                  <Film className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>Export Video</span>
                </>
              )}
            </button>

            {/* Present Fullscreen Mode */}
            <button
              type="button"
              onClick={() => setShowPresentationModal(true)}
              title="Putar presentasi dalam mode layar penuh / animasi"
              className="px-2.5 py-1 text-xs font-mono bg-[#ea580c] hover:bg-[#f97316] text-white rounded-[3px] flex items-center gap-1.5 transition-colors cursor-pointer font-medium shadow-xs"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Presentasi</span>
            </button>

            <div className="flex items-center gap-1 ml-1 border-l border-[#273042] pl-2">
              <button
                onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentSlideIndex === 0}
                className="p-1 bg-[#1c202a] hover:bg-[#252b38] disabled:opacity-40 text-[#c0c6d4] rounded-[2px] border border-[#2f3647] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-xs px-1.5 text-[#9ca3af]">
                {currentSlideIndex + 1}/{deck.slides.length}
              </span>
              <button
                onClick={() =>
                  setCurrentSlideIndex((prev) => Math.min(deck.slides.length - 1, prev + 1))
                }
                disabled={currentSlideIndex === deck.slides.length - 1}
                className="p-1 bg-[#1c202a] hover:bg-[#252b38] disabled:opacity-40 text-[#c0c6d4] rounded-[2px] border border-[#2f3647] transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Current Slide Display Canvas */}
        <div className="mt-3 p-5 bg-[#0d0f14] border border-[#232834] rounded-[3px] min-h-[160px] flex flex-col justify-between shadow-inner">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1c2230]">
              <h3 className="text-base font-bold text-[#f3f4f6]">
                {currentSlide.title}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-[#171d28] border border-[#263145] text-[#38bdf8] rounded-[2px]">
                SLIDE #{currentSlide.slideNumber}
              </span>
            </div>

            <ul className="space-y-2 text-xs text-[#cbd5e1] leading-relaxed">
              {currentSlide.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ea580c] mt-1.5 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {currentSlide.speakerNotes && (
            <div className="mt-4 pt-2.5 border-t border-[#1e232e] text-[11px] text-[#788195] italic font-mono bg-[#11141c] p-2.5 rounded-[2px] border border-[#1e2433]">
              <strong className="text-[#ea580c] not-italic">Catatan Presenter:</strong> {currentSlide.speakerNotes}
            </div>
          )}
        </div>

        {/* Fullscreen Presentation Modal */}
        {showPresentationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 sm:p-8 backdrop-blur-md animate-fadeIn">
            <div className="w-full max-w-4xl bg-[#0f121a] border border-[#2e374b] rounded-[4px] shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between px-5 py-3 bg-[#151924] border-b border-[#252d3f]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-[1px] bg-[#ea580c]" />
                  <span className="font-mono text-xs font-bold text-[#f3f4f6] tracking-wider uppercase">
                    {deck.deckTitle}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#8a95aa]">
                    Slide {currentSlideIndex + 1} dari {deck.slides.length}
                  </span>
                  <button
                    onClick={() => setShowPresentationModal(false)}
                    className="p-1 hover:bg-[#252c3c] text-[#8a95aa] hover:text-white rounded-[2px] transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Slide Canvas 16:9 Display */}
              <div className="flex-1 p-8 sm:p-12 flex flex-col justify-between bg-gradient-to-br from-[#0c0e14] via-[#121622] to-[#0a0c10] min-h-[380px] overflow-y-auto">
                <div>
                  <span className="text-xs font-mono text-[#ea580c] uppercase font-bold tracking-widest block mb-2">
                    SECTION {currentSlideIndex + 1}
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-6 tracking-tight">
                    {currentSlide.title}
                  </h1>

                  <ul className="space-y-4 max-w-2xl">
                    {currentSlide.bullets.map((bullet, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 text-base text-[#d1d5db] font-sans leading-relaxed"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#38bdf8] mt-2 shrink-0" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {currentSlide.speakerNotes && (
                  <div className="mt-8 p-3.5 bg-[#141926]/80 border border-[#2b3448] rounded-[3px] text-xs font-mono text-[#94a3b8] italic">
                    <span className="text-[#ea580c] font-bold not-italic">Speaker Note:</span> {currentSlide.speakerNotes}
                  </div>
                )}
              </div>

              {/* Modal Bottom Navigator */}
              <div className="flex items-center justify-between px-5 py-3 bg-[#131722] border-t border-[#222a3b]">
                <button
                  type="button"
                  onClick={() => handleExportVideo(deck)}
                  disabled={isExportingVideo}
                  className="px-3 py-1.5 text-xs font-mono bg-[#1c2232] hover:bg-[#252d42] border border-[#38bdf8]/50 text-[#38bdf8] rounded-[3px] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>{isExportingVideo ? `Rendering Video ${videoProgress}%...` : "Export ke Video MP4/WebM"}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentSlideIndex === 0}
                    className="px-3 py-1.5 text-xs font-mono bg-[#1c2232] hover:bg-[#273045] disabled:opacity-40 text-white rounded-[3px] border border-[#2e374b] transition-colors cursor-pointer"
                  >
                    Sebelumnya
                  </button>
                  <button
                    onClick={() =>
                      setCurrentSlideIndex((prev) => Math.min(deck.slides.length - 1, prev + 1))
                    }
                    disabled={currentSlideIndex === deck.slides.length - 1}
                    className="px-4 py-1.5 text-xs font-mono bg-[#ea580c] hover:bg-[#f97316] text-white rounded-[3px] transition-colors cursor-pointer font-semibold shadow-xs"
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
  if (artifact.type === "web_preview" && artifact.webPreview) {
    return (
      <div className="w-full my-3 bg-[#13151b] border border-[#2b3140] rounded-[3px] p-3.5 shadow-md text-xs">
        <div className="flex items-center justify-between pb-2.5 border-b border-[#232835]">
          <div className="flex items-center gap-2">
            <Layout className="w-4 h-4 text-[#38bdf8]" />
            <span className="font-semibold text-sm text-[#f3f4f6]">
              {artifact.webPreview.title || "Live Web Component Sandbox"}
            </span>
          </div>
          <span className="text-[10px] text-[#10b981] bg-[#102419] px-2 py-0.5 rounded-[2px] border border-[#10b981]/30 font-mono">
            SANDBOX ACTIVE
          </span>
        </div>

        <div className="mt-3 border border-[#232835] rounded-[3px] overflow-hidden bg-white">
          <iframe
            srcDoc={artifact.webPreview.html}
            title="Preview"
            sandbox="allow-scripts"
            className="w-full h-64 border-none"
          />
        </div>
      </div>
    );
  }

  // =========================================================================
  // 5. PDF DOCUMENT ARTIFACT (Enhanced)
  // =========================================================================
  if (artifact.type === "pdf_document") {
    const title = artifact.pdfTitle || artifact.title || "Dokumen-AI";
    const content = artifact.pdfContent || artifact.summary || "Konten dokumen";

    return (
      <div className="w-full my-3 bg-[#13151b] border border-[#2b3140] rounded-[3px] p-3.5 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-[3px] bg-[#2a1717] border border-[#ef4444]/40 flex items-center justify-center text-[#ef4444] shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#f3f4f6] truncate font-mono">
                {title}
              </div>
              <div className="text-[11px] text-[#7d869a] flex items-center gap-2 mt-0.5 font-mono">
                <span>PDF DOCUMENT</span>
                <span>•</span>
                <span>{artifact.pdfPages || 1} Halaman</span>
                <span>•</span>
                <span className="text-[#10b981]">GENERATED</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowModal(true)}
              className="px-2.5 py-1.5 text-xs font-mono bg-[#1c202a] hover:bg-[#252b38] text-[#c0c6d4] hover:text-[#f3f4f6] border border-[#2f3647] rounded-[3px] flex items-center gap-1.5 transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-[#ea580c]" />
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button
              onClick={() =>
                handlePrintDocument(
                  title,
                  `<h1>${title}</h1><div class="header-info">Dibuat oleh VOX·AI Studio</div><div style="white-space: pre-wrap;">${content}</div>`
                )
              }
              className="px-3 py-1.5 text-xs font-mono bg-[#ea580c] hover:bg-[#f97316] text-white rounded-[3px] flex items-center gap-1.5 transition-colors font-medium shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        {artifact.summary && (
          <div className="mt-2.5 pt-2 border-t border-[#222734] text-xs text-[#9aa2b5] leading-relaxed">
            {artifact.summary}
          </div>
        )}

        {/* PDF Preview Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
            <div className="w-full max-w-2xl bg-[#14171d] border border-[#2f3545] rounded-[3px] p-5 shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between pb-3 border-b border-[#252b38]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#ef4444]" />
                  <span className="text-xs font-mono font-semibold text-[#f3f4f6]">{title}</span>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-xs text-[#8a92a5] hover:text-white px-2 py-1 bg-[#1d222d] border border-[#2c3240] rounded-[3px]"
                >
                  Tutup
                </button>
              </div>

              <div className="flex-1 overflow-y-auto my-4 p-4 bg-[#0e1014] border border-[#222734] rounded-[3px] text-xs font-sans text-[#cbd5e1] whitespace-pre-wrap leading-relaxed select-text">
                {content}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#252b38]">
                <button
                  onClick={() =>
                    handlePrintDocument(
                      title,
                      `<h1>${title}</h1><div class="header-info">Dibuat oleh VOX·AI Studio</div><div style="white-space: pre-wrap;">${content}</div>`
                    )
                  }
                  className="px-4 py-2 text-xs font-mono bg-[#ea580c] hover:bg-[#f97316] text-white rounded-[3px] flex items-center gap-1.5 transition-colors font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Cetak / Simpan PDF</span>
                </button>
              </div>
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
    <div className="w-full my-3 bg-[#121419] border border-[#282d3a] rounded-[3px] overflow-hidden shadow-lg text-[#e2e5eb]">
      {/* Top Header bar */}
      <div className="px-3.5 py-2.5 flex items-center justify-between bg-[#151820] border-b border-[#232835]">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 cursor-pointer select-none group"
        >
          <span className="text-xs font-semibold text-[#f3f4f6]">
            {artifact.files?.length || 0} files changed
          </span>
          <span className="text-xs font-mono font-medium">
            <span className="text-[#22c55e]">+{totalAdditions}</span>{" "}
            <span className="text-[#ef4444]">-{totalDeletions}</span>
          </span>
          <span className="text-[#757d90] group-hover:text-white transition-colors">
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-2.5 py-1 text-xs font-mono bg-[#1d222c] hover:bg-[#282f3c] text-[#cbd5e1] hover:text-white border border-[#333c4d] rounded-[3px] flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Code2 className="w-3.5 h-3.5 text-[#ea580c]" />
          <span>Review</span>
        </button>
      </div>

      {/* Files List */}
      {isExpanded && artifact.files && (
        <div className="divide-y divide-[#1e232d]">
          {artifact.files.map((file, idx) => {
            const isSelected = selectedFile?.name === file.name;
            return (
              <div
                key={idx}
                onClick={() => setSelectedFile(isSelected ? null : file)}
                className={`px-3.5 py-2 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                  isSelected ? "bg-[#1d2028]" : "hover:bg-[#181b22] bg-[#121419]"
                }`}
              >
                {/* Left: Badge + filename + path */}
                <div className="flex items-center gap-2.5 min-w-0 pr-3">
                  {renderFileBadge(file)}
                  <span className="font-mono font-semibold text-[#f3f4f6] shrink-0">
                    {file.name}
                  </span>
                  <span className="font-mono text-[#677083] text-[11px] truncate hidden sm:inline">
                    {file.path}
                  </span>
                </div>

                {/* Right: +Add -Del count */}
                <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                  <span className="text-[#22c55e]">+{file.additions}</span>
                  <span className="text-[#ef4444]">-{file.deletions}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Expanded Code Diff Viewer for selected file */}
      {isExpanded && selectedFile && selectedFile.content && (
        <div className="p-3 bg-[#0c0e12] border-t border-[#232835]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1f2430] text-xs font-mono">
            <span className="text-[#a1a8b8] flex items-center gap-1.5">
              <span className="text-[#ea580c]">FILE:</span> {selectedFile.path}
            </span>
            <button
              onClick={() => handleCopyText(selectedFile.content || "")}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] bg-[#191d26] hover:bg-[#232936] text-[#cbd5e1] border border-[#2e3544] rounded-[3px] transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-[#10b981]" /> Tersalin
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Salin Kode
                </>
              )}
            </button>
          </div>

          <pre className="p-3 bg-[#12141a] border border-[#1f2430] rounded-[3px] text-xs font-mono text-[#e2e8f0] overflow-x-auto max-h-64 scrollbar-thin leading-relaxed select-text">
            <code>{selectedFile.content}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
