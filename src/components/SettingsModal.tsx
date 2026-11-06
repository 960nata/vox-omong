"use client";

import React, { useEffect, useState } from "react";
import { VoiceSettings } from "@/lib/types";
import { X, Volume2, Key, Sliders, Globe, Sparkles, Loader2 } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceSettings;
  onSave: (newSettings: VoiceSettings) => void;
  availableVoices: SpeechSynthesisVoice[];
}

export const NEURAL_VOICES = [
  // Indonesian & Nusantara Voices
  { id: "id-ID-GadisNeural", name: "🇮🇩 Gadis (Wanita · Modern, Ramah, Natural)", lang: "id-ID", desc: "Suara wanita paling populer, santai dan mirip manusia asli" },
  { id: "id-ID-ArdiNeural", name: "🇮🇩 Ardi (Pria · Tenang, Formal & Berwibawa)", lang: "id-ID", desc: "Suara pria profesional untuk presentasi dan bisnis" },
  { id: "jv-ID-SitiNeural", name: "🇮🇩 Siti (Wanita · Lembut & Santun - Jawa)", lang: "id-ID", desc: "Suara wanita halus dan menenangkan" },
  { id: "jv-ID-DimasNeural", name: "🇮🇩 Dimas (Pria · Bersahabat & Santai - Jawa)", lang: "id-ID", desc: "Karakter pria lokal bersahabat" },
  { id: "su-ID-TutiNeural", name: "🇮🇩 Tuti (Wanita · Ceria & Dinamis - Sunda)", lang: "id-ID", desc: "Karakter suara wanita ceria dan ekspresif" },
  { id: "su-ID-JajangNeural", name: "🇮🇩 Jajang (Pria · Hangat & Ramah - Sunda)", lang: "id-ID", desc: "Karakter pria hangat khas Nusantara" },
  { id: "ms-MY-YasminNeural", name: "🇮🇩 Yasmin (Wanita · Elegan & Jernih - Melayu)", lang: "id-ID", desc: "Suara wanita elegan dan jernih" },
  { id: "ms-MY-OsmanNeural", name: "🇮🇩 Osman (Pria · Tegas & Percaya Diri - Melayu)", lang: "id-ID", desc: "Suara pria dengan artikulasi tinggi" },

  // English Voices
  { id: "en-US-JennyNeural", name: "🇺🇸 Jenny (Female · Expressive & Natural)", lang: "en-US", desc: "Conversational everyday English" },
  { id: "en-US-GuyNeural", name: "🇺🇸 Guy (Male · Warm & Conversational)", lang: "en-US", desc: "Warm and engaging male tone" },
  { id: "en-US-AriaNeural", name: "🇺🇸 Aria (Female · Clear Assistant)", lang: "en-US", desc: "Crisp and helpful assistant tone" },
  { id: "en-US-ChristopherNeural", name: "🇺🇸 Christopher (Male · Dynamic Host)", lang: "en-US", desc: "Professional podcast and radio host" },
];

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
  availableVoices,
}: SettingsModalProps) {
  const [form, setForm] = useState<VoiceSettings>(settings);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const testVoice = async () => {
    if (isTesting) return;
    setIsTesting(true);

    const sampleText =
      form.language === "id-ID"
        ? "Halo! Ini adalah contoh suara alami manusia untuk asisten suaramu."
        : "Hello! This is a realistic human voice sample for your voice assistant.";

    try {
      if (form.ttsProvider === "neural") {
        // High fidelity Neural Voice API
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: sampleText,
            voice: form.neuralVoice || (form.language === "id-ID" ? "id-ID-GadisNeural" : "en-US-JennyNeural"),
            rate: form.rate,
            pitch: form.pitch,
          }),
        });

        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => setIsTesting(false);
          audio.onerror = () => setIsTesting(false);
          await audio.play();
          return;
        }
      }

      // Fallback to browser SpeechSynthesis
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(sampleText);
        utterance.lang = form.language;
        utterance.rate = form.rate;
        utterance.pitch = form.pitch;
        utterance.onend = () => setIsTesting(false);
        utterance.onerror = () => setIsTesting(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsTesting(false);
      }
    } catch (e) {
      console.error("Test voice failed:", e);
      setIsTesting(false);
    }
  };

  const filteredNeuralVoices = NEURAL_VOICES.filter((v) => v.lang === form.language);
  const filteredBrowserVoices = availableVoices.filter((v) => {
    if (form.language === "id-ID") return v.lang.startsWith("id") || v.lang.startsWith("in");
    return v.lang.startsWith("en");
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-[#14161b] border border-[#2e3340] rounded-[3px] p-6 shadow-2xl text-[#e4e6ea]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#252a35]">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#ea580c]" />
            <h2 className="text-base font-semibold tracking-wide text-[#f3f4f6]">
              Pengaturan Voice & AI Engine
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8b93a4] hover:text-[#f3f4f6] hover:bg-[#20242e] rounded-[3px] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-4 text-sm max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin">
          {/* TTS Engine Provider Mode */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-mono uppercase text-[#a1a7b5]">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#ea580c]" /> Mesin Suara (Voice Engine)
              </span>
              <span className="text-[10px] text-[#ea580c] bg-[#291b15] px-1.5 py-0.5 rounded-[2px] border border-[#ea580c]/30">
                {form.ttsProvider === "neural" ? "HUMAN QUALITY" : "LOCAL SYNTH"}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    ttsProvider: "neural",
                    neuralVoice: form.language === "id-ID" ? "id-ID-GadisNeural" : "en-US-JennyNeural",
                  })
                }
                className={`p-2.5 text-left rounded-[3px] border transition-colors ${
                  form.ttsProvider === "neural"
                    ? "bg-[#25201c] border-[#ea580c] text-[#f97316]"
                    : "bg-[#1b1e25] border-[#2e3442] text-[#9ca3af] hover:border-[#3e4657]"
                }`}
              >
                <div className="text-xs font-semibold">✨ Neural AI Voice</div>
                <div className="text-[10px] text-[#7d8699] mt-0.5">Alami, intonasi manusia, tidak kaku</div>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, ttsProvider: "browser" })}
                className={`p-2.5 text-left rounded-[3px] border transition-colors ${
                  form.ttsProvider === "browser"
                    ? "bg-[#25201c] border-[#ea580c] text-[#f97316]"
                    : "bg-[#1b1e25] border-[#2e3442] text-[#9ca3af] hover:border-[#3e4657]"
                }`}
              >
                <div className="text-xs font-semibold">🖥️ Browser Speech</div>
                <div className="text-[10px] text-[#7d8699] mt-0.5">Sintesis bawaan sistem operasi</div>
              </button>
            </div>
          </div>

          {/* Voice Character Selection */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-mono uppercase text-[#a1a7b5]">
              <Volume2 className="w-3.5 h-3.5 text-[#ea580c]" /> Karakter Suara
            </label>
            {form.ttsProvider === "neural" ? (
              <select
                value={form.neuralVoice}
                onChange={(e) => setForm({ ...form, neuralVoice: e.target.value })}
                className="w-full bg-[#1b1e25] border border-[#2e3442] focus:border-[#ea580c] rounded-[3px] px-3 py-2 text-xs text-[#f3f4f6] outline-hidden transition-colors"
              >
                {filteredNeuralVoices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={form.voiceURI}
                onChange={(e) => setForm({ ...form, voiceURI: e.target.value })}
                className="w-full bg-[#1b1e25] border border-[#2e3442] focus:border-[#ea580c] rounded-[3px] px-3 py-2 text-xs text-[#f3f4f6] outline-hidden transition-colors"
              >
                <option value="">Default Sistem Browser</option>
                {filteredBrowserVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Language Selection */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-mono uppercase text-[#a1a7b5]">
              <Globe className="w-3.5 h-3.5 text-[#ea580c]" /> Bahasa Percakapan
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    language: "id-ID",
                    neuralVoice: "id-ID-GadisNeural",
                  })
                }
                className={`py-2 px-3 text-xs font-medium rounded-[3px] border transition-colors ${
                  form.language === "id-ID"
                    ? "bg-[#25201c] border-[#ea580c] text-[#f97316]"
                    : "bg-[#1b1e25] border-[#2e3442] text-[#9ca3af] hover:border-[#3e4657]"
                }`}
              >
                🇮🇩 Bahasa Indonesia (id-ID)
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    language: "en-US",
                    neuralVoice: "en-US-JennyNeural",
                  })
                }
                className={`py-2 px-3 text-xs font-medium rounded-[3px] border transition-colors ${
                  form.language === "en-US"
                    ? "bg-[#25201c] border-[#ea580c] text-[#f97316]"
                    : "bg-[#1b1e25] border-[#2e3442] text-[#9ca3af] hover:border-[#3e4657]"
                }`}
              >
                🇺🇸 English (en-US)
              </button>
            </div>
          </div>

          {/* AI Gateway / Gemini API Key */}
          <div className="space-y-1.5 pt-1">
            <label className="flex items-center gap-1.5 text-xs font-mono uppercase text-[#a1a7b5]">
              <Key className="w-3.5 h-3.5 text-[#ea580c]" /> AI Gateway / Gemini Key
            </label>
            <input
              type="password"
              placeholder="aigw_... atau AIzaSy..."
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              className="w-full bg-[#1b1e25] border border-[#2e3442] focus:border-[#ea580c] rounded-[3px] px-3 py-2 text-xs text-[#f3f4f6] outline-hidden font-mono placeholder-[#586072] transition-colors"
            />
            <p className="text-[11px] text-[#788195]">
              Terhubung ke Unified AI Gateway (<span className="text-[#f97316]">aigw_51d1...</span>) dengan failover multi-LLM (Qwen / Gemini).
            </p>
          </div>

          {/* Pitch & Rate Sliders */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#a1a7b5]">
                <span>Kecepatan Bicara</span>
                <span className="font-mono text-[#f97316]">{form.rate.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.05"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) })}
                className="w-full accent-[#ea580c] bg-[#1e232c] h-1.5 rounded-[3px] cursor-pointer"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#a1a7b5]">
                <span>Nada Suara (Pitch)</span>
                <span className="font-mono text-[#f97316]">{form.pitch.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.05"
                value={form.pitch}
                onChange={(e) => setForm({ ...form, pitch: parseFloat(e.target.value) })}
                className="w-full accent-[#ea580c] bg-[#1e232c] h-1.5 rounded-[3px] cursor-pointer"
              />
            </div>
          </div>

          {/* Auto speak toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-[#252a35]">
            <div>
              <div className="font-medium text-xs text-[#e4e6ea]">Otomatis Membacakan Jawaban</div>
              <div className="text-[11px] text-[#788195]">AI langsung berbicara saat respon diterima</div>
            </div>
            <input
              type="checkbox"
              checked={form.autoSpeak}
              onChange={(e) => setForm({ ...form, autoSpeak: e.target.checked })}
              className="w-4 h-4 accent-[#ea580c] cursor-pointer"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-[#252a35]">
          <button
            type="button"
            onClick={testVoice}
            disabled={isTesting}
            className="px-3 py-2 text-xs font-mono tracking-wide bg-[#202530] hover:bg-[#2b3140] text-[#c0c6d4] rounded-[3px] border border-[#373e4f] transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ea580c]" /> : <Volume2 className="w-3.5 h-3.5 text-[#ea580c]" />}
            <span>{isTesting ? "Memutar..." : "Uji Suara"}</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs bg-[#1a1c22] hover:bg-[#222630] text-[#9ca3af] rounded-[3px] border border-[#2e3442] transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(form);
                onClose();
              }}
              className="px-4 py-2 text-xs font-medium bg-[#ea580c] hover:bg-[#f97316] text-white rounded-[3px] transition-colors shadow-sm"
            >
              Simpan Pengaturan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
