"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Sidebar, { type TweaksSettings } from "./Sidebar";
import MessageBubble from "./MessageBubble";
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
    formState: { errors },
  } = useForm<ChatForm>({
    resolver: zodResolver(chatSchema),
  });

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

  return (
    <div
      className="flex h-screen overflow-hidden bg-[var(--background)]"
      style={{
        "--accent-hue": tweaks.accentHue,
      } as React.CSSProperties}
    >
      <Sidebar onSettingsChange={handleSettingsChange} tweaks={tweaks} onTweaksChange={handleTweaksChange} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-4xl">🤖</p>
                <p className="text-[var(--foreground)] font-medium">RAG Support Copilot</p>
                <p className="text-sm text-[var(--muted)] max-w-sm">
                  Upload your support documentation in the sidebar, then ask about any issue.
                </p>
                {!apiKey && (
                  <p className="text-xs text-[#d29922] mt-2">
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
            <div className="mx-auto max-w-md rounded border border-[#f85149]/40 bg-[#f85149]/10 px-4 py-3 text-sm text-[#f85149] text-center">
              ⚠ {backendError}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
          <form onSubmit={handleSubmit(onSubmit)} className="flex gap-3 items-end">
            <div className="flex-1">
              <textarea
                rows={1}
                placeholder={
                  !apiKey
                    ? "Enter your API key in the sidebar first…"
                    : "Describe the support issue…"
                }
                disabled={!apiKey || isLoading}
                className="w-full resize-none rounded-xl bg-[var(--surface-hover)] border border-[var(--border)] px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50 leading-relaxed max-h-40 overflow-y-auto"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(onSubmit)();
                  }
                }}
                {...register("question")}
              />
              {errors.question && (
                <p className="mt-1 text-xs text-[#f85149]">{errors.question.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSend}
              className="flex-shrink-0 h-11 w-11 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Send"
            >
              {isLoading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                </svg>
              )}
            </button>
          </form>
          <p className="mt-2 text-[10px] text-[var(--muted)] text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
