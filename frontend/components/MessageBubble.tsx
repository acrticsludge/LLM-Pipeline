"use client";

import { useState } from "react";
import type { Message } from "@/lib/types";
import ResolutionCard from "./ResolutionCard";
import SourcesSection from "./SourcesSection";

interface Props {
  message: Message;
  onFeedback?: (messageId: string, type: "up" | "down") => void;
  onFollowUp?: (question: string) => void;
}

function TypingDots() {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "var(--accent, #ffd700)",
            animation: `bounce 1.2s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export default function MessageBubble({ message, onFeedback, onFollowUp }: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    let text = "";
    if (message.resolution) {
      text = `Cause: ${message.resolution.possible_cause}\n\nSteps:\n`;
      message.resolution.recommended_steps.forEach((step, i) => {
        text += `${i + 1}. ${step}\n`;
      });
    } else if (message.content) {
      text = message.content;
    }
    if (text) {
      await copyToClipboard(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleFeedback = (type: "up" | "down") => {
    if (onFeedback && !message.feedback) {
      onFeedback(message.id, type);
      console.log(`Feedback recorded: message ${message.id}, type: ${type}`);
    }
  };

  const handleFollowUp = (question: string) => {
    if (onFollowUp) {
      onFollowUp(question);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", padding: "4px 0" }}>
      <div style={{ maxWidth: isUser ? "72%" : "90%" }}>
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.12em",
            color: "#454037",
            fontFamily: '"IBM Plex Mono", monospace',
            marginBottom: 4,
            textTransform: "uppercase",
            textAlign: isUser ? "right" : "left",
          }}
        >
          {isUser ? "YOU" : "COPILOT"}
        </div>

        {isUser ? (
          <div
            style={{
              background: "var(--accent, #ffd700)",
              color: "#0f0f0f",
              padding: "9px 13px",
              fontSize: 12,
              lineHeight: 1.6,
              fontFamily: '"IBM Plex Mono", monospace',
              fontWeight: 500,
            }}
          >
            {message.content}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {message.isStreaming && !message.content ? (
              <div
                style={{
                  background: "#1e1e1e",
                  border: "1px solid #2a2a2a",
                  padding: "10px 14px",
                }}
              >
                <TypingDots />
              </div>
            ) : (
              <>
                {message.content && (
                  <div
                    style={{
                      background: "#1e1e1e",
                      border: "1px solid #2a2a2a",
                      padding: "9px 13px",
                      fontSize: 12,
                      lineHeight: 1.65,
                      color: "#e8e4df",
                      fontFamily: '"IBM Plex Mono", monospace',
                      maxWidth: "90%",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {message.content}
                  </div>
                )}
              </>
            )}

            {message.isStreaming && message.content && (
              <span
                style={{
                  display: "inline-block",
                  width: 2,
                  height: 16,
                  background: "var(--accent, #ffd700)",
                  animation: "pulse 1s infinite",
                  marginLeft: 4,
                }}
              />
            )}

            {message.error && (
              <div
                style={{
                  background: "#ff444426",
                  border: "1px solid #ff444440",
                  padding: "6px 10px",
                  fontSize: 10,
                  color: "#ff4444",
                  fontFamily: '"IBM Plex Mono", monospace',
                }}
              >
                ⚠ {message.error}
              </div>
            )}

            {message.corrected_query && (
              <div
                style={{
                  fontSize: 9,
                  color: "#454037",
                  fontFamily: '"IBM Plex Mono", monospace',
                }}
              >
                Searched as:{" "}
                <span style={{ color: "var(--accent, #ffd700)" }}>
                  {message.corrected_query}
                </span>
              </div>
            )}

            {!message.isStreaming && message.isNonTicket && (
              <div
                style={{
                  background: "#0066ff26",
                  border: "1px solid #0066ff40",
                  padding: "8px 12px",
                  maxWidth: "90%",
                }}
              >
                <div style={{ display: "flex", gap: 6 }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    style={{ flexShrink: 0, marginTop: 2, color: "#0066ff" }}
                  >
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
                    <path
                      d="M7 5v3M7 9v.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#0066ff",
                      fontFamily: '"IBM Plex Mono", monospace',
                      lineHeight: 1.5,
                    }}
                  >
                    {message.content}
                  </span>
                </div>
              </div>
            )}

            {!message.isStreaming && !message.isNonTicket && message.resolution && (
              <div style={{ maxWidth: "92%" }}>
                <ResolutionCard resolution={message.resolution} />
              </div>
            )}

            {!message.isStreaming && !message.isNonTicket && message.sources && (
              <div>
                <SourcesSection sources={message.sources} />
              </div>
            )}

            {!message.isStreaming && !isUser && (message.resolution || message.content) && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 2 }}>
                <button
                  onClick={handleCopy}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: copied ? "#44ff44" : "#454037",
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: 10,
                    padding: "2px 4px",
                    transition: "color 0.15s",
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  >
                    <rect x="4" y="4" width="7" height="7" rx="1" />
                    <path d="M8 4V2.5A.5.5 0 0 0 7.5 2H2.5A.5.5 0 0 0 2 2.5V7.5A.5.5 0 0 0 2.5 8H4" />
                  </svg>
                  {copied ? "copied" : "copy"}
                </button>

                <div style={{ width: 1, height: 10, background: "#3a3a3a" }} />

                <button
                  onClick={() => handleFeedback("up")}
                  disabled={!!message.feedback}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    background: "none",
                    border: "none",
                    cursor: message.feedback ? "default" : "pointer",
                    color: message.feedback === "up" ? "#44ff44" : "#454037",
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: 10,
                    padding: "2px 4px",
                    transition: "color 0.15s",
                    opacity: message.feedback && message.feedback !== "up" ? 0.5 : 1,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                    <path d="M4 10H8.5C9 10 9.5 9.6 9.6 9.1L10.5 5.6C10.7 4.9 10.2 4.2 9.5 4.2H7V2.5C7 2 6.7 1.8 6.5 1.8L4 5V10Z" />
                    <path d="M2.5 10H4V5H2.5C2.2 5 2 5.2 2 5.5V9.5C2 9.8 2.2 10 2.5 10Z" />
                  </svg>
                  helpful
                </button>

                <button
                  onClick={() => handleFeedback("down")}
                  disabled={!!message.feedback}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    background: "none",
                    border: "none",
                    cursor: message.feedback ? "default" : "pointer",
                    color: message.feedback === "down" ? "#ff4444" : "#454037",
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: 10,
                    padding: "2px 4px",
                    transition: "color 0.15s",
                    opacity: message.feedback && message.feedback !== "down" ? 0.5 : 1,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                    <path d="M8 2H3.5C3 2 2.5 2.4 2.4 2.9L1.5 6.4C1.3 7.1 1.8 7.8 2.5 7.8H5V9.5C5 10 5.3 10.2 5.5 10.2L8 7V2Z" />
                    <path d="M9.5 2H8V7H9.5C9.8 7 10 6.8 10 6.5V2.5C10 2.2 9.8 2 9.5 2Z" />
                  </svg>
                  not helpful
                </button>
              </div>
            )}

            {!message.isStreaming && message.followUps && message.followUps.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingTop: 2 }}>
                {message.followUps.map((question, i) => (
                  <button
                    key={i}
                    onClick={() => handleFollowUp(question)}
                    style={{
                      background: "none",
                      border: "1px solid #3a3a3a",
                      color: "#6e6861",
                      fontFamily: '"IBM Plex Mono", monospace',
                      fontSize: 10,
                      padding: "4px 9px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.borderColor = "var(--accent, #ffd700)";
                      (e.target as HTMLElement).style.color = "var(--accent, #ffd700)";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.borderColor = "#3a3a3a";
                      (e.target as HTMLElement).style.color = "#6e6861";
                    }}
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
