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
  FolderPlus,
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
}

const QUICK_PROMPTS_ID = [
  "🌐 Tampilkan website preview",
  "📁 Buka folder project",
  "🚀 Auto deploy ke Vercel",
  "📸 Upload gambar & jadikan kode UI",
  "💻 Buka terminal dan cek git status",
  "📄 Buatkan invoice penagihan resmi klien",
  "📊 Buatkan spreadsheet arus kas bulanan",
  "📑 Buatkan slide presentasi pitch deck",
  "⚡ Kerjakan task coding & refactor 4 file",
];

const QUICK_PROMPTS_EN = [
  "🌐 Show live website preview",
  "📁 Open project files explorer",
  "🚀 Auto deploy to Vercel",
  "📸 Upload image & convert to UI code",
  "💻 Open terminal and check git status",
  "📄 Create an official client invoice",
  "📊 Create monthly cashflow spreadsheet",
  "📑 Generate interactive pitch deck",
  "⚡ Execute coding task & refactor 4 files",
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
}: AudioControlsProps) {
  const [inputText, setInputText] = useState("");
  const [attachedImage, setAttachedImage] = useState<{
    dataUri: string;
    url?: string;
    name: string;
  } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

        // Upload to server
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
          // Fallback to client-side dataUri
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

    // Reset input
    e.target.value = "";
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = inputText.trim() || (attachedImage ? "Analisis gambar ini dan buatkan kode / solusinya" : "");
    if (!textToSend || isProcessing || isUploadingImage) return;

    onSendMessage(textToSend, attachedImage?.url || attachedImage?.dataUri, attachedImage?.dataUri);
    setInputText("");
    setAttachedImage(null);
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isProcessing) return;
    if (prompt.includes("Upload gambar")) {
      fileInputRef.current?.click();
      return;
    }
    if (prompt.includes("Buat folder") && onOpenExplorer) {
      onOpenExplorer();
    }
    onSendMessage(prompt);
  };

  // Paste image directly from clipboard
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
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

  const quickPrompts = language === "id-ID" ? QUICK_PROMPTS_ID : QUICK_PROMPTS_EN;

  return (
    <div className="w-full bg-[#13151a] border-t border-[#232834] p-3 sm:p-4 space-y-3">
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
        <div className="p-2.5 bg-[#1a1e27] border border-[#ea580c]/40 rounded-[3px] flex items-center justify-between text-xs font-mono animate-fadeIn">
          <div className="flex items-center gap-2 text-[#f97316] overflow-hidden">
            <span className="w-2 h-2 rounded-[2px] bg-[#ea580c] animate-ping shrink-0" />
            <span className="text-[#a6b0c2] text-[11px] shrink-0 uppercase">Transkrip Live:</span>
            <span className="text-[#f3f4f6] truncate italic font-sans font-medium">
              {liveTranscript || "Mendengarkan ucapanmu (coba katakan: 'upload gambar' atau 'buat folder test')..."}
            </span>
          </div>
          <span className="text-[10px] text-[#717b8f] shrink-0 font-mono ml-2">STT ON</span>
        </div>
      )}

      {/* Attached Image Preview Chip */}
      {attachedImage && (
        <div className="p-2 bg-[#1b202c] border border-[#3b475e] rounded-[3px] flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src={attachedImage.dataUri}
              alt="Preview"
              className="w-10 h-10 object-cover rounded-[2px] border border-[#4a5875] shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-mono text-[#f3f4f6] truncate">
                {attachedImage.name}
              </div>
              <div className="text-[10px] text-[#9ca3af] flex items-center gap-1.5">
                <span className="text-[#10b981] font-mono">Siap dianalisis / Design-to-Code</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAttachedImage(null)}
            className="p-1 hover:bg-[#2c3548] text-[#9ca3af] hover:text-[#ef4444] rounded-[2px] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Prompts Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        <Sparkles className="w-3.5 h-3.5 text-[#ea580c] shrink-0 ml-0.5" />
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleQuickPrompt(p)}
            disabled={isProcessing}
            className="shrink-0 px-2.5 py-1 bg-[#1a1d24] hover:bg-[#252a35] hover:border-[#ea580c]/50 text-[#9ca3af] hover:text-[#f3f4f6] border border-[#2b3140] rounded-[3px] text-[11px] transition-colors disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Main Bar: Mic Trigger, Image Picker & Text fallback */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Big Mic Tactile Button */}
        <button
          type="button"
          onClick={onToggleMic}
          disabled={isProcessing}
          title={isListening ? "Hentikan Mikrofon" : "Mulai Berbicara"}
          className={`flex items-center justify-center gap-2.5 px-4 sm:px-6 py-3 font-mono text-xs uppercase tracking-wider font-semibold rounded-[3px] border transition-all shadow-md shrink-0 select-none ${
            isListening
              ? "bg-[#241a16] border-[#ea580c] text-[#f97316] ring-2 ring-[#ea580c]/30 animate-pulse"
              : "bg-[#ea580c] hover:bg-[#f97316] border-[#c2410c] text-white"
          } disabled:opacity-50`}
        >
          {isListening ? (
            <>
              <MicOff className="w-4 h-4 text-[#ea580c]" />
              <span className="hidden sm:inline">BERHENTI BICARA</span>
              <span className="sm:hidden">STOP</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span className="hidden sm:inline">TEKAN & BICARA</span>
              <span className="sm:hidden">BICARA</span>
            </>
          )}
        </button>

        {/* Image Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing || isUploadingImage}
          title="Upload Gambar / Screenshot (atau katakan 'upload gambar')"
          className="p-3 bg-[#181b22] hover:bg-[#242935] border border-[#2c3240] hover:border-[#ea580c]/60 text-[#a0abbd] hover:text-[#f3f4f6] rounded-[3px] transition-colors shrink-0 disabled:opacity-50 flex items-center justify-center"
        >
          {isUploadingImage ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#ea580c]" />
          ) : (
            <Paperclip className="w-4 h-4" />
          )}
        </button>

        {/* Text Input Fallback */}
        <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-1.5 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onPaste={handlePaste}
            disabled={isProcessing}
            placeholder={
              language === "id-ID"
                ? "Ketik pesan, paste gambar (Ctrl+V), atau gunakan mikrofon..."
                : "Type message, paste image, or use voice..."
            }
            className="w-full bg-[#181b22] border border-[#2c3240] focus:border-[#ea580c] text-[#f3f4f6] text-xs sm:text-sm rounded-[3px] px-3.5 py-3 outline-hidden placeholder-[#616a7d] transition-colors"
          />

          <button
            type="submit"
            disabled={(!inputText.trim() && !attachedImage) || isProcessing}
            className="absolute right-1.5 p-2 bg-[#232834] hover:bg-[#2e3545] text-[#d1d5db] hover:text-[#f3f4f6] disabled:text-[#4b5563] disabled:bg-transparent rounded-[3px] transition-colors"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#ea580c]" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>

        {/* Stop AI Audio playback button if assistant is currently talking */}
        {isSpeaking && (
          <button
            type="button"
            onClick={onStopSpeaking}
            title="Hentikan Pembacaan Suara"
            className="px-3 py-3 bg-[#241a16] border border-[#ea580c] hover:bg-[#32201a] text-[#f97316] rounded-[3px] flex items-center gap-1.5 text-xs font-mono shrink-0 transition-colors"
          >
            <VolumeX className="w-4 h-4 text-[#ea580c]" />
            <span className="hidden sm:inline">DIAM</span>
          </button>
        )}
      </div>
    </div>
  );
}