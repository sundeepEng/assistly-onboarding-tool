"use client";

import { Clock, Sparkles } from "lucide-react";

export default function ComingSoonCard() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="relative w-full max-w-md mx-auto">
        <div className="absolute -inset-1 rounded-2xl bg-[#5B5FC7]/10 blur-xl" />

        <div className="relative rounded-2xl border border-[#5B5FC7]/15 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#5B5FC7]/10">
            <Sparkles className="h-7 w-7 text-[#5B5FC7]" />
          </div>

          <h2 className="text-xl font-semibold tracking-tight text-[#111827]">
            Coming Soon
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
            {"We're working hard to bring you a powerful dashboard experience. Stay tuned for updates."}
          </p>

          <div className="my-6 h-px w-full bg-[#E5E7EB]" />

          <div className="flex items-center justify-center gap-2 text-xs text-[#6B7280]">
            <Clock className="h-3.5 w-3.5" />
            <span>Under active development</span>
            <span className="relative ml-1 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5B5FC7]/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#5B5FC7]" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
