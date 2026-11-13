"use client";

import React, { useState } from "react";
import { Message } from "@/lib/types";
import { ArtifactCard } from "./ArtifactCard";
import { Logo } from "./Logo";
import { MessageContent } from "./MessageContent";
import { Volume2, VolumeX, Copy, Check, User, Maximize2, X, Folder, File, FileCode, FileText, ChevronDown, ChevronUp, HardDrive } from "lucide-react";

interface MessageItemProps {
  message: Message;
  onSpeak: (text: string) => void;
  isCurrentSpeaking: boolean;
  onStopSpeaking: () => void;
}

export function MessageItem({
  message,
  onSpeak,
  isCurrentSpeaking,
  onStopSpeaking,
}: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [showFolderFiles, setShowFolderFiles] = useState(false);
  const isAssistant = message.role === "assistant";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`chat-in group relative flex items-end gap-2.5 sm:gap-3 min-w-0 ${isAssistant ? "" : "flex-row-reverse"}`}>
      {/* Avatar */}
      {isAssistant ? (
        <Logo active={isCurrentSpeaking} className="w-7 h-7 mb-6" />
      ) : (
        <div className="w-7 h-7 mb-6 shrink-0 rounded-full bg-accent text-white flex items-center justify-center" aria-hidden="true">
          <User className="w-3.5 h-3.5" strokeWidth={1.75} />
        </div>
      )}

      {/* Bubble */}
      <div className={`min-w-0 flex flex-col ${isAssistant ? "flex-1 items-start" : "items-end max-w-[85%]"}`}>
      <div
        className={`min-w-0 max-w-full px-3 sm:px-4 py-2.5 sm:py-3 text-[14px] [overflow-wrap:anywhere] leading-relaxed ${
          isAssistant
            ? "w-full bg-base text-fg rounded-[1.1rem] rounded-bl-md"
            : "on-ink bg-ink rounded-[1.1rem] rounded-br-md"
        }`}
      >
        {/* Lampiran gambar */}
        {message.imageUri && (
          <div className="my-2 inline-block relative group/img">
            <img
              src={message.imageUri}
              alt="Lampiran pengguna"
              onClick={() => setIsPreviewModalOpen(true)}
              className="max-h-32 max-w-[12rem] rounded-2xl border border-line object-cover cursor-zoom-in hover:border-accent transition-colors"
            />
            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(true)}
              title="Perbesar gambar"
              aria-label="Perbesar gambar"
              className="absolute bottom-2 right-2 p-1.5 bg-scrim/60 hover:bg-scrim text-white rounded-full opacity-0 group-hover/img:opacity-100 focus:opacity-100 transition-opacity"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Lampiran File / Folder Khusus per User Sandbox */}
        {message.attachedItem && (
          <div className={`my-2 p-2.5 rounded-xl border text-xs shadow-xs space-y-1.5 ${
            isAssistant
              ? "border-line/80 bg-raised/90 text-fg"
              : "border-white/20 bg-white/10 text-white"
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {message.attachedItem.type === "folder" ? (
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isAssistant
                      ? "bg-accent/10 border border-accent/30 text-accent"
                      : "bg-white/20 border border-white/30 text-white"
                  }`}>
                    <Folder className="w-4 h-4" strokeWidth={1.75} />
                  </span>
                ) : (
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isAssistant
                      ? "bg-base border border-line text-lagoon"
                      : "bg-white/20 border border-white/30 text-white"
                  }`}>
                    <FileCode className="w-4 h-4" strokeWidth={1.75} />
                  </span>
                )}
                <div className="min-w-0">
                  <div className={`font-semibold text-xs truncate ${isAssistant ? "text-fg" : "text-white"}`}>
                    {message.attachedItem.name}
                  </div>
                  <div className={`text-[10px] flex items-center gap-1.5 ${isAssistant ? "text-fg-3" : "text-white/75"}`}>
                    {message.attachedItem.type === "folder" ? (
                      <span>{message.attachedItem.itemCount || 0} file</span>
                    ) : (
                      <span>{typeof message.attachedItem.size === "number" ? (message.attachedItem.size > 1024 ? `${(message.attachedItem.size / 1024).toFixed(1)} KB` : `${message.attachedItem.size} B`) : "File"}</span>
                    )}
                    <span>•</span>
                    <span className={`flex items-center gap-0.5 ${
                      message.attachedItem.isLocalFile
                        ? isAssistant ? "text-lagoon" : "text-cyan-200"
                        : isAssistant ? "text-moss" : "text-emerald-300"
                    }`}>
                      {message.attachedItem.isLocalFile ? (
                        "File Lokal (Langsung Dibaca)"
                      ) : message.attachedItem.type === "folder" ? (
                        <><HardDrive className="w-2.5 h-2.5" /> Folder Proyek</>
                      ) : (
                        <><HardDrive className="w-2.5 h-2.5" /> File Proyek</>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {message.attachedItem.type === "folder" && message.attachedItem.files && message.attachedItem.files.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowFolderFiles(!showFolderFiles)}
                  className={`px-2 py-1 rounded-md text-[10px] flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                    isAssistant
                      ? "bg-hover text-fg-2 hover:text-fg"
                      : "bg-white/15 text-white hover:bg-white/25"
                  }`}
                >
                  <span>{showFolderFiles ? "Tutup" : "Daftar"}</span>
                  {showFolderFiles ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>

            {/* Expandable file tree preview for folder */}
            {showFolderFiles && message.attachedItem.files && (
              <div className={`mt-2 pt-2 border-t max-h-36 overflow-y-auto space-y-1 font-mono text-[10px] pl-1 ${
                isAssistant
                  ? "border-line/60 text-fg-2"
                  : "border-white/20 text-white/80"
              }`}>
                {message.attachedItem.files.map((f, idx) => (
                  <div key={idx} className={`flex items-center justify-between py-0.5 pr-1 rounded ${
                    isAssistant ? "hover:bg-hover/50" : "hover:bg-white/10"
                  }`}>
                    <span className={`truncate max-w-[200px] ${isAssistant ? "text-fg-2" : "text-white/90"}`}>{f.path}</span>
                    <span className={`text-[9px] shrink-0 ${isAssistant ? "text-fg-4" : "text-white/60"}`}>{f.size > 1024 ? `${(f.size / 1024).toFixed(1)}KB` : `${f.size}B`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <MessageContent content={message.content} />

        {message.artifact && (
          <div className="mt-3">
            <ArtifactCard artifact={message.artifact} />
          </div>
        )}
        {message.artifacts?.map((a) => (
          <div key={a.id} className="mt-3">
            <ArtifactCard artifact={a} />
          </div>
        ))}
      </div>

      {/* Meta + aksi di bawah bubble */}
      <div className={`h-6 mt-1 px-1 flex items-center gap-2 text-[11px] text-fg-4 ${isAssistant ? "" : "flex-row-reverse"}`}>
        <span className="font-mono text-[10px]">{isAssistant ? "vox.ai" : "kamu"} · {formattedTime}</span>
        <div className="flex items-center gap-0.5 transition-opacity duration-500 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          {isAssistant && (
            <button
              onClick={() => (isCurrentSpeaking ? onStopSpeaking() : onSpeak(message.content))}
              title={isCurrentSpeaking ? "Hentikan suara" : "Dengarkan jawaban"}
              aria-label={isCurrentSpeaking ? "Hentikan suara" : "Dengarkan jawaban"}
              className={`lift grid place-items-center w-6 h-6 rounded-full cursor-pointer ${isCurrentSpeaking ? "bg-accent text-white" : "hover:text-fg hover:bg-hover"}`}
            >
              {isCurrentSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
            </button>
          )}
          <button onClick={handleCopy} title={copied ? "Tersalin" : "Salin teks"} aria-label="Salin teks" className="lift grid place-items-center w-6 h-6 rounded-full hover:text-fg hover:bg-hover cursor-pointer">
            {copied ? <Check className="w-3.5 h-3.5 text-moss" /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />}
          </button>
        </div>
      </div>
      </div>

      {/* Fullscreen Image Zoom Modal */}
      {isPreviewModalOpen && message.imageUri && (
        <div
          onClick={() => setIsPreviewModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/70 backdrop-blur-sm p-4 cursor-zoom-out animate-rise"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-base border border-line-strong rounded-lg p-2">
            <button
              onClick={() => setIsPreviewModalOpen(false)}
              className="absolute -top-3 -right-3 p-1.5 bg-accent hover:bg-accent-hi text-on-accent rounded-lg shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={message.imageUri}
              alt="Preview Full"
              className="max-h-[85vh] max-w-full rounded-md object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}