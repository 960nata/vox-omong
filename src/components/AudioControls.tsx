"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
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
  AppWindow,
  Gamepad2,
  Globe,
  LayoutDashboard,
  Receipt,
  Rocket,
  Sheet,
} from "lucide-react";
import { ArrowIcon } from "./Btn";

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
  { icon: Globe, label: "Landing page", prompt: "Bikinin landing page untuk brand kopi lokal 'Senja Seduh' lengkap dengan hero, menu, testimoni, dan lokasi" },
  { icon: LayoutDashboard, label: "Dashboard", prompt: "Buat dashboard penjualan toko online dengan kartu KPI, grafik interaktif, dan tabel pesanan terbaru" },
  { icon: Gamepad2, label: "Mini game", prompt: "Bikin game tebak angka yang seru dengan skor, level kesulitan, dan animasi" },
  { icon: AppWindow, label: "Aplikasi", prompt: "Buat aplikasi to-do list dengan kategori, filter, dan data tersimpan di browser" },
  { icon: Presentation, label: "Slide presentasi", prompt: "Buatkan slide presentasi pitch deck untuk startup aplikasi les privat online" },
  { icon: FileText, label: "Dokumen / laporan", prompt: "Tulis proposal kegiatan bazar UMKM di kampus lengkap dengan latar belakang, tujuan, anggaran, dan jadwal" },
  { icon: Receipt, label: "Invoice", prompt: "Buatkan invoice untuk jasa desain logo dan branding untuk klien PT Maju Jaya" },
  { icon: Sheet, label: "Spreadsheet", prompt: "Buat tabel rencana anggaran bulanan mahasiswa dengan kategori, estimasi, dan realisasi" },
  { icon: Rocket, label: "Deploy", prompt: "Auto deploy proyek website ini ke Vercel sekarang" },
];

const CLAUDE_SKILLS_EN = [
  { icon: Globe, label: "Landing page", prompt: "Build a landing page for a local coffee brand 'Dusk Brew' with hero, menu, testimonials, and location" },
  { icon: LayoutDashboard, label: "Dashboard", prompt: "Build an online store sales dashboard with KPI cards, interactive charts, and a recent orders table" },
  { icon: Gamepad2, label: "Mini game", prompt: "Build a fun number guessing game with score, difficulty levels, and animations" },
  { icon: AppWindow, label: "App", prompt: "Build a to-do list app with categories, filters, and data saved in the browser" },
  { icon: Presentation, label: "Slide deck", prompt: "Create a pitch deck presentation for an online tutoring startup" },
  { icon: FileText, label: "Document", prompt: "Write a proposal for a campus small-business bazaar with background, goals, budget, and schedule" },
  { icon: Receipt, label: "Invoice", prompt: "Create an invoice for logo and branding design services for client Acme Corp" },
  { icon: Sheet, label: "Spreadsheet", prompt: "Create a monthly student budget table with categories, estimates, and actuals" },
  { icon: Rocket, label: "Deploy", prompt: "Trigger auto deployment of current workspace to Vercel" },
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
  const [attachedDoc, setAttachedDoc] = useState<{ name: string; text: string; chars: number; truncated: boolean } | null>(null);
  const [docError, setDocError] = useState("");
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

    if (!file.type.startsWith("image/")) {
      setIsUploadingImage(true);
      setDocError("");
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/extract", { method: "POST", body: fd });
        const data = await res.json();
        if (data.success) {
          setAttachedDoc({ name: data.name, text: data.text, chars: data.chars, truncated: data.truncated });
          setAttachedImage(null);
        } else setDocError(data.error || "Gagal membaca file");
      } catch {
        setDocError("Gagal membaca file");
      } finally {
        setIsUploadingImage(false);
        e.target.value = "";
      }
      return;
    }

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
    const typed =
      inputText.trim() ||
      (attachedImage ? "Analisis gambar ini dan buatkan kode atau solusinya" : attachedDoc ? "Ringkas isi dokumen ini" : "");
    const textToSend = attachedDoc && typed ? `${typed}\n\n<<lampiran:${attachedDoc.name.replace(/[<>\n]/g, "")}>>\n${attachedDoc.text}\n<</lampiran>>` : typed;
    if (!textToSend || isProcessing || isUploadingImage) return;

    onSendMessage(
      textToSend,
      attachedImage?.url || attachedImage?.dataUri,
      attachedImage?.dataUri
    );
    setInputText("");
    setAttachedImage(null);
    setAttachedDoc(null);
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
    <div className="intro w-full shrink-0 space-y-2.5 pb-1" style={{ ["--d" as string]: "0.3s" }}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.docx,.xlsx,.xlsm,.pptx,.csv,.tsv,.txt,.md,.json"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Transkrip langsung saat mic aktif */}
      {(isListening || liveTranscript) && (
        <div className="chat-in h-11 px-4 bg-base rounded-full flex items-center gap-3 text-sm shadow-[inset_0_0_0_1px_var(--line)]">
          <span className="pulse-dot shrink-0" style={{ background: "var(--accent)" }} />
          <span className={`min-w-0 flex-1 truncate ${liveTranscript ? "text-fg font-medium" : "text-fg-3 italic"}`}>
            {liveTranscript || "Ngomong aja, santai. Diam sebentar buat ngirim."}
            {isListening && <span className="chat-caret" />}
          </span>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-3">
            {jarvisMode ? "Hands-free" : "Live"}
          </span>
        </div>
      )}

      {/* Lampiran dokumen */}
      {(attachedDoc || docError) && (
        <div className="animate-rise px-2.5 py-2 bg-raised border border-line rounded-2xl flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <Paperclip className="w-3.5 h-3.5 shrink-0 text-accent" strokeWidth={1.5} />
            {attachedDoc ? (
              <div className="min-w-0">
                <div className="text-xs text-fg truncate font-medium">{attachedDoc.name}</div>
                <div className="text-[11px] text-moss">{attachedDoc.chars.toLocaleString("id-ID")} karakter terbaca{attachedDoc.truncated ? " (dipotong 30.000)" : ""}</div>
              </div>
            ) : (
              <div className="text-[11px] text-danger">{docError}</div>
            )}
          </div>
          <button type="button" onClick={() => { setAttachedDoc(null); setDocError(""); }} aria-label="Hapus lampiran" className="p-1.5 hover:bg-danger-wash text-fg-3 hover:text-danger rounded-lg cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Lampiran gambar */}
      {attachedImage && (
        <div className="animate-rise p-2 bg-raised border border-line rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src={attachedImage.dataUri}
              alt="Gambar yang dilampirkan"
              className="w-8 h-8 object-cover rounded-lg border border-line shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs text-fg truncate font-medium">{attachedImage.name}</div>
              <div className="text-[11px] text-moss">Siap dianalisis atau diubah jadi kode</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAttachedImage(null)}
            aria-label="Hapus lampiran"
            className="p-1.5 hover:bg-danger-wash text-fg-3 hover:text-danger rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Skill cepat */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] w-full min-w-0">
        {skills.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSendMessage(s.prompt)}
            disabled={isProcessing}
            className="chip shrink-0"
          >
            <s.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="relative bg-base rounded-[1.5rem] shadow-[inset_0_0_0_1px_var(--line)] focus-within:shadow-[inset_0_0_0_1.5px_var(--fg)] transition-shadow duration-500">
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={isProcessing}
          rows={1}
          aria-label="Pesan"
          placeholder={
            language === "id-ID"
              ? "Ketik perintah atau tempel gambar (Ctrl+V)…"
              : "Type a command or paste an image…"
          }
          className="w-full bg-transparent text-fg text-[14px] px-4 pt-3 pb-0.5 outline-hidden placeholder:text-fg-4 resize-none leading-relaxed"
        />

        <div className="px-2.5 pb-2.5 pl-3 flex flex-wrap items-center justify-between gap-1.5 min-w-0">
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || isUploadingImage}
              title="Lampirkan gambar atau file (PDF, Word, Excel, PPT, CSV)"
              aria-label="Lampirkan gambar"
              className="icon-btn disabled:opacity-50"
            >
              {isUploadingImage ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <Paperclip className="w-4 h-4" strokeWidth={1.5} />}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSkillsMenu(!showSkillsMenu)}
                aria-expanded={showSkillsMenu}
                className="chip h-9"
              >
                <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span className="hidden sm:inline">Skills</span>
                <ChevronUp className={`w-3 h-3 transition-transform ${showSkillsMenu ? "rotate-180" : ""}`} />
              </button>

              {showSkillsMenu && (
                <div className="chat-in absolute bottom-full left-0 mb-2 w-64 bg-raised border border-line rounded-2xl shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)] p-1.5 z-30">
                  <div className="px-2.5 pt-1 pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-3">
                    Dokumen &amp; coding
                  </div>
                  {skills.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setShowSkillsMenu(false);
                        onSendMessage(s.prompt);
                      }}
                      className="w-full text-left px-2.5 py-2 text-sm text-fg-2 hover:text-fg hover:bg-hover rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <s.icon className="w-4 h-4 shrink-0 text-accent" strokeWidth={1.5} />
                      <span className="truncate">{s.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onToggleJarvisMode}
              aria-pressed={jarvisMode}
              title={jarvisMode ? "Hands-free aktif: mic nyala lagi otomatis setelah AI ngomong" : "Nyalakan mode hands-free"}
              className="chip h-9"
            >
              <span className={`w-6 h-3.5 rounded-full relative transition-colors ${jarvisMode ? "bg-accent" : "bg-line-strong"} transition-colors duration-500`}>
                <span
                  className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all duration-500 ${jarvisMode ? "left-3" : "left-0.5"}`}
                />
              </span>
              <span className="hidden sm:inline">Hands-free</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isSpeaking && (
              <button
                type="button"
                onClick={onStopSpeaking}
                title="Hentikan suara AI"
                className="chip chat-in h-11"
              >
                <VolumeX className="w-4 h-4" />
                <span className="hidden sm:inline">Stop suara</span>
              </button>
            )}

            {/* Tombol mic: aksi utama */}
            <button
              type="button"
              onClick={onToggleMic}
              disabled={isProcessing}
              aria-pressed={isListening}
              title={isListening ? "Matikan mikrofon" : "Ngomong ke AI"}
              aria-label={isListening ? "Matikan mikrofon" : "Nyalakan mikrofon"}
              data-accent={isListening ? "" : undefined}
              className={`round-btn !overflow-visible ${isListening ? "bg-accent text-white" : "bg-ink text-on-ink"}`}
            >
              {isListening && <span className="absolute inset-0 -z-10 rounded-full bg-accent" style={{ animation: "pulse-ring 2s var(--ease-out-expo) infinite" }} />}
              {isListening ? <MicOff className="w-[14px] h-[14px]" strokeWidth={1.75} /> : <Mic className="w-[14px] h-[14px]" strokeWidth={1.75} />}
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={(!inputText.trim() && !attachedImage && !attachedDoc) || isProcessing}
              title="Kirim (Enter)"
              aria-label="Kirim pesan"
              data-accent=""
              className="round-btn bg-accent text-white text-[12px]"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowIcon />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
