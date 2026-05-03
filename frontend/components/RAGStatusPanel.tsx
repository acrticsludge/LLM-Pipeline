"use client";

import { useEffect, useRef } from "react";
import type { RetrievalLogEntry } from "@/lib/types";

interface Props {
  log: RetrievalLogEntry[];
}

export default function RAGStatusPanel({ log }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log]);

  const queryCount = log.filter((e) => e.chunks != null).length;
  const scoreEntries = log.filter((e) => e.score != null);
  const avgScore =
    scoreEntries.length > 0
      ? Math.round(scoreEntries.reduce((a, b) => a + (b.score || 0), 0) / scoreEntries.length)
      : 0;

  return (
    <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-hover)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          RAG Retrieval Log
        </p>
      </div>

      <div
        ref={scrollRef}
        className="h-40 overflow-y-auto space-y-1 p-3 text-xs font-mono text-[var(--muted)]"
      >
        {log.length === 0 ? (
          <p className="text-[var(--muted)] text-center py-8">No retrievals yet</p>
        ) : (
          log.map((entry, i) => (
            <div key={i} className="flex gap-2 text-[10px]">
              <span className="text-[var(--muted)]">[{entry.time}]</span>
              <span className="text-[var(--foreground)]">{entry.action}</span>
              {entry.score != null && <span className="text-[#3fb950]">{entry.score}%</span>}
              {entry.chunks != null && <span className="text-[#58a6ff]">{entry.chunks} chunks</span>}
              {entry.latency != null && <span className="text-[#d29922]">{entry.latency}ms</span>}
            </div>
          ))
        )}
      </div>

      {log.length > 0 && (
        <div className="px-3 py-2 border-t border-[var(--border)] bg-[var(--surface-hover)] text-[10px] text-[var(--muted)]">
          <div className="flex justify-between">
            <span>Queries: {queryCount}</span>
            <span>Avg confidence: {avgScore}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
