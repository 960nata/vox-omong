"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Conversation, Message, VoiceSettings } from "@/lib/types";
import { VoiceVisualizer } from "@/components/VoiceVisualizer";
import { AudioControls } from "@/components/AudioControls";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { MessageItem } from "@/components/MessageItem";
import { SettingsModal, NEURAL_VOICES } from "@/components/SettingsModal";
import { RightWorkspacePanel, WorkspaceTab } from "@/components/RightWorkspacePanel";
import { CoworkerCursorOperator } from "@/components/CoworkerCursorOperator";
import { playJarvisSound } from "@/lib/jarvisSounds";
import {
  Menu,
  Settings as SettingsIcon,
  Volume2,
  Zap,
  Terminal,
  GitBranch,
  HardDrive,
  Globe,
  PanelRight,
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
  jarvisMode: true,
  silenceTimeoutMs: 2200,
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
  const [jarvisMode, setJarvisMode] = useState(true);

  // Settings & Panels
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("preview");
  const [previewUrl, setPreviewUrl] = useState("/api/preview?projectId=default-workspace");
  const [activeProjectId, setActiveProjectId] = useState("default-workspace");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Refs for Speech Recognition & Audio
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeConvRef = useRef<string | null>(activeConvId);
  const settingsRef = useRef<VoiceSettings>(settings);

  // Audio Mutex & Controller for Double-Voice Prevention & Fast Response
  const speechSessionIdRef = useRef<number>(0);
  const ttsAbortControllerRef = useRef<AbortController | null>(null);

  // JARVIS VAD (Voice Activity Detection) & State Refs
  const transcriptAccumulatorRef = useRef<string>("");
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const jarvisModeRef = useRef<boolean>(true);

  activeConvRef.current = activeConvId;
  settingsRef.current = settings;
  isSpeakingRef.current = isSpeaking;
  isProcessingRef.current = isProcessing;
  jarvisModeRef.current = jarvisMode;

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
        if (typeof parsed.jarvisMode === "boolean") {
          setJarvisMode(parsed.jarvisMode);
        }
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
    // 1. Invalidate current speech session to prevent race conditions & double-voice
    speechSessionIdRef.current++;

    // 2. Abort any in-flight /api/tts request
    if (ttsAbortControllerRef.current) {
      ttsAbortControllerRef.current.abort();
      ttsAbortControllerRef.current = null;
    }

    // 3. Pause & reset current audio element
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }

    // 4. Cancel browser speech synthesis
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
    isSpeakingRef.current = false;
  };

  // Speak text using Microsoft Edge Neural TTS or Browser Speech (Double-Voice Free & Ultra-Fast)
  const speakText = async (text: string) => {
    stopSpeaking();
    if (!text || !text.trim()) return;

    // Filter out code blocks and data URLs from speech
    const cleanSpeech = text
      .replace(/```[\s\S]*?```/g, "Kode program telah siap ditampilkan.")
      .replace(/https?:\/\/\S+/g, "tautan")
      .replace(/[*#_~`]/g, "")
      .trim();

    if (!cleanSpeech) return;

    // Allocate session ID for this utterance
    const currentSessionId = ++speechSessionIdRef.current;

    // LATENCY OPTIMIZATION: For fast verbal response, take first 1-2 core sentences
    // if the response is lengthy, so the audio starts playing in <300ms!
    const sentences = cleanSpeech.split(/(?<=[.!?])\s+/);
    const spokenText =
      sentences.length > 1 && cleanSpeech.length > 150
        ? (sentences[0] + " " + (sentences[1] || "")).slice(0, 180).trim()
        : cleanSpeech.slice(0, 250).trim();

    // 1. Try Microsoft Edge Neural TTS First
    if (settingsRef.current.ttsProvider === "neural") {
      try {
        setIsSpeaking(true);
        isSpeakingRef.current = true;

        const controller = new AbortController();
        ttsAbortControllerRef.current = controller;

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            text: spokenText,
            voice: settingsRef.current.neuralVoice || "id-ID-GadisNeural",
            rate: settingsRef.current.rate || 1.05,
            pitch: settingsRef.current.pitch || 1.0,
          }),
        });

        // Ensure session hasn't been interrupted while fetching
        if (speechSessionIdRef.current !== currentSessionId) return;

        if (res.ok) {
          const blob = await res.blob();
          if (speechSessionIdRef.current !== currentSessionId) return;

          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          currentAudioRef.current = audio;

          audio.onended = () => {
            if (speechSessionIdRef.current === currentSessionId) {
              setIsSpeaking(false);
              isSpeakingRef.current = false;
              currentAudioRef.current = null;
              URL.revokeObjectURL(audioUrl);

              // JARVIS Continuous Loop: auto resume listening if hands-free is enabled
              if (jarvisModeRef.current && !isProcessingRef.current) {
                setTimeout(() => {
                  playJarvisSound("listen");
                  startListening();
                }, 350);
              }
            }
          };

          audio.onerror = () => {
            if (speechSessionIdRef.current === currentSessionId) {
              setIsSpeaking(false);
              isSpeakingRef.current = false;
              currentAudioRef.current = null;
              URL.revokeObjectURL(audioUrl);
            }
          };

          await audio.play();
          return;
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("Neural TTS request failed, falling back to browser synthesis:", err);
        } else {
          return; // Intentionally aborted
        }
      }
    }

    // 2. Fallback to Browser SpeechSynthesis
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      return;
    }

    if (speechSessionIdRef.current !== currentSessionId) return;

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = settingsRef.current.language;
    utterance.rate = settingsRef.current.rate || 1.0;
    utterance.pitch = settingsRef.current.pitch || 1.0;

    if (settingsRef.current.voiceURI) {
      const matched = availableVoices.find(
        (v) => v.voiceURI === settingsRef.current.voiceURI
      );
      if (matched) utterance.voice = matched;
    }

    utterance.onstart = () => {
      if (speechSessionIdRef.current === currentSessionId) {
        setIsSpeaking(true);
        isSpeakingRef.current = true;
      }
    };
    utterance.onend = () => {
      if (speechSessionIdRef.current === currentSessionId) {
        setIsSpeaking(false);
        isSpeakingRef.current = false;

        // JARVIS Continuous Loop: auto resume listening
        if (jarvisModeRef.current && !isProcessingRef.current) {
          setTimeout(() => {
            playJarvisSound("listen");
            startListening();
          }, 350);
        }
      }
    };
    utterance.onerror = () => {
      if (speechSessionIdRef.current === currentSessionId) {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Send message to backend
  const handleSendMessage = async (text: string, imageUri?: string, dataUri?: string) => {
    if (!text.trim() || isProcessing) return;

    stopSpeaking();
    setIsProcessing(true);
    isProcessingRef.current = true;
    setLiveTranscript("");

    const cleanQuery = text.toLowerCase().trim();

    // JARVIS Wake Word Quick Response
    if (cleanQuery === "jarvis" || cleanQuery === "halo jarvis" || cleanQuery === "hey jarvis" || cleanQuery === "hai jarvis") {
      const jarvisGreet = "Ya cuy, Jarvis online dan standby! Mau ngerjain coding, dokumen, terminal, atau deploy apa sekarang?";
      const targetConvId = activeConvId || "conv-default";
      const userMsg: Message = {
        id: `usr-${Date.now()}`,
        conversationId: targetConvId,
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      const assistantMsg: Message = {
        id: `asst-${Date.now()}`,
        conversationId: targetConvId,
        role: "assistant",
        content: jarvisGreet,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      speakText(jarvisGreet);
      setIsProcessing(false);
      isProcessingRef.current = false;
      return;
    }

    // Voice / text command panel switches
    if (cleanQuery.includes("terminal") || cleanQuery.includes("buka terminal") || cleanQuery.includes("cek terminal")) {
      setIsRightPanelOpen(true);
      setWorkspaceTab("terminal");
    } else if (
      cleanQuery.includes("buka explorer") ||
      cleanQuery.includes("folder") ||
      cleanQuery.includes("lihat file") ||
      cleanQuery.includes("file explorer")
    ) {
      setIsRightPanelOpen(true);
      setWorkspaceTab("explorer");
    } else if (
      cleanQuery.includes("website") ||
      cleanQuery.includes("preview") ||
      cleanQuery.includes("tampilkan web") ||
      cleanQuery.includes("lihat website")
    ) {
      setIsRightPanelOpen(true);
      setWorkspaceTab("preview");
    } else if (
      cleanQuery.includes("deploy") ||
      cleanQuery.includes("vercel") ||
      cleanQuery.includes("github") ||
      cleanQuery.includes("auto deploy")
    ) {
      setIsRightPanelOpen(true);
      setWorkspaceTab("deploy");
    }

    if (
      cleanQuery.includes("coworker") ||
      cleanQuery.includes("kursor") ||
      cleanQuery.includes("cursor") ||
      cleanQuery.includes("kendali kursor") ||
      cleanQuery.includes("demo otomatis") ||
      cleanQuery.includes("tour otomatis")
    ) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("vox_trigger_coworker"));
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
          activeProjectId,
        }),
      });

      const data = await res.json();
      if (data.success && data.assistantMessage) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempUserMsg.id),
          data.userMessage,
          data.assistantMessage,
        ]);

        // If folder created, switch to explorer tab
        if (data.createdFolder) {
          setIsRightPanelOpen(true);
          setWorkspaceTab("explorer");
        }

        // If preview URL updated with generated component/page, reload preview tab
        if (data.previewUrl) {
          setPreviewUrl(data.previewUrl);
          setIsRightPanelOpen(true);
          setWorkspaceTab("preview");
        }

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
      isProcessingRef.current = false;
    }
  };

  // Initialize JARVIS Continuous Speech Recognition with VAD (Voice Activity Detection)
  const startListening = async () => {
    stopSpeaking();
    playJarvisSound("wake");

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    transcriptAccumulatorRef.current = "";

    // 1. Acquire microphone stream for real-time visualizer
    try {
      if (!audioStream) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setAudioStream(stream);
      }
    } catch (err) {
      console.warn("Could not capture microphone stream for visualizer:", err);
    }

    // 2. Setup Web SpeechRecognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Browser Anda belum mendukung Web Speech API. Silakan gunakan Google Chrome atau Edge.");
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = settingsRef.current.language;
    recognition.continuous = true; // JARVIS: Continuous listening, DO NOT abort on micro-pauses!
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setLiveTranscript("");
    };

    // VAD Silence Timeout: 2.2 seconds allows the user to pause, breathe, or think without premature cutoff
    const SILENCE_THRESHOLD_MS = settingsRef.current.silenceTimeoutMs || 2200;

    recognition.onresult = (event: any) => {
      // Natural Barge-In: if JARVIS is talking while user speaks, interrupt immediately!
      if (isSpeakingRef.current) {
        stopSpeaking();
        playJarvisSound("interrupt");
      }

      let currentFinal = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentFinal += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (currentFinal) {
        transcriptAccumulatorRef.current += currentFinal;
      }

      const fullSpoken = (transcriptAccumulatorRef.current + " " + interim).trim();
      setLiveTranscript(fullSpoken);

      // Reset the silence debounce timer on every spoken syllable
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      // Only schedule finalization when user actually pauses for SILENCE_THRESHOLD_MS
      if (fullSpoken.length > 0) {
        silenceTimerRef.current = setTimeout(() => {
          const candidate = (transcriptAccumulatorRef.current + " " + interim).trim();
          if (candidate && !isProcessingRef.current) {
            playJarvisSound("sent");
            stopListening();
            transcriptAccumulatorRef.current = "";
            handleSendMessage(candidate);
          }
        }, SILENCE_THRESHOLD_MS);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        stopListening();
      }
    };

    recognition.onend = () => {
      // In JARVIS continuous mode, auto-restart if still listening and not processing
      if (isListening && !isProcessingRef.current) {
        try {
          recognition.start();
        } catch {}
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.warn("Recognition start failed:", e);
    }
  };

  const stopListening = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
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

      {/* Main Studio Console (Center Column) */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-radial from-[#151821] via-[#0d0f13] to-[#090b0e] min-w-0">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-[#232834] bg-[#111319]/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-2 rounded-[3px] border transition-colors cursor-pointer ${
                isSidebarOpen
                  ? "bg-[#25211e] border-[#ea580c]/60 text-[#f97316]"
                  : "bg-[#1a1d26] hover:bg-[#1f2430] text-[#9ca3af] hover:text-[#f3f4f6] border-[#2b3140]"
              }`}
              title={isSidebarOpen ? "Sembunyikan Sidebar Sesi" : "Tampilkan Sidebar Sesi"}
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-[1px] bg-[#ea580c] ring-2 ring-[#ea580c]/30 animate-pulse" />
              <h1 className="text-sm font-semibold tracking-wider font-mono text-[#f3f4f6]">
                VOX·AI <span className="text-[#ea580c] text-xs font-normal">STUDIO</span>
              </h1>
            </div>

            {/* JARVIS Mode Badge */}
            {jarvisMode && (
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-[#142338] border border-[#38bdf8]/60 rounded-[3px] text-[10px] font-mono text-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.2)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-ping" />
                <span>JARVIS PROTOCOL ACTIVE</span>
              </div>
            )}
          </div>

          {/* Quick Tools & Right Panel Toggles */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Website Preview Tab Trigger */}
            <button
              onClick={() => {
                setIsRightPanelOpen(true);
                setWorkspaceTab("preview");
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-[3px] border transition-colors ${
                isRightPanelOpen && workspaceTab === "preview"
                  ? "bg-[#182635] border-[#38bdf8] text-[#38bdf8]"
                  : "bg-[#1a1d26] hover:bg-[#252b38] text-[#c4cad6] hover:text-[#f3f4f6] border-[#2d3444]"
              }`}
              title="Tampilkan Website Preview di panel kanan"
            >
              <Globe className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span className="hidden md:inline">PREVIEW</span>
            </button>

            {/* Project File Explorer Button */}
            <button
              onClick={() => {
                setIsRightPanelOpen(true);
                setWorkspaceTab("explorer");
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-[3px] border transition-colors ${
                isRightPanelOpen && workspaceTab === "explorer"
                  ? "bg-[#252016] border-[#fbbf24] text-[#fbbf24]"
                  : "bg-[#1a1d26] hover:bg-[#252b38] text-[#c4cad6] hover:text-[#f3f4f6] border-[#2d3444]"
              }`}
              title="Buka Folder Project di panel kanan"
            >
              <HardDrive className="w-3.5 h-3.5 text-[#fbbf24]" />
              <span className="hidden md:inline">EXPLORER</span>
            </button>

            {/* Developer Terminal Button */}
            <button
              onClick={() => {
                setIsRightPanelOpen(true);
                setWorkspaceTab("terminal");
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-[3px] border transition-colors ${
                isRightPanelOpen && workspaceTab === "terminal"
                  ? "bg-[#1b251d] border-[#10b981] text-[#34d399]"
                  : "bg-[#1a1d26] hover:bg-[#252b38] text-[#c4cad6] hover:text-[#f3f4f6] border-[#2d3444]"
              }`}
              title="Buka Terminal di panel kanan"
            >
              <Terminal className="w-3.5 h-3.5 text-[#10b981]" />
              <span className="hidden md:inline">TERMINAL</span>
            </button>

            {/* Auto Deploy (GitHub & Vercel) */}
            <button
              onClick={() => {
                setIsRightPanelOpen(true);
                setWorkspaceTab("deploy");
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-[3px] border transition-colors ${
                isRightPanelOpen && workspaceTab === "deploy"
                  ? "bg-[#291b15] border-[#ea580c] text-[#f97316]"
                  : "bg-[#1a1d26] hover:bg-[#252b38] text-[#c4cad6] hover:text-[#f3f4f6] border-[#2d3444]"
              }`}
              title="Auto Sync GitHub & Vercel Deploy"
            >
              <Zap className="w-3.5 h-3.5 text-[#ea580c]" />
              <span className="hidden md:inline">AUTO DEPLOY</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono bg-[#1a1d26] hover:bg-[#252b38] text-[#c4cad6] hover:text-[#f3f4f6] border border-[#2d3444] rounded-[3px] transition-colors"
              title="Buka Pengaturan"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-[#ea580c]" />
              <span className="hidden sm:inline">PENGATURAN</span>
            </button>

            {/* Toggle Panel Right Visibility */}
            <button
              onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
              className={`p-2 rounded-[3px] border transition-colors ${
                isRightPanelOpen
                  ? "bg-[#25211e] border-[#ea580c]/60 text-[#f97316]"
                  : "bg-[#1a1d26] hover:bg-[#252b38] text-[#8e98aa] border-[#2d3444]"
              }`}
              title={isRightPanelOpen ? "Sembunyikan Panel Workspace" : "Tampilkan Panel Workspace"}
            >
              <PanelRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Central Workspace (Chat Area - Responsive Fluid Grid) */}
        <div className="flex-1 flex flex-col p-2.5 sm:p-4 md:p-5 overflow-hidden gap-2.5 sm:gap-3 w-full max-w-5xl 2xl:max-w-6xl mx-auto min-w-0 transition-all">
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
                  JARVIS Voice Engine Online
                </p>
                <p className="text-xs text-[#707a8e] mt-1 max-w-sm">
                  Tekan tombol &quot;TEKAN &amp; BICARA&quot; di bawah atau aktifkan mode JARVIS. Anda bisa bicara dengan jeda santai tanpa takut terputus sebelum kalimat selesai.
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

          {/* Interactive Voice & Text Controller with Image Upload & JARVIS Mode */}
          <AudioControls
            isListening={isListening}
            isSpeaking={isSpeaking}
            isProcessing={isProcessing}
            liveTranscript={liveTranscript}
            onToggleMic={handleToggleMic}
            onSendMessage={handleSendMessage}
            onStopSpeaking={stopSpeaking}
            language={settings.language}
            jarvisMode={jarvisMode}
            onToggleJarvisMode={() => setJarvisMode(!jarvisMode)}
            onOpenExplorer={() => {
              setIsRightPanelOpen(true);
              setWorkspaceTab("explorer");
            }}
          />
        </div>
      </main>

      {/* Resizable Right Workspace Panel: Website Preview, Explorer, Terminal, Auto Deploy */}
      <RightWorkspacePanel
        isOpen={isRightPanelOpen}
        onClose={() => setIsRightPanelOpen(false)}
        activeTab={workspaceTab}
        onTabChange={setWorkspaceTab}
        onTriggerVoiceFeedback={(msg) => {
          if (settings.autoSpeak) speakText(msg);
        }}
        initialUrl={previewUrl}
        onUrlChange={setPreviewUrl}
      />

      {/* Autonomous Coworker Cursor Operator */}
      <CoworkerCursorOperator
        onSpeak={speakText}
        onSwitchTab={setWorkspaceTab}
        onOpenRightPanel={() => setIsRightPanelOpen(true)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
        availableVoices={availableVoices}
      />
    </div>
  );
}
