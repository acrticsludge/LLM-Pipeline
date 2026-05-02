"use client";

import { useState } from "react";
import type { Source } from "@/lib/types";

interface Props {
  sources: Source[];
}

export default function SourcesSection({ sources }: Props) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
      >
        <span className="font-mono">{open ? "▾" : "▸"}</span>
        {sources.length} source{sources.length !== 1 ? "s" : ""} retrieved
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {sources.map((src, i) => (
            <div
              key={i}
              className="rounded border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-[var(--accent)] truncate max-w-[70%]">
                  {src.filename}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    src.score >= 0.7
                      ? "text-[#3fb950]"
                      : src.score >= 0.4
                      ? "text-[#d29922]"
                      : "text-[#f85149]"
                  }`}
                >
                  {(src.score * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] line-clamp-3 leading-relaxed">
                {src.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
