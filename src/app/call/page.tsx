"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowLeft,
  Settings,
  MessageSquare,
  ShieldCheck,
  Send,
} from "lucide-react";

type CallStatus = "idle" | "calling" | "connected" | "ended";
type AgentState = "listening" | "thinking" | "speaking";

export default function CallPage() {
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [agentState, setAgentState] = useState<AgentState>("listening");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>("id-ID-ArdiNeural");
  const [callDuration, setCallDuration] = useState<number>(0);
  const [userTranscript, setUserTranscript] = useState<string>("");
  const [agentTranscript, setAgentTranscript] = useState<string>("");
  const [showChatLog, setShowChatLog] = useState<boolean>(false);
  const [chatLog, setChatLog] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [textInput, setTextInput] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio & Speech references
  const recognitionRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const currentSpeechSessionRef = useRef<number>(0);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Stop currently playing TTS audio immediately (Barge-in / Interrupt)
  const stopAudio = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current = null;
    }
    isSpeakingRef.current = false;
  }, []);

  // Send message to AI and play voice response
  const sendMessageToAI = useCallback(
    async (textToSend: string) => {
      if (!textToSend.trim()) return;

      const userText = textToSend.trim();
      setUserTranscript(userText);
      setChatLog((prev) => [...prev, { role: "user", text: userText }]);
      setAgentState("thinking");

      // Increment session counter so old speech gets cancelled
      currentSpeechSessionRef.current += 1;
      const thisSession = currentSpeechSessionRef.current;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userText,
            language: "id-ID",
          }),
        });

        if (!res.ok) {
          throw new Error("Gagal menghubungi server");
        }

        const data = await res.json();
        const replyText =
          data.reply ||
          (data.conversation?.messages &&
            data.conversation.messages[data.conversation.messages.length - 1]?.content) ||
          "Halo, ada yang bisa saya bantu?";

        if (thisSession !== currentSpeechSessionRef.current) return;

        setAgentTranscript(replyText);
        setChatLog((prev) => [...prev, { role: "assistant", text: replyText }]);
        setAgentState("speaking");
        isSpeakingRef.current = true;

        // Play audio from Edge TTS endpoint
        const cleanForVoice = replyText
          .replace(/[*#`_\[\]()]/g, "")
          .replace(/https?:\/\/\S+/g, "")
          .slice(0, 500);

        const ttsUrl = `/api/tts?voice=${encodeURIComponent(
          selectedVoice
        )}&text=${encodeURIComponent(cleanForVoice)}`;

        const audio = new Audio(ttsUrl);
        audioPlayerRef.current = audio;

        audio.onended = () => {
          if (thisSession === currentSpeechSessionRef.current) {
            setAgentState("listening");
            isSpeakingRef.current = false;
          }
        };

        audio.onerror = () => {
          if (thisSession === currentSpeechSessionRef.current) {
            setAgentState("listening");
            isSpeakingRef.current = false;
          }
        };

        if (!isSpeakerMuted) {
          await audio.play();
        } else {
          setAgentState("listening");
          isSpeakingRef.current = false;
        }
      } catch (err: any) {
        console.error("Call chat error:", err);
        setErrorMessage(err.message || "Gagal memproses suara");
        setAgentState("listening");
        isSpeakingRef.current = false;
      }
    },
    [selectedVoice, isSpeakerMuted]
  );

  // Setup Speech Recognition
  const initSpeechRecognition = useCallback(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage("Browser ini belum mendukung Web Speech API. Silakan gunakan Chrome/Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "id-ID";

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

      const activeText = final || interim;
      if (activeText.trim()) {
        setUserTranscript(activeText);

        // Barge-in: user is speaking, interrupt AI voice playback
        if (isSpeakingRef.current) {
          stopAudio();
          setAgentState("listening");
        }

        // Reset silence timer
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (activeText.trim() && callStatus === "connected") {
            sendMessageToAI(activeText.trim());
          }
        }, 1400); // 1.4s of silence finishes turn
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error !== "no-speech") {
        console.warn("Speech recognition error:", e.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if call is still active
      if (callStatus === "connected" && !isMuted) {
        try {
          recognition.start();
        } catch {
          // ignore already started
        }
      }
    };

    recognitionRef.current = recognition;
  }, [callStatus, isMuted, sendMessageToAI, stopAudio]);

  // Start Call Handler
  const startCall = async () => {
    setErrorMessage(null);
    setCallStatus("calling");

    // Simulate instant phone connection
    setTimeout(() => {
      setCallStatus("connected");
      setCallDuration(0);
      setAgentState("speaking");
      setAgentTranscript("Halo! Jarvis siap membantu. Kamu mau bikin apa hari ini?");

      // Play intro greeting
      const introAudio = new Audio(
        `/api/tts?voice=${encodeURIComponent(
          selectedVoice
        )}&text=${encodeURIComponent("Halo! Jarvis siap membantu. Mau buat apa hari ini?")}`
      );
      audioPlayerRef.current = introAudio;
      introAudio.onended = () => {
        setAgentState("listening");
        isSpeakingRef.current = false;
      };
      introAudio.play().catch(() => {
        setAgentState("listening");
      });

      // Start Recognition
      try {
        if (recognitionRef.current) {
          recognitionRef.current.start();
        }
      } catch (err) {
        console.warn("Recognition start err:", err);
      }
    }, 1200);
  };

  // End Call Handler
  const endCall = () => {
    stopAudio();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    setCallStatus("ended");
    setTimeout(() => {
      setCallStatus("idle");
      setCallDuration(0);
      setUserTranscript("");
      setAgentTranscript("");
    }, 1500);
  };

  // Toggle Mute
  const toggleMute = () => {
    if (!isMuted) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsMuted(true);
    } else {
      if (recognitionRef.current && callStatus === "connected") {
        try {
          recognitionRef.current.start();
        } catch {}
      }
      setIsMuted(false);
    }
  };

  // Timer loop when connected
  useEffect(() => {
    if (callStatus === "connected") {
      timerIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [callStatus]);

  // Init Recognition on Mount
  useEffect(() => {
    initSpeechRecognition();
    return () => {
      stopAudio();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [initSpeechRecognition, stopAudio]);

  return (
    <div className="relative min-h-screen w-full bg-neutral-950 text-white flex flex-col justify-between items-center p-6 select-none overflow-hidden font-sans">
      {/* Background Glow Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="w-full max-w-md flex items-center justify-between z-10 pt-2">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition px-3 py-1.5 rounded-full bg-neutral-900/60 border border-neutral-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </Link>

        <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-3 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>End-to-End Encrypted</span>
        </div>

        <button
          onClick={() => setShowChatLog(!showChatLog)}
          className={`p-2 rounded-full border transition ${
            showChatLog
              ? "bg-cyan-600 text-white border-cyan-500"
              : "bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-white"
          }`}
          title="Lihat Log Chat"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>

      {/* Middle Caller Avatar & Status */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md z-10 my-auto text-center">
        {/* Caller Avatar with Live Audio Pulse Rings */}
        <div className="relative flex items-center justify-center my-6">
          {callStatus === "connected" && agentState === "speaking" && (
            <>
              <div className="absolute w-44 h-44 rounded-full border border-cyan-500/40 animate-ping opacity-60" />
              <div className="absolute w-56 h-56 rounded-full border border-cyan-400/20 animate-pulse" />
            </>
          )}

          {callStatus === "connected" && agentState === "listening" && (
            <div className="absolute w-44 h-44 rounded-full border border-emerald-500/30 animate-pulse" />
          )}

          <div
            className={`w-36 h-36 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 border-2 ${
              callStatus === "connected"
                ? agentState === "speaking"
                  ? "bg-gradient-to-tr from-cyan-600 to-blue-600 border-cyan-400 shadow-cyan-500/30 scale-105"
                  : agentState === "thinking"
                  ? "bg-gradient-to-tr from-amber-600 to-orange-600 border-amber-400 shadow-amber-500/30 animate-pulse"
                  : "bg-gradient-to-tr from-emerald-600 to-teal-700 border-emerald-400 shadow-emerald-500/30"
                : "bg-neutral-900 border-neutral-800 text-neutral-500"
            }`}
          >
            <Sparkles
              className={`w-16 h-16 transition-all duration-300 ${
                callStatus === "connected" ? "text-white" : "text-neutral-600"
              }`}
            />
          </div>
        </div>

        {/* Identity Title & Timer */}
        <h1 className="text-2xl font-bold tracking-tight text-white mt-2">Jarvis Voice AI</h1>

        <div className="mt-1 flex items-center gap-2">
          {callStatus === "connected" && (
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
          <span className="text-sm font-medium text-neutral-400">
            {callStatus === "idle" && "Siap Menerima Panggilan"}
            {callStatus === "calling" && "Menghubungkan..."}
            {callStatus === "connected" && formatTime(callDuration)}
            {callStatus === "ended" && "Panggilan Berakhir"}
          </span>
        </div>

        {/* State Tag */}
        {callStatus === "connected" && (
          <div className="mt-3">
            <span
              className={`text-xs px-3 py-1 rounded-full font-medium tracking-wide transition ${
                agentState === "speaking"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : agentState === "thinking"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}
            >
              {agentState === "speaking" && "🗣️ Jarvis Berbicara (Tap untuk potong)"}
              {agentState === "thinking" && "🧠 Memikirkan jawaban..."}
              {agentState === "listening" && "🎙️ Mendengarkan suara kamu..."}
            </span>
          </div>
        )}

        {/* Live Subtitle Transcript */}
        <div className="w-full mt-6 min-h-[72px] px-4 flex flex-col justify-center">
          {userTranscript && callStatus === "connected" && (
            <p className="text-xs text-neutral-400 italic line-clamp-2">
              Kamu: &ldquo;{userTranscript}&rdquo;
            </p>
          )}
          {agentTranscript && callStatus === "connected" && (
            <p className="text-sm text-neutral-200 mt-1 line-clamp-3 font-medium">
              &ldquo;{agentTranscript}&rdquo;
            </p>
          )}
          {errorMessage && (
            <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/40 px-3 py-1.5 rounded-lg mt-2">
              {errorMessage}
            </p>
          )}
        </div>

        {/* Optional Chat Drawer */}
        {showChatLog && (
          <div className="w-full mt-3 bg-neutral-900/90 border border-neutral-800 rounded-xl p-3 text-left max-h-48 overflow-y-auto space-y-2 text-xs">
            <div className="text-[10px] uppercase font-semibold text-neutral-500 border-b border-neutral-800 pb-1">
              Transkrip Percakapan
            </div>
            {chatLog.length === 0 ? (
              <div className="text-neutral-500 text-center py-4">Belum ada percakapan</div>
            ) : (
              chatLog.map((c, i) => (
                <div key={i} className={c.role === "user" ? "text-cyan-400" : "text-neutral-200"}>
                  <span className="font-semibold text-[10px] text-neutral-400">
                    {c.role === "user" ? "Kamu: " : "Jarvis: "}
                  </span>
                  {c.text}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Manual Input Fallback (if mic not available or noisy room) */}
      {callStatus === "connected" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (textInput.trim()) {
              sendMessageToAI(textInput);
              setTextInput("");
            }
          }}
          className="w-full max-w-md flex items-center gap-2 mb-4 z-10"
        >
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Atau ketik pesan di sini..."
            className="flex-1 bg-neutral-900/80 border border-neutral-800 text-sm text-white rounded-full px-4 py-2 focus:outline-none focus:border-cyan-500 placeholder-neutral-500"
          />
          <button
            type="submit"
            className="p-2 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white transition disabled:opacity-50"
            disabled={!textInput.trim()}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Voice Selection */}
      <div className="w-full max-w-xs flex items-center justify-center gap-3 mb-6 z-10 text-xs text-neutral-400">
        <span>Karakter Suara:</span>
        <button
          onClick={() => setSelectedVoice("id-ID-ArdiNeural")}
          className={`px-2.5 py-1 rounded-md transition ${
            selectedVoice === "id-ID-ArdiNeural"
              ? "bg-neutral-800 text-white font-medium border border-neutral-700"
              : "text-neutral-500 hover:text-white"
          }`}
        >
          Ardi (Pria)
        </button>
        <button
          onClick={() => setSelectedVoice("id-ID-GadisNeural")}
          className={`px-2.5 py-1 rounded-md transition ${
            selectedVoice === "id-ID-GadisNeural"
              ? "bg-neutral-800 text-white font-medium border border-neutral-700"
              : "text-neutral-500 hover:text-white"
          }`}
        >
          Gadis (Wanita)
        </button>
      </div>

      {/* Bottom Call Action Dock */}
      <div className="w-full max-w-sm flex items-center justify-around z-10 pb-4">
        {callStatus === "idle" && (
          <button
            onClick={startCall}
            className="group flex flex-col items-center gap-2 transition transform active:scale-95"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-600/40 text-white">
              <Phone className="w-9 h-9 group-hover:scale-110 transition" />
            </div>
            <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">
              Mulai Telepon
            </span>
          </button>
        )}

        {callStatus === "calling" && (
          <button
            onClick={endCall}
            className="w-20 h-20 rounded-full bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-600/40 text-white animate-pulse"
          >
            <PhoneOff className="w-9 h-9" />
          </button>
        )}

        {callStatus === "connected" && (
          <>
            {/* Mute Mic Button */}
            <button
              onClick={toggleMute}
              className={`flex flex-col items-center gap-1.5 transition ${
                isMuted ? "text-amber-400" : "text-neutral-400 hover:text-white"
              }`}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center border transition ${
                  isMuted
                    ? "bg-amber-950/60 border-amber-500 text-amber-400"
                    : "bg-neutral-900 border-neutral-800"
                }`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </div>
              <span className="text-[11px] font-medium">{isMuted ? "Bisu" : "Mikrofon"}</span>
            </button>

            {/* End Call Button */}
            <button
              onClick={endCall}
              className="flex flex-col items-center gap-1.5 group transform active:scale-95 transition"
            >
              <div className="w-18 h-18 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-600/50 text-white">
                <PhoneOff className="w-8 h-8" />
              </div>
              <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
                Tutup
              </span>
            </button>

            {/* Speaker Toggle Button */}
            <button
              onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
              className={`flex flex-col items-center gap-1.5 transition ${
                isSpeakerMuted ? "text-amber-400" : "text-neutral-400 hover:text-white"
              }`}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center border transition ${
                  isSpeakerMuted
                    ? "bg-amber-950/60 border-amber-500 text-amber-400"
                    : "bg-neutral-900 border-neutral-800"
                }`}
              >
                {isSpeakerMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </div>
              <span className="text-[11px] font-medium">
                {isSpeakerMuted ? "Mute Suara" : "Speaker"}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
