import { useState } from "react";
import type { Resolution, Urgency } from "@/lib/types";

const urgencyMap: Record<Urgency, { label: string; color: string }> = {
  critical: { label: "CRITICAL", color: "#ff4444" },
  high: { label: "HIGH", color: "#ffaa00" },
  medium: { label: "MEDIUM", color: "#5588ff" },
  low: { label: "LOW", color: "#44ff44" },
};

interface Props {
  resolution: Resolution;
}

export default function ResolutionCard({ resolution }: Props) {
  const [expanded, setExpanded] = useState(true);
  const urgency = urgencyMap[resolution.urgency];

  return (
    <div
      style={{
        background: "#1e1e1e",
        border: "1px solid #3a3a3a",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: "1px solid #2a2a2a",
          cursor: "pointer",
          background: "#262626",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 7px",
            fontSize: 9,
            letterSpacing: "0.1em",
            fontWeight: 600,
            fontFamily: '"IBM Plex Mono", monospace',
            color: urgency.color,
            background: urgency.color + "26",
            border: `1px solid ${urgency.color}40`,
            textTransform: "uppercase",
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: urgency.color }} />
          {urgency.label}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "#6e6861",
            fontFamily: '"IBM Plex Mono", monospace',
            marginLeft: "auto",
          }}
        >
          RESOLUTION
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            stroke: "currentColor",
            color: "#b0ab9f",
          }}
        >
          <path d="M2 4L5 7L8 4" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>

      {expanded && (
        <div style={{ padding: "12px 12px 10px" }}>
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                color: "#454037",
                fontFamily: '"IBM Plex Mono", monospace',
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              POSSIBLE CAUSE
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#b0ab9f",
                lineHeight: 1.6,
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            >
              {resolution.possible_cause}
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                color: "#454037",
                fontFamily: '"IBM Plex Mono", monospace',
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              RECOMMENDED STEPS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {resolution.recommended_steps.map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--accent, #ffd700)",
                      fontFamily: '"IBM Plex Mono", monospace',
                      minWidth: 14,
                      paddingTop: 1,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#b0ab9f",
                      lineHeight: 1.55,
                      fontFamily: '"IBM Plex Mono", monospace',
                    }}
                  >
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {resolution.disclaimer && (
            <div
              style={{
                background: "#ffaa0026",
                border: "1px solid #ffaa0040",
                padding: "6px 10px",
                marginTop: 10,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: "#ffaa00",
                  fontFamily: '"IBM Plex Mono", monospace',
                }}
              >
                ⚠ {resolution.disclaimer}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
