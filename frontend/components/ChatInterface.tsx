"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Sidebar, { type TweaksSettings } from "./Sidebar";
import MessageBubble from "./MessageBubble";
import RAGStatusPanel from "./RAGStatusPanel";
import { streamSSE } from "@/lib/sse";
import { getQueryUrl } from "@/lib/api";
import type { Message, RetrievalLogEntry } from "@/lib/types";

const chatSchema = z.object({
  question: z.string().min(1),
});
type ChatForm = z.infer<typeof chatSchema>;

const FOLLOWUP_TEMPLATES: Record<string, string[]> = {
  DEFAULT: [
    "Can you provide more details?",
    "Have you checked the documentation?",
    "What have you already tried?",
  ],
};

function generateFollowUps(): string[] {
  const defaults = FOLLOWUP_TEMPLATES.DEFAULT;
  return defaults.slice(0, Math.min(2 + Math.floor(Math.random() * 2), defaults.length));
}

function generateRetrievalLog(): RetrievalLogEntry[] {
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  const latency = 120 + Math.floor(Math.random() * 200);
  const chunks = 2 + Math.floor(Math.random() * 4);
  const score = 72 + Math.floor(Math.random() * 24);

  return [
    { time: ts, action: "Query embedded → vector search", score, chunks: null, latency: null },
    { time: ts, action: `Retrieving ${chunks} relevant chunks`, score: null, chunks, latency },
    { time: ts, action: "Context prepared → DeepSeek-R1 inference", score: null, chunks: null, latency: null },
  ];
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [strict, setStrict] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "up" | "down">>({});
  const [tweaks, setTweaks] = useState<TweaksSettings>({
    accentHue: 55,
    fontSize: 13,
    showSources: true,
    showRetrieval: true,
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ChatForm>({
    resolver: zodResolver(chatSchema),
  });

  const question = watch("question") || "";

  const handleSettingsChange = useCallback((key: string, strictMode: boolean) => {
    setApiKey(key);
    setStrict(strictMode);
  }, []);

  const handleTweaksChange = useCallback((newTweaks: TweaksSettings) => {
    setTweaks(newTweaks);
    if (typeof window !== "undefined") {
      localStorage.setItem("copilot_tweaks", JSON.stringify(newTweaks));
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("copilot_tweaks");
      if (saved) {
        try {
          setTweaks(JSON.parse(saved));
        } catch {
          // ignore
        }
      }
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent-hue", tweaks.accentHue.toString());
    root.style.setProperty("font-size", `${tweaks.fontSize}px`);
  }, [tweaks]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function onSubmit({ question }: ChatForm) {
    if (!apiKey) return;
    setBackendError(null);
    reset();

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };

    const assistantId = crypto.randomUUID();
    const retrievalLog = tweaks.showRetrieval ? generateRetrievalLog() : [];
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      isStreaming: true,
      retrievalLog,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);

    try {
      for await (const event of streamSSE(getQueryUrl(), {
        question,
        strict,
        api_key: apiKey,
      })) {
        if (event.type === "chunk") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + event.content }
                : m
            )
          );
        } else if (event.type === "final") {
          if (event.is_ticket === false) {
            const followUps = generateFollowUps();
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      isStreaming: false,
                      content: event.message,
                      isNonTicket: true,
                      corrected_query: event.corrected_query,
                      followUps,
                      retrievalLog,
                    }
                  : m
              )
            );
          } else {
            const followUps = generateFollowUps();
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      isStreaming: false,
                      resolution: tweaks.showSources ? event.resolution : event.resolution,
                      sources: tweaks.showSources ? event.sources : undefined,
                      corrected_query: event.corrected_query,
                      isNonTicket: false,
                      followUps,
                      retrievalLog,
                    }
                  : m
              )
            );
          }
        } else if (event.type === "error") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, isStreaming: false, error: event.message }
                : m
            )
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Backend unreachable";
      setBackendError(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, isStreaming: false, error: msg }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  const handleFeedback = (messageId: string, type: "up" | "down") => {
    if (!feedbackMap[messageId]) {
      setFeedbackMap((prev) => ({ ...prev, [messageId]: type }));
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback: type } : m))
      );
    }
  };

  const handleFollowUp = (question: string) => {
    onSubmit({ question });
  };

  const canSend = !!apiKey && !isLoading;
  const currentLog = (messages.length > 0 && messages[messages.length - 1]?.retrievalLog) || [];

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: '"IBM Plex Mono", monospace',
        background: "#0f0f0f",
        "--accent-hue": tweaks.accentHue,
      } as React.CSSProperties}
    >
      {/* Top bar */}
      <div
        style={{
          height: 44,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          background: "#161616",
          borderBottom: "1px solid #2a2a2a",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 24,
              height: 24,
              background: "var(--accent, #ffd700)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 700, color: "#0f0f0f", letterSpacing: "0.05em" }}>
              SC
            </span>
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                color: "#e8e4df",
                letterSpacing: "0.06em",
                fontWeight: 500,
              }}
            >
              SUPPORT COPILOT
            </div>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {["DEEPSEEK-R1", "CHROMA DB"].map((engine, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#44ff44",
                  boxShadow: "0 0 5px #44ff44",
                }}
              />
              <span style={{ fontSize: 9, color: "#454037", letterSpacing: "0.08em" }}>
                {engine}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar */}
        <Sidebar onSettingsChange={handleSettingsChange} tweaks={tweaks} onTweaksChange={handleTweaksChange} />

        {/* Chat column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  display: "flex",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>🤖</p>
                  <p
                    style={{
                      color: "#e8e4df",
                      fontWeight: 500,
                      fontSize: 14,
                      marginBottom: 8,
                    }}
                  >
                    RAG Support Copilot
                  </p>
                  <p style={{ color: "#b0ab9f", fontSize: 12, maxWidth: 320, lineHeight: 1.5 }}>
                    Upload your support documentation in the sidebar, then ask about any issue.
                  </p>
                  {!apiKey && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "#ffaa00",
                        marginTop: 16,
                      }}
                    >
                      ⚠ Enter your Hugging Face API key in the sidebar to get started.
                    </p>
                  )}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onFeedback={handleFeedback}
                onFollowUp={handleFollowUp}
              />
            ))}

            {backendError && (
              <div
                style={{
                  background: "#ff444426",
                  border: "1px solid #ff444440",
                  padding: "8px 12px",
                  fontSize: 10,
                  color: "#ff4444",
                  textAlign: "center",
                  maxWidth: 320,
                  margin: "0 auto",
                }}
              >
                ⚠ {backendError}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div
            style={{
              background: "#161616",
              borderTop: "1px solid #2a2a2a",
              padding: "12px 24px 14px",
            }}
          >
            <form onSubmit={handleSubmit(onSubmit)}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-end",
                  background: "#1e1e1e",
                  border: "1px solid #3a3a3a",
                  padding: "10px 12px",
                  transition: "border-color 0.2s",
                }}
              >
                <textarea
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(onSubmit)();
                    }
                    e.currentTarget.style.height = "auto";
                    e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 120) + "px";
                  }}
                  placeholder={
                    !apiKey
                      ? "Enter your API key in the sidebar first…"
                      : "Describe the support issue…"
                  }
                  disabled={!apiKey || isLoading}
                  rows={1}
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    outline: "none",
                    resize: "none",
                    color: "#e8e4df",
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: tweaks.fontSize,
                    lineHeight: 1.55,
                    maxHeight: 120,
                    overflowY: "auto",
                    opacity: !apiKey || isLoading ? 0.5 : 1,
                  }}
                  {...register("question")}
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  style={{
                    width: 30,
                    height: 30,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: canSend ? "var(--accent, #ffd700)" : "#2e2e2e",
                    border: "none",
                    cursor: canSend ? "pointer" : "default",
                    color: canSend ? "#0f0f0f" : "#454037",
                    transition: "all 0.15s",
                    flexShrink: 0,
                  }}
                >
                  {isLoading ? (
                    <svg
                      style={{
                        width: 16,
                        height: 16,
                        animation: "spin 1s linear infinite",
                      }}
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="2"
                        opacity="0.25"
                      />
                      <path
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                        opacity="0.75"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 14 14" width="12" height="12" fill="currentColor">
                      <path d="M1 1L13 7L1 13V8.5L9 7L1 5.5V1Z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.question && (
                <p style={{ marginTop: 4, fontSize: 9, color: "#ff4444" }}>
                  {errors.question.message}
                </p>
              )}
            </form>
            <div style={{ marginTop: 5, display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 9, color: "#454037" }}>Enter to send</span>
              <span style={{ fontSize: 9, color: "#454037" }}>·</span>
              <span style={{ fontSize: 9, color: "#454037" }}>Shift+Enter for new line</span>
            </div>
          </div>
        </div>

        {/* RAG Panel */}
        {tweaks.showRetrieval && <RAGStatusPanel log={currentLog} />}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
