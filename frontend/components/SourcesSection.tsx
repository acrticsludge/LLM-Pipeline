"use client";

import type { Source } from "@/lib/types";

interface Props {
  sources: Source[];
}

export default function SourcesSection({ sources }: Props) {
  if (sources.length === 0) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.1em",
          color: "#454037",
          fontFamily: '"IBM Plex Mono", monospace',
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        RETRIEVED SOURCES
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {sources.map((src, i) => (
          <span
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              fontSize: 10,
              color: "#6e6861",
              background: "#262626",
              border: "1px solid #3a3a3a",
              fontFamily: '"IBM Plex Mono", monospace',
              cursor: "default",
              borderRadius: 2,
            }}
            title={src.content}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M4 3v2M4 5.5v.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            {src.filename}
          </span>
        ))}
      </div>
    </div>
  );
}
