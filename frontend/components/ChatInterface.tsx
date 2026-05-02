"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Sidebar from "./Sidebar";
import MessageBubble from "./MessageBubble";
import { streamSSE } from "@/lib/sse";
import { getQueryUrl } from "@/lib/api";
import type { Message } from "@/lib/types";

const chatSchema = z.object({
  question: z.string().min(1),
});
type ChatForm = z.infer<typeof chatSchema>;

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [strict, setStrict] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
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
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      isStreaming: true,
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
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    isStreaming: false,
                    resolution: event.resolution,
                    sources: event.sources,
                    corrected_query: event.corrected_query,
                  }
                : m
            )
          );
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

  const canSend = !!apiKey && !isLoading;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <Sidebar onSettingsChange={handleSettingsChange} />

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
            <MessageBubble key={msg.id} message={msg} />
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
