"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  Send,
  VolumeX,
  Sparkles,
  Loader2,
  Paperclip,
  Image as ImageIcon,
  X,
  FileText,
  Presentation,
  Film,
  Code2,
  ChevronUp,
} from "lucide-react";

interface AudioControlsProps {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  liveTranscript: string;
  onToggleMic: () => void;
  onSendMessage: (text: string, imageUri?: string, dataUri?: string) => void;
  onStopSpeaking: () => void;
  language: "id-ID" | "en-US";
  onOpenExplorer?: () => void;
  jarvisMode?: boolean;
  onToggleJarvisMode?: () => void;
}

const CLAUDE_SKILLS_ID = [
  { label: "🏗️ Swarm UI: Landing Page", prompt: "Gunakan Swarm Build Agent untuk membuat Landing Page lengkap item-per-item komponen sampai jadi full di index.html" },
  { label: "📊 Swarm UI: Dashboard", prompt: "Gunakan Swarm Build Agent untuk membuat Dashboard Analytics lengkap per komponen sampai jadi full di index.html" },
  { label: "📑 PPT & Video Animasi", prompt: "Buatkan slide presentasi pitch deck profesional dan siapkan mode export ke video animasi" },
  { label: "📄 Invoice Resmi (PDF)", prompt: "Buatkan invoice penagihan resmi klien dengan rincian biaya, pajak 11%, dan format cetak PDF" },
  { label: "📊 Spreadsheet Finansial", prompt: "Buatkan spreadsheet laporan arus kas bulanan dalam tabel terstruktur dan unduh CSV" },
  { label: "⚡ Coding Complex & UI", prompt: "Kerjakan task coding modular dengan komponen React Tailwind dan sudut lengkungan 3px" },
  { label: "🌐 Website Preview", prompt: "Tampilkan live website preview hasil pengembangan proyek" },
  { label: "🚀 Deploy ke Vercel", prompt: "Auto deploy proyek website ini ke Vercel sekarang" },
  { label: "🤖 Coworker Demo", prompt: "Coworker: Gerakkan kursor dan demonstrasikan fitur studio secara otomatis" },
];

const CLAUDE_SKILLS_EN = [
  { label: "🏗️ Swarm UI: Landing Page", prompt: "Use Swarm Build Agent to craft a complete Landing Page item-by-item until fully assembled in index.html" },
  { label: "📊 Swarm UI: Dashboard", prompt: "Use Swarm Build Agent to craft a complete Analytics Dashboard item-by-item until fully assembled in index.html" },
  { label: "📑 PPT & Video Animation", prompt: "Generate interactive pitch deck presentation slides with animated video export capability" },
  { label: "📄 Official Invoice (PDF)", prompt: "Create an official client invoice with itemized charges, 11% tax, and PDF print export" },
  { label: "📊 Financial Spreadsheet", prompt: "Create a monthly cashflow financial spreadsheet with CSV export" },
  { label: "⚡ Complex Code & UI", prompt: "Execute complex full-stack coding task with React Tailwind 3px corner components" },
  { label: "🌐 Live Web Preview", prompt: "Open live website preview panel for the active project" },
  { label: "🚀 Deploy to Vercel", prompt: "Trigger auto deployment of current workspace to Vercel" },
  { label: "🤖 Coworker Demo", prompt: "Coworker: Move cursor and demonstrate the studio autonomously" },
];

export function AudioControls({
  isListening,
  isSpeaking,
  isProcessing,
  liveTranscript,
  onToggleMic,
  onSendMessage,
  onStopSpeaking,
  language,
  onOpenExplorer,
  jarvisMode = true,
  onToggleJarvisMode,
}: AudioControlsProps) {
  const [inputText, setInputText] = useState("");
  const [attachedImage, setAttachedImage] = useState<{
    dataUri: string;
    url?: string;
    name: string;
  } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showSkillsMenu, setShowSkillsMenu] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto trigger file picker when voice command mentions "upload gambar" / "unggah gambar"
  useEffect(() => {
    if (!liveTranscript) return;
    const lt = liveTranscript.toLowerCase();
    if (
      lt.includes("upload gambar") ||
      lt.includes("unggah gambar") ||
      lt.includes("lampirkan gambar") ||
      lt.includes("pilih gambar") ||
      lt.includes("buka gambar") ||
      lt.includes("ambil gambar")
    ) {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  }, [liveTranscript]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const dataUri = evt.target?.result as string;

        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataUri,
            filename: file.name,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setAttachedImage({
            dataUri,
            url: data.url,
            name: file.name,
          });
        } else {
          setAttachedImage({
            dataUri,
            url: dataUri,
            name: file.name,
          });
        }
        setIsUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Upload failed:", err);
      setIsUploadingImage(false);
    }

    e.target.value = "";
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend =
      inputText.trim() ||
      (attachedImage ? "Analisis gambar ini dan buatkan kode atau solusinya" : "");
    if (!textToSend || isProcessing || isUploadingImage) return;

    onSendMessage(
      textToSend,
      attachedImage?.url || attachedImage?.dataUri,
      attachedImage?.dataUri
    );
    setInputText("");
    setAttachedImage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const dataUri = evt.target?.result as string;
            setAttachedImage({
              dataUri,
              url: dataUri,
              name: `clipboard-${Date.now()}.png`,
            });
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  };

  const skills = language === "id-ID" ? CLAUDE_SKILLS_ID : CLAUDE_SKILLS_EN;

  return (
    <div className="w-full bg-[#101217] border-t border-[#232835] p-3 sm:p-4 space-y-2.5">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Live speech preview if speaking/listening */}
      {(isListening || liveTranscript) && (
        <div className="p-2.5 bg-[#141b27] border border-[#38bdf8]/60 rounded-[3px] flex items-center justify-between text-xs font-mono animate-fadeIn shadow-lg">
          <div className="flex items-center gap-2 text-[#38bdf8] overflow-hidden min-w-0">
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#38bdf8] animate-ping shrink-0" />
            <span className="text-[#93c5fd] text-[11px] shrink-0 font-bold tracking-wider">
              {jarvisMode ? "JARVIS LISTENING:" : "VOICE RECOGNITION:"}
            </span>
            <span className="text-[#f8fafc] truncate italic font-sans font-medium">
              {liveTranscript || "Mendengarkan ucapanmu (bebas bicara & jeda santai, VAD 2.2s)..."}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <span className="text-[10px] text-[#38bdf8] font-mono px-1.5 py-0.5 bg-[#1e293b] border border-[#334155] rounded-[2px]">
              VAD 2.2S
            </span>
            <span className="text-[10px] text-[#10b981] font-mono px-1.5 py-0.5 bg-[#14291f] border border-[#166534] rounded-[2px]">
              LIVE
            </span>
          </div>
        </div>
      )}

      {/* Attached Image Preview Chip */}
      {attachedImage && (
        <div className="p-2 bg-[#171b24] border border-[#374052] rounded-[3px] flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src={attachedImage.dataUri}
              alt="Preview"
              className="w-10 h-10 object-cover rounded-[2px] border border-[#48546b] shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-mono text-[#f3f4f6] truncate font-medium">
                {attachedImage.name}
              </div>
              <div className="text-[10px] text-[#10b981] font-mono flex items-center gap-1">
                <span>✓ Siap dianalisis / Design-to-Code</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAttachedImage(null)}
            className="p-1 hover:bg-[#27303f] text-[#9ca3af] hover:text-[#ef4444] rounded-[2px] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Skills Pills Horizontal Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        <span className="text-[10px] font-mono font-bold text-[#ea580c] px-1.5 py-0.5 bg-[#251711] border border-[#ea580c]/30 rounded-[2px] shrink-0 uppercase tracking-wider">
          SKILLS:
        </span>
        {skills.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSendMessage(s.prompt)}
            disabled={isProcessing}
            className="shrink-0 px-2.5 py-1 bg-[#161922] hover:bg-[#222836] hover:border-[#ea580c]/60 text-[#a0abbd] hover:text-[#f3f4f6] border border-[#272e3d] rounded-[3px] text-[11px] font-mono transition-colors disabled:opacity-40"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Modern High-Tech Unified Chat & Command Bar */}
      <div className="relative bg-[#141720] border border-[#2b3345] focus-within:border-[#ea580c] rounded-[3px] shadow-2xl transition-colors">
        {/* Multi-line expandable prompt input */}
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={isProcessing}
          rows={2}
          placeholder={
            language === "id-ID"
              ? "Ketik instruksi, paste gambar (Ctrl+V), atau klik icon mic / aktifkan JARVIS..."
              : "Type instructions, paste image, or click mic / toggle JARVIS..."
          }
          className="w-full bg-transparent text-[#f3f4f6] text-xs sm:text-sm font-sans px-3.5 pt-3 pb-2 outline-hidden placeholder-[#636e82] resize-none leading-relaxed"
        />

        {/* Bottom Internal Toolbar: Attachments + Jarvis + Mic + Send */}
        <div className="px-2.5 pb-2 pt-1 flex items-center justify-between border-t border-[#1e2432] gap-2">
          {/* Left tools */}
          <div className="flex items-center gap-1.5">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || isUploadingImage}
              title="Lampirkan Gambar atau Screenshot"
              className="p-1.5 bg-[#1b202c] hover:bg-[#252c3c] border border-[#2d3648] hover:border-[#ea580c]/60 text-[#9ca3af] hover:text-[#f3f4f6] rounded-[3px] transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer"
            >
              {isUploadingImage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ea580c]" />
              ) : (
                <Paperclip className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Quick Skills Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSkillsMenu(!showSkillsMenu)}
                className="px-2 py-1 bg-[#1b202c] hover:bg-[#252c3c] border border-[#2d3648] text-[#9ca3af] hover:text-[#f3f4f6] rounded-[3px] text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-[#ea580c]" />
                <span className="hidden sm:inline">Claude Skills</span>
                <ChevronUp className={`w-3 h-3 transition-transform ${showSkillsMenu ? "rotate-180" : ""}`} />
              </button>

              {/* Skills Dropdown Menu */}
              {showSkillsMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#141720] border border-[#2e374a] rounded-[3px] shadow-2xl p-1 z-30 space-y-0.5 animate-fadeIn">
                  <div className="px-2.5 py-1 text-[10px] font-mono text-[#ea580c] uppercase font-bold border-b border-[#212838]">
                    Pilih Skill Dokumen &amp; Coding:
                  </div>
                  {skills.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setShowSkillsMenu(false);
                        onSendMessage(s.prompt);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs text-[#cbd5e1] hover:text-[#f3f4f6] hover:bg-[#202636] rounded-[2px] transition-colors flex items-center gap-2 font-mono"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ea580c]" />
                      <span className="truncate">{s.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Action Icons: JARVIS, Voice Mic, Stop Speech, Send */}
          <div className="flex items-center gap-1.5">
            {/* Stop AI Audio playback button (only when speaking) */}
            {isSpeaking && (
              <button
                type="button"
                onClick={onStopSpeaking}
                title="Hentikan Pembacaan Suara AI"
                className="px-2 py-1 bg-[#2b1712] border border-[#ea580c] hover:bg-[#381d17] text-[#f97316] rounded-[3px] flex items-center gap-1 text-[11px] font-mono transition-colors shadow-xs cursor-pointer animate-pulse"
              >
                <VolumeX className="w-3.5 h-3.5 text-[#ea580c]" />
                <span>DIAM</span>
              </button>
            )}

            {/* JARVIS Hands-Free Mode Icon Button */}
            <button
              type="button"
              onClick={onToggleJarvisMode}
              title={jarvisMode ? "Mode JARVIS Aktif (Bebas bicara otomatis)" : "Aktifkan Mode JARVIS Hands-Free"}
              className={`p-1.5 rounded-[3px] border font-mono text-xs flex items-center gap-1 transition-all cursor-pointer ${
                jarvisMode
                  ? "bg-[#142336] border-[#38bdf8] text-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.3)]"
                  : "bg-[#181d28] border-[#293245] text-[#697488] hover:text-[#f3f4f6]"
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${jarvisMode ? "text-[#38bdf8] animate-pulse" : "text-[#697488]"}`} />
              <span className="text-[10px] font-bold hidden md:inline">
                {jarvisMode ? "JARVIS" : "JARVIS OFF"}
              </span>
            </button>

            {/* Small Voice Mic Icon Button */}
            <button
              type="button"
              onClick={onToggleMic}
              disabled={isProcessing}
              title={isListening ? "Hentikan Mikrofon" : "Klik untuk Bicara (Voice Input)"}
              className={`p-1.5 rounded-[3px] border transition-all cursor-pointer flex items-center gap-1 font-mono text-xs ${
                isListening
                  ? "bg-[#271812] border-[#ea580c] text-[#f97316] ring-2 ring-[#ea580c]/30 shadow-[0_0_10px_rgba(234,88,12,0.4)] animate-pulse"
                  : "bg-[#181d28] hover:bg-[#252c3c] border-[#293245] hover:border-[#ea580c]/60 text-[#a0abbd] hover:text-[#f3f4f6]"
              } disabled:opacity-40`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-3.5 h-3.5 text-[#ea580c]" />
                  <span className="text-[10px] text-[#ea580c] font-bold hidden md:inline">REC</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-[#ea580c]" />
                  <span className="text-[10px] hidden md:inline">VOICE</span>
                </>
              )}
            </button>

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={(!inputText.trim() && !attachedImage) || isProcessing}
              title="Kirim Pesan (Enter)"
              className="p-1.5 bg-[#ea580c] hover:bg-[#f97316] text-white disabled:bg-[#1e2330] disabled:text-[#4b5568] border border-[#c2410c] disabled:border-[#272e3d] rounded-[3px] transition-colors cursor-pointer disabled:cursor-not-allowed shadow-xs"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
