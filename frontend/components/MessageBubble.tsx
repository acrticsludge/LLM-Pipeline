"use client";

import { useState } from "react";
import type { Message } from "@/lib/types";
import ResolutionCard from "./ResolutionCard";
import SourcesSection from "./SourcesSection";
import RAGStatusPanel from "./RAGStatusPanel";

interface Props {
  message: Message;
  onFeedback?: (messageId: string, type: "up" | "down") => void;
  onFollowUp?: (question: string) => void;
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
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
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)] mb-1 px-1">
          {isUser ? "You" : "Copilot"}
        </span>

        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-[var(--user-bubble)] text-white rounded-tr-sm"
              : "bg-[var(--assistant-bubble)] border border-[var(--border)] text-[var(--foreground)] rounded-tl-sm"
          }`}
        >
          {message.isStreaming && !message.content ? (
            <TypingDots />
          ) : (
            <span className="whitespace-pre-wrap">{message.content}</span>
          )}
          {message.isStreaming && message.content && (
            <span className="inline-block w-0.5 h-4 bg-[var(--accent)] animate-pulse ml-0.5 align-middle" />
          )}
        </div>

        {message.error && (
          <div className="mt-2 rounded border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2 text-xs text-[#f85149]">
            ⚠ {message.error}
          </div>
        )}

        {message.corrected_query && (
          <p className="mt-1 px-1 text-xs text-[var(--muted)] italic">
            Searched as:{" "}
            <span className="text-[var(--accent)]">{message.corrected_query}</span>
          </p>
        )}

        {!message.isStreaming && message.isNonTicket && (
          <div className="mt-3 w-full max-w-none rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-4">
            <div className="flex gap-2">
              <svg
                className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-blue-900 dark:text-blue-100">{message.content}</p>
            </div>
          </div>
        )}

        {!message.isStreaming && !message.isNonTicket && message.resolution && (
          <div className="w-full max-w-none">
            <ResolutionCard resolution={message.resolution} />
          </div>
        )}

        {!message.isStreaming && !message.isNonTicket && message.sources && (
          <div className="px-1 w-full">
            <SourcesSection sources={message.sources} />
          </div>
        )}

        {!message.isStreaming && !isUser && (message.resolution || message.content) && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                copied
                  ? "text-[#3fb950]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
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
              {copied ? "Copied" : "Copy"}
            </button>

            <div className="w-px bg-[var(--border)]" />

            <button
              onClick={() => handleFeedback("up")}
              disabled={!!message.feedback}
              className={`flex items-center gap-1 px-2 py-1.5 rounded transition-colors ${
                message.feedback === "up"
                  ? "text-[#3fb950]"
                  : message.feedback
                  ? "text-[var(--muted)] opacity-50 cursor-default"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                <path d="M4 10H8.5C9 10 9.5 9.6 9.6 9.1L10.5 5.6C10.7 4.9 10.2 4.2 9.5 4.2H7V2.5C7 2 6.7 1.8 6.5 1.8L4 5V10Z" />
                <path d="M2.5 10H4V5H2.5C2.2 5 2 5.2 2 5.5V9.5C2 9.8 2.2 10 2.5 10Z" />
              </svg>
              Helpful
            </button>

            <button
              onClick={() => handleFeedback("down")}
              disabled={!!message.feedback}
              className={`flex items-center gap-1 px-2 py-1.5 rounded transition-colors ${
                message.feedback === "down"
                  ? "text-[#f85149]"
                  : message.feedback
                  ? "text-[var(--muted)] opacity-50 cursor-default"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                <path d="M8 2H3.5C3 2 2.5 2.4 2.4 2.9L1.5 6.4C1.3 7.1 1.8 7.8 2.5 7.8H5V9.5C5 10 5.3 10.2 5.5 10.2L8 7V2Z" />
                <path d="M9.5 2H8V7H9.5C9.8 7 10 6.8 10 6.5V2.5C10 2.2 9.8 2 9.5 2Z" />
              </svg>
              Not helpful
            </button>
          </div>
        )}

        {!message.isStreaming && message.followUps && message.followUps.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.followUps.map((question, i) => (
              <button
                key={i}
                onClick={() => handleFollowUp(question)}
                className="px-3 py-1.5 text-xs rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        )}

        {!message.isStreaming && message.retrievalLog && message.retrievalLog.length > 0 && (
          <div className="w-full max-w-none mt-3">
            <RAGStatusPanel log={message.retrievalLog} />
          </div>
        )}
      </div>
    </div>
  );
}
