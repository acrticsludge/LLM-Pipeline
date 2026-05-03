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
    <div
      style={{
        width: 280,
        flexShrink: 0,
        background: "#161616",
        borderLeft: "1px solid #2a2a2a",
        display: "flex",
        flexDirection: "column",
        fontFamily: '"IBM Plex Mono", monospace',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid #2a2a2a",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ color: "var(--accent, #ffd700)", display: "flex", fontSize: 14 }}>⊙</span>
        <span style={{ fontSize: 10, color: "#b0ab9f", letterSpacing: "0.08em" }}>
          RETRIEVAL LOG
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#44ff44",
              boxShadow: "0 0 4px #44ff44",
            }}
          />
          <span style={{ fontSize: 9, color: "#454037" }}>LIVE</span>
        </div>
      </div>

      {/* Engine badges */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a2a", display: "flex", gap: 6 }}>
        {["DEEPSEEK-R1", "CHROMA DB"].map((engine) => (
          <div
            key={engine}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 8px",
              border: "1px solid #3a3a3a",
              color: "#6e6861",
              fontSize: 9,
              letterSpacing: "0.07em",
            }}
          >
            {engine}
          </div>
        ))}
      </div>

      {/* Log entries */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {log.length === 0 && (
          <div style={{ color: "#454037", fontSize: 10, paddingTop: 8 }}>
            Waiting for query…
          </div>
        )}
        {log.map((entry, i) => (
          <div key={i} style={{ borderLeft: "2px solid var(--accent-mid, rgba(255,215,0,0.35))", paddingLeft: 8 }}>
            <div style={{ fontSize: 9, color: "#454037", marginBottom: 2 }}>
              {entry.time}
            </div>
            <div style={{ fontSize: 10, color: "#b0ab9f", marginBottom: 3, lineHeight: 1.5 }}>
              {entry.action}
            </div>
            {entry.score != null && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 9, color: "#454037" }}>score</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: "#2e2e2e",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        height: "100%",
                        width: `${entry.score}%`,
                        background: "#44ff44",
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: "#44ff44",
                      fontFamily: '"IBM Plex Mono", monospace',
                      minWidth: 32,
                      textAlign: "right",
                    }}
                  >
                    {entry.score}%
                  </span>
                </div>
              </div>
            )}
            {entry.chunks != null && (
              <div style={{ fontSize: 9, color: "#454037", marginTop: 2 }}>
                {entry.chunks} chunks · {entry.latency}ms
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer stats */}
      {log.length > 0 && (
        <div style={{ padding: "10px 14px", borderTop: "1px solid #2a2a2a", display: "flex", gap: 14 }}>
          {[
            { label: "QUERIES", val: queryCount },
            { label: "AVG SCORE", val: avgScore > 0 ? avgScore + "%" : "—" },
            { label: "MODEL", val: "R1" },
          ].map((stat) => (
            <div key={stat.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 8, color: "#454037", letterSpacing: "0.1em" }}>
                {stat.label}
              </span>
              <span style={{ fontSize: 13, color: "var(--accent, #ffd700)", fontWeight: 500 }}>
                {stat.val}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
