"use client";

import React, { useState, useEffect } from "react";
import { Conversation } from "@/lib/types";
import { Plus, MessageSquare, Trash2, Radio, X, PanelLeftClose } from "lucide-react";

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
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs transition-opacity animate-fadeIn"
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
        } bg-[#111318] border-r border-[#242935] flex flex-col select-text transition-all`}
      >
        {/* Brand Header & Close button */}
        <div className="p-3.5 border-b border-[#242934] flex items-center justify-between bg-[#13161d]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-[3px] bg-[#221c18] border border-[#ea580c]/40 flex items-center justify-center text-[#f97316] shrink-0">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold tracking-wide text-[#f3f4f6] truncate font-mono">
                VOX·AI STUDIO
              </div>
              <div className="text-[9px] font-mono text-[#788195] tracking-widest truncate">
                ACOUSTIC AGENT V1
              </div>
            </div>
          </div>

          <button
            onClick={handleClose}
            title="Sembunyikan Sidebar"
            className="p-1.5 text-[#8892a4] hover:text-[#f3f4f6] hover:bg-[#202533] rounded-[3px] transition-colors cursor-pointer shrink-0"
          >
            {isMobile ? <X className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* New Session Button */}
        <div className="p-3">
          <button
            onClick={onNew}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#1e232c] hover:bg-[#282f3c] text-[#f3f4f6] text-xs font-mono tracking-wider border border-[#333b4d] rounded-[3px] transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#ea580c]" />
            <span>SESI BARU</span>
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1 scrollbar-thin">
          <div className="px-2 py-1 text-[10px] font-mono tracking-wider uppercase text-[#5a6273]">
            Riwayat Percakapan
          </div>

          {conversations.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#5a6273]">
              Belum ada percakapan tersimpan
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeId;
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    onSelect(conv.id);
                    if (isFloating && handleClose) handleClose();
                  }}
                  className={`group relative flex items-center justify-between p-2.5 text-xs rounded-[3px] cursor-pointer border transition-colors ${
                    isActive
                      ? "bg-[#201d1b] border-[#ea580c]/50 text-[#f97316]"
                      : "bg-[#16191f] border-transparent text-[#9ca3af] hover:bg-[#1b1f26] hover:text-[#d1d5db]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-6">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? "text-[#f97316]" : "text-[#555d6e]"
                      }`}
                    />
                    <span className="truncate font-medium">{conv.title}</span>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => onDelete(conv.id, e)}
                    title="Hapus sesi"
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#6e778a] hover:text-[#ef4444] hover:bg-[#282020] rounded-[3px] transition-opacity cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info badge */}
        <div className="p-3 border-t border-[#242934] bg-[#0e1014] text-[11px] font-mono text-[#626a7c] flex justify-between items-center shrink-0">
          <span>LATENCY: &lt;180ms</span>
          <span className="flex items-center gap-1.5 text-[#10b981]">
            <span className="w-1.5 h-1.5 rounded-[2px] bg-[#10b981]" /> READY
          </span>
        </div>

        {/* Draggable Divider Handle (Right Border on desktop when not drawer) */}
        {!isFloating && (
          <div
            onMouseDown={handleMouseDownResize}
            title="Geser untuk menyesuaikan lebar sidebar"
            className="absolute top-0 bottom-0 -right-1.5 w-3 cursor-col-resize z-50 group hover:bg-[#ea580c]/30 flex items-center justify-center transition-colors"
          >
            <div className="w-0.5 h-10 rounded-[1px] bg-[#3b4458] group-hover:bg-[#ea580c] transition-colors" />
          </div>
        )}
      </aside>
    </>
  );
}
