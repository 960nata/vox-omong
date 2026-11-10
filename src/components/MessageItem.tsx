"use client";

import React, { useState } from "react";
import { Message } from "@/lib/types";
import { ArtifactCard } from "./ArtifactCard";
import { Logo } from "./Logo";
import { MessageContent } from "./MessageContent";
import { Volume2, VolumeX, Copy, Check, User, Maximize2, X } from "lucide-react";

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