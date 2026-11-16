"use client";

import React, { useState } from "react";
import { Check, Users } from "lucide-react";
import type { TeamPicker as TeamPickerData } from "@/lib/types";

interface TeamPickerProps {
  picker: TeamPickerData;
  /** Mengirim pilihan sebagai pesan chat ("Bentuk tim: ..."). */
  onPick?: (names: string[]) => void;
  /** Percakapan sudah lanjut: kolom tidak bisa dipakai lagi. */
  locked?: boolean;
}

/** Kolom ceklis tim di bawah hasil bedah ide. Yang disarankan sudah tercentang. */
export function TeamPicker({ picker, onPick, locked }: TeamPickerProps) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(picker.options.filter((o) => o.recommended).map((o) => o.kind)));
  const [sent, setSent] = useState(false);
  const disabled = locked || sent || !onPick;
  const chosen = picker.options.filter((o) => checked.has(o.kind));

  const toggle = (kind: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  return (
    <div className="mt-3 rounded-2xl border border-line bg-raised p-3 sm:p-4">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
        <Users className="w-4 h-4 text-accent" strokeWidth={1.75} aria-hidden="true" />
        Pilih tim untuk proyek ini
      </div>
      <p className="mt-1 text-[12px] text-fg-3">Yang sudah tercentang adalah saran. Centang atau hapus sesukamu.</p>

      <ul className="mt-3 space-y-1.5">
        {picker.options.map((o) => {
          const on = checked.has(o.kind);
          return (
            <li key={o.kind}>
              <label
                className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  on ? "border-accent/50 bg-accent/5" : "border-line hover:bg-hover"
                } ${disabled ? "opacity-70 cursor-default" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--accent)]"
                  checked={on}
                  disabled={disabled}
                  onChange={() => toggle(o.kind)}
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-fg">
                    {o.name}
                    {o.recommended && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">Disarankan</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-fg-3">{o.role}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] text-fg-3">
          {sent ? "Pilihan sudah dikirim." : locked ? "Percakapan sudah lanjut. Ketik \"bentuk tim\" kalau mau mengulang." : `${chosen.length} tim dipilih`}
        </span>
        {!locked && (
          <button
            type="button"
            disabled={disabled || chosen.length === 0}
            onClick={() => {
              setSent(true);
              onPick?.(chosen.map((o) => o.name));
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
            Bentuk tim{chosen.length ? ` (${chosen.length})` : ""}
          </button>
        )}
      </div>
    </div>
  );
}
