import type { Resolution, Urgency, Sentiment } from "@/lib/types";

const urgencyConfig: Record<Urgency, { label: string; color: string }> = {
  critical: { label: "CRITICAL", color: "bg-[#f85149]/20 text-[#f85149] border-[#f85149]/40" },
  high:     { label: "HIGH",     color: "bg-[#d29922]/20 text-[#d29922] border-[#d29922]/40" },
  medium:   { label: "MEDIUM",   color: "bg-[#58a6ff]/20 text-[#58a6ff] border-[#58a6ff]/40" },
  low:      { label: "LOW",      color: "bg-[#3fb950]/20 text-[#3fb950] border-[#3fb950]/40" },
};

const sentimentEmoji: Record<Sentiment, string> = {
  positive: "😊",
  neutral:  "😐",
  negative: "😟",
};

interface Props {
  resolution: Resolution;
}

export default function ResolutionCard({ resolution }: Props) {
  const urgency = urgencyConfig[resolution.urgency] ?? urgencyConfig.medium;
  const emoji = sentimentEmoji[resolution.sentiment] ?? "😐";

  return (
    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--surface-hover)]">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${urgency.color}`}>
          {urgency.label}
        </span>
        <span className="text-lg" title={`Sentiment: ${resolution.sentiment}`}>{emoji}</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
            Possible Cause
          </p>
          <p className="text-sm text-[var(--foreground)]">{resolution.possible_cause}</p>
        </div>

        {resolution.recommended_steps.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
              Recommended Steps
            </p>
            <ol className="space-y-1">
              {resolution.recommended_steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="flex-shrink-0 text-[var(--accent)] font-mono">{i + 1}.</span>
                  <span className="text-[var(--foreground)]">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {resolution.disclaimer && (
          <div className="rounded border border-[#d29922]/40 bg-[#d29922]/10 px-3 py-2">
            <p className="text-xs text-[#d29922]">⚠ {resolution.disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
