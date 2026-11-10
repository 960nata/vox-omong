"use client";

import React, { useState, useEffect } from "react";
import { Conversation } from "@/lib/types";
import { Btn } from "./Btn";
import { Plus, MessageSquare, Trash2, X, PanelLeftClose } from "lucide-react";

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string, e?: React.MouseEvent) => void;
  isOpen: boolean;
  onClose?: () => void;
  onCloseMobile?: () => void;
  isDrawer?: boolean;
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isOpen,
  onClose,
  onCloseMobile,
  isDrawer = false,
}: ConversationSidebarProps) {
  const handleClose = onClose || onCloseMobile;

  // Resizable sidebar width on desktop
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check window size on mount
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    try {
      const savedWidth = localStorage.getItem("vox_sidebar_width");
      if (savedWidth) {
        const num = parseInt(savedWidth, 10);
        if (num >= 180 && num <= 450) setSidebarWidth(num);
      }
    } catch {}

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const isFloating = isMobile || isDrawer;

  // Dragging mouse handler for sidebar resize (only active when not floating/drawer)
  const handleMouseDownResize = (e: React.MouseEvent) => {
    if (isFloating) return;
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || isFloating) return;
      const newWidth = e.clientX;
      const maxWidth = Math.min(400, Math.floor(window.innerWidth * 0.35));
      if (newWidth >= 180 && newWidth <= maxWidth) {
        setSidebarWidth(newWidth);
        try {
          localStorage.setItem("vox_sidebar_width", newWidth.toString());
        } catch {}
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, isFloating]);

  if (!isOpen && !isFloating) {
    return null;
  }

  return (
    <>
      {/* Backdrop for mobile or drawer overlay mode */}
      {isOpen && isFloating && (
        <div
          onClick={handleClose}
          className="fixed inset-0 z-40 bg-scrim/40 transition-opacity animate-rise"
        />
      )}

      <aside
        style={!isFloating && isOpen ? { width: `${sidebarWidth}px` } : undefined}
        className={`${
          isFloating
            ? `fixed inset-y-0 left-0 z-50 w-72 sm:w-80 max-w-[85vw] transition-transform duration-200 ease-in-out shadow-2xl ${
                isOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
              }`
            : "relative inset-y-0 left-0 z-20 h-full shrink-0 shadow-none"
        } ${isFloating ? "" : "enter-left"} bg-canvas border-r border-line flex flex-col select-text transition-all`}
      >
        {/* Judul & tombol tutup */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[15px] font-medium tracking-[-0.02em] text-fg leading-none">Riwayat</div>
            <div className="font-mono text-[10px] text-fg-4 mt-1.5">{String(conversations.length).padStart(2, "0")} sesi tersimpan</div>
          </div>
          <button
            onClick={handleClose}
            title="Sembunyikan riwayat"
            aria-label="Sembunyikan riwayat"
            className="icon-btn shrink-0"
          >
            {isMobile ? <X className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <div className="px-3 pb-3">
          <Btn size="sm" onClick={onNew} className="w-full justify-between" icon={<Plus className="w-[0.9em] h-[0.9em]" strokeWidth={1.75} />}>
            Sesi baru
          </Btn>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-px">

          {conversations.length === 0 ? (
            <div className="text-center py-8 px-4 text-xs text-fg-3 leading-relaxed">
              Belum ada sesi. Klik <span className="font-medium text-fg-2">Sesi baru</span> atau langsung ngomong ke AI.
            </div>
          ) : (
            conversations.map((conv, idx) => {
              const isActive = conv.id === activeId;
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    onSelect(conv.id);
                    if (isFloating && handleClose) handleClose();
                  }}
                  style={{ ["--i" as string]: Math.min(idx, 12) }}
                  className={`card-in group relative flex items-center justify-between pl-3 pr-2 py-2.5 text-[13px] rounded-xl cursor-pointer transition-colors duration-300 ${
                    isActive ? "bg-hover text-fg" : "text-fg-3 hover:bg-hover/60 hover:text-fg"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-6">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-300 ${isActive ? "bg-accent" : "bg-line-strong group-hover:bg-fg-3"}`} />
                    <span className="truncate">{conv.title}</span>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => onDelete(conv.id, e)}
                    title="Hapus sesi"
                    aria-label="Hapus sesi"
                    className="sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 p-1 text-fg-3 hover:text-danger hover:bg-danger-wash rounded-lg transition-opacity cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Draggable Divider Handle (Right Border on desktop when not drawer) */}
        {!isFloating && (
          <div
            onMouseDown={handleMouseDownResize}
            title="Geser untuk menyesuaikan lebar sidebar"
            className="absolute top-0 bottom-0 -right-1.5 w-3 cursor-col-resize z-50 group hover:bg-accent/30 flex items-center justify-center transition-colors"
          >
            <div className="w-0.5 h-10 rounded-sm bg-line group-hover:bg-accent transition-colors" />
          </div>
        )}
      </aside>
    </>
  );
}
