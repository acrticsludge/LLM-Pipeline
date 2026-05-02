import type { Message } from "@/lib/types";
import ResolutionCard from "./ResolutionCard";
import SourcesSection from "./SourcesSection";

interface Props {
  message: Message;
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

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

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

        {!message.isStreaming && message.resolution && (
          <div className="w-full max-w-none">
            <ResolutionCard resolution={message.resolution} />
          </div>
        )}

        {!message.isStreaming && message.sources && (
          <div className="px-1 w-full">
            <SourcesSection sources={message.sources} />
          </div>
        )}
      </div>
    </div>
  );
}
