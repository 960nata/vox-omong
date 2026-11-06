"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Conversation, Message, VoiceSettings } from "@/lib/types";
import { VoiceVisualizer } from "@/components/VoiceVisualizer";
import { AudioControls } from "@/components/AudioControls";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { MessageItem } from "@/components/MessageItem";
import { SettingsModal, NEURAL_VOICES } from "@/components/SettingsModal";
import { TerminalDrawer } from "@/components/TerminalDrawer";
import { GitHubVercelModal } from "@/components/GitHubVercelModal";
import { ProjectExplorerModal } from "@/components/ProjectExplorerModal";
import {
  Menu,
  Settings as SettingsIcon,
  Volume2,
  Zap,
  Terminal,
  GitBranch,
  HardDrive,
} from "lucide-react";

const DEFAULT_SETTINGS: VoiceSettings = {
  apiKey: "aigw_51d115a24f09241184a426302c08879e",
  language: "id-ID",
  ttsProvider: "neural",
  neuralVoice: "id-ID-GadisNeural",
  voiceURI: "",
  pitch: 1.0,
  rate: 1.0,
  autoSpeak: true,
  systemPrompt: "",
};

export default function VoiceAiStudio() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Audio / Speech States
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  // Settings & Modals
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isGitModalOpen, setIsGitModalOpen] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Refs for Speech Recognition & Audio
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeConvRef = useRef<string | null>(activeConvId);
  const settingsRef = useRef<VoiceSettings>(settings);

  activeConvRef.current = activeConvId;
  settingsRef.current = settings;

  // Load saved settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("vox_ai_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          ttsProvider: parsed.ttsProvider || "neural",
          neuralVoice: parsed.neuralVoice || "id-ID-GadisNeural",
        });
      }
    } catch (e) {
      console.warn("Could not load stored settings", e);
    }
  }, []);

  // Save settings helper
  const handleSaveSettings = (newSettings: VoiceSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem("vox_ai_settings", JSON.stringify(newSettings));
    } catch (e) {
      console.warn("Could not save settings to localStorage", e);
    }
  };

  // Populate browser synthesis voices
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        setAvailableVoices(v);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Fetch conversations on load
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      if (data.conversations && data.conversations.length > 0) {
        setConversations(data.conversations);
        if (!activeConvRef.current) {
          setActiveConvId(data.conversations[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConvId) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/conversations/${activeConvId}`);
        const data = await res.json();
        if (data.conversation) {
          setMessages(data.conversation.messages || []);
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    };

    fetchMessages();
  }, [activeConvId]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveTranscript]);

  // Stop currently playing audio or speech synthesis
  const stopSpeaking = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // Speak text using Microsoft Edge Neural TTS or Browser Speech
  const speakText = async (text: string) => {
    stopSpeaking();
    if (!text || !text.trim()) return;

    // Filter out code blocks and data URLs from speech
    const cleanSpeech = text
      .replace(/```[\s\S]*?```/g, "Kode program telah siap ditampilkan.")
      .replace(/https?:\/\/\S+/g, "tautan tautan")
      .trim();

    if (!cleanSpeech) return;

    // 1. Try Microsoft Edge Neural TTS First
    if (settingsRef.current.ttsProvider === "neural") {
      try {
        setIsSpeaking(true);
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: cleanSpeech,
            voice: settingsRef.current.neuralVoice || "id-ID-GadisNeural",
            rate: settingsRef.current.rate || 1.0,
            pitch: settingsRef.current.pitch || 1.0,
          }),
        });

        if (res.ok) {
          const blob = await res.blob();
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          currentAudioRef.current = audio;

          audio.onended = () => {
            setIsSpeaking(false);
            currentAudioRef.current = null;
            URL.revokeObjectURL(audioUrl);
          };

          audio.onerror = () => {
            setIsSpeaking(false);
            currentAudioRef.current = null;
            URL.revokeObjectURL(audioUrl);
          };

          await audio.play();
          return;
        }
      } catch (err) {
        console.warn("Neural TTS request failed, falling back to browser synthesis:", err);
      }
    }

    // 2. Fallback to Browser SpeechSynthesis
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = settingsRef.current.language;
    utterance.rate = settingsRef.current.rate;
    utterance.pitch = settingsRef.current.pitch;

    if (settingsRef.current.voiceURI) {
      const matched = availableVoices.find(
        (v) => v.voiceURI === settingsRef.current.voiceURI
      );
      if (matched) utterance.voice = matched;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Send message to backend
  const handleSendMessage = async (text: string, imageUri?: string, dataUri?: string) => {
    if (!text.trim() || isProcessing) return;

    stopSpeaking();
    setIsProcessing(true);
    setLiveTranscript("");

    const cleanQuery = text.toLowerCase();
    if (
      cleanQuery.includes("buka terminal") ||
      cleanQuery.includes("open terminal") ||
      cleanQuery.includes("cek terminal")
    ) {
      setIsTerminalOpen(true);
    }
    if (
      cleanQuery.includes("buka explorer") ||
      cleanQuery.includes("lihat folder") ||
      cleanQuery.includes("file explorer") ||
      cleanQuery.includes("folder project")
    ) {
      setIsExplorerOpen(true);
    }
    if (
      cleanQuery.includes("deploy") ||
      cleanQuery.includes("vercel") ||
      cleanQuery.includes("github") ||
      cleanQuery.includes("git status")
    ) {
      if (cleanQuery.includes("terminal")) {
        setIsTerminalOpen(true);
      } else {
        setIsGitModalOpen(true);
      }
    }

    const targetConvId = activeConvId || "conv-default";

    // Optimistically append user message with imageUri if present
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: targetConvId,
      role: "user",
      content: text,
      imageUri: imageUri || dataUri,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: targetConvId,
          message: text,
          language: settingsRef.current.language,
          apiKey: settingsRef.current.apiKey,
          systemPrompt: settingsRef.current.systemPrompt,
          imageUri: imageUri,
          imageDataUri: dataUri,
        }),
      });

      const data = await res.json();
      if (data.success && data.assistantMessage) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempUserMsg.id),
          data.userMessage,
          data.assistantMessage,
        ]);

        // Auto speak if enabled
        if (settingsRef.current.autoSpeak) {
          speakText(data.assistantMessage.content);
        }

        // Refresh conversation list to update titles/timestamps
        loadConversations();
      }
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Initialize Speech Recognition
  const startListening = async () => {
    stopSpeaking();

    // 1. Acquire microphone stream for real-time visualizer
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
    } catch (err) {
      console.warn("Could not capture microphone stream for visualizer:", err);
    }

    // 2. Setup SpeechRecognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Browser Anda belum mendukung Web Speech API. Silakan gunakan Google Chrome atau Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = settingsRef.current.language;
    recognition.continuous = false; // single sentence turn
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setLiveTranscript("");
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      setLiveTranscript(interim || final);

      if (final.trim()) {
        stopListening();
        handleSendMessage(final.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      stopListening();
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
      setAudioStream(null);
    }
    setIsListening(false);
  };

  const handleToggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Conversation operations
  const handleNewConversation = async () => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Sesi Suara Baru" }),
      });
      const data = await res.json();
      if (data.conversation) {
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConvId(data.conversation.id);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to create new conversation:", err);
    }
  };

  const handleDeleteConversation = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        if (remaining.length > 0) {
          setActiveConvId(remaining[0].id);
        } else {
          setActiveConvId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#0d0f13] text-[#f3f4f6] font-sans overflow-hidden antialiased">
      {/* Sidebar: Conversation history */}
      <ConversationSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        conversations={conversations}
        activeId={activeConvId}
        onSelect={(id) => {
          setActiveConvId(id);
          setIsSidebarOpen(false);
        }}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
      />

      {/* Main Studio Console */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-radial from-[#151821] via-[#0d0f13] to-[#090b0e]">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-[#232834] bg-[#111319]/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-[#1f2430] rounded-[3px] border border-[#2b3140] transition-colors"
              title="Daftar Sesi"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-[1px] bg-[#ea580c] ring-2 ring-[#ea580c]/30 animate-pulse" />
              <h1 className="text-sm font-semibold tracking-wider font-mono text-[#f3f4f6]">
                VOX·AI <span className="text-[#ea580c] text-xs font-normal">STUDIO</span>
              </h1>
            </div>
          </div>

          {/* Quick Tools & Settings Action Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Project File Explorer Button */}
            <button
              onClick={() => setIsExplorerOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-[3px] border transition-colors ${
                isExplorerOpen
                  ? "bg-[#18261e] border-[#10b981] text-[#34d399]"
                  : "bg-[#1a1d26] hover:bg-[#252b38] text-[#c4cad6] hover:text-[#f3f4f6] border-[#2d3444]"
              }`}
              title="Buka Project File Explorer"
            >
              <HardDrive className="w-3.5 h-3.5 text-[#10b981]" />
              <span className="hidden md:inline">EXPLORER</span>
            </button>

            {/* Developer Terminal Button */}
            <button
              onClick={() => setIsTerminalOpen(!isTerminalOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-[3px] border transition-colors ${
                isTerminalOpen
                  ? "bg-[#291b15] border-[#ea580c] text-[#f97316]"
                  : "bg-[#1a1d26] hover:bg-[#252b38] text-[#c4cad6] hover:text-[#f3f4f6] border-[#2d3444]"
              }`}
              title="Buka Terminal Project"
            >
              <Terminal className="w-3.5 h-3.5 text-[#ea580c]" />
              <span className="hidden md:inline">TERMINAL</span>
            </button>

            {/* GitHub & Vercel Connect */}
            <button
              onClick={() => setIsGitModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono bg-[#1a1d26] hover:bg-[#252b38] text-[#c4cad6] hover:text-[#f3f4f6] border border-[#2d3444] rounded-[3px] transition-colors"
              title="Koneksi GitHub & Vercel"
            >
              <GitBranch className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span className="hidden md:inline">GIT &amp; VERCEL</span>
            </button>

            <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-[#8c94a5] bg-[#171a22] px-2.5 py-1 border border-[#2b3140] rounded-[3px]">
              <Zap className="w-3.5 h-3.5 text-[#f97316]" />
              <span>
                {settings.apiKey.startsWith("aigw_")
                  ? "AI GATEWAY"
                  : settings.apiKey.startsWith("AIza")
                  ? "GEMINI 2.5"
                  : "LOCAL VOICE"}
              </span>
            </div>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono bg-[#1a1d26] hover:bg-[#252b38] text-[#c4cad6] hover:text-[#f3f4f6] border border-[#2d3444] rounded-[3px] transition-colors"
              title="Buka Pengaturan"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-[#ea580c]" />
              <span className="hidden sm:inline">PENGATURAN</span>
            </button>
          </div>
        </header>

        {/* Central Workspace */}
        <div className="flex-1 flex flex-col p-3 sm:p-5 overflow-hidden gap-3 max-w-5xl w-full mx-auto">
          {/* Top Audio Waveform Monitor */}
          <VoiceVisualizer
            isListening={isListening}
            isSpeaking={isSpeaking}
            isProcessing={isProcessing}
            audioStream={audioStream}
          />

          {/* Chat Message Stream */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin rounded-[3px]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#5b6477]">
                <Volume2 className="w-10 h-10 mb-3 text-[#ea580c]/60" />
                <p className="text-sm font-medium text-[#c0c6d4]">
                  Konsol Suara Siap Digunakan
                </p>
                <p className="text-xs text-[#707a8e] mt-1 max-w-sm">
                  Tekan tombol &quot;TEKAN &amp; BICARA&quot; di bawah untuk berbicara dengan asisten AI, upload gambar untuk jadikan kode, atau buat folder project secara otomatis.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  onSpeak={speakText}
                  isCurrentSpeaking={isSpeaking}
                  onStopSpeaking={stopSpeaking}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Interactive Voice & Text Controller with Image Upload */}
          <AudioControls
            isListening={isListening}
            isSpeaking={isSpeaking}
            isProcessing={isProcessing}
            liveTranscript={liveTranscript}
            onToggleMic={handleToggleMic}
            onSendMessage={handleSendMessage}
            onStopSpeaking={stopSpeaking}
            language={settings.language}
            onOpenExplorer={() => setIsExplorerOpen(true)}
          />
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
        availableVoices={availableVoices}
      />

      {/* Developer Terminal Drawer */}
      <TerminalDrawer
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
        onTriggerVoiceFeedback={(msg) => {
          if (settings.autoSpeak) speakText(msg);
        }}
      />

      {/* GitHub & Vercel Connector Modal */}
      <GitHubVercelModal
        isOpen={isGitModalOpen}
        onClose={() => setIsGitModalOpen(false)}
        onVoiceFeedback={(msg) => {
          if (settings.autoSpeak) speakText(msg);
        }}
      />

      {/* Project File & Folder Explorer Modal */}
      <ProjectExplorerModal
        isOpen={isExplorerOpen}
        onClose={() => setIsExplorerOpen(false)}
        onNotifyVoice={(msg) => {
          if (settings.autoSpeak) speakText(msg);
        }}
      />
    </div>
  );
}
