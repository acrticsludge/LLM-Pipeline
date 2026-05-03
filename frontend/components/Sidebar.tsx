"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ingestFiles, fetchStatus } from "@/lib/api";
import type { StatusResponse } from "@/lib/types";

const settingsSchema = z.object({
  apiKey: z.string().min(1, "API key required"),
});
type SettingsForm = z.infer<typeof settingsSchema>;

export interface TweaksSettings {
  accentHue: number;
  fontSize: number;
  showSources: boolean;
  showRetrieval: boolean;
}

interface Props {
  onSettingsChange: (apiKey: string, strict: boolean) => void;
  tweaks?: TweaksSettings;
  onTweaksChange?: (tweaks: TweaksSettings) => void;
}

export default function Sidebar({ onSettingsChange, tweaks, onTweaksChange }: Props) {
  const [strict, setStrict] = useState(false);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [ingestState, setIngestState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [ingestMessage, setIngestMessage] = useState("");
  const [localTweaks, setLocalTweaks] = useState<TweaksSettings>(
    tweaks || {
      accentHue: 55,
      fontSize: 13,
      showSources: true,
      showRetrieval: true,
    }
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const updateTweak = (key: keyof TweaksSettings, value: any) => {
    const updated = { ...localTweaks, [key]: value };
    setLocalTweaks(updated);
    onTweaksChange?.(updated);
  };

  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { apiKey: "" },
  });

  useEffect(() => {
    const saved = localStorage.getItem("hf_api_key") ?? "";
    if (saved) setValue("apiKey", saved);
  }, [setValue]);

  const apiKey = watch("apiKey");

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("hf_api_key", apiKey);
    }
    onSettingsChange(apiKey, strict);
  }, [apiKey, strict, onSettingsChange]);

  useEffect(() => {
    const load = () =>
      fetchStatus()
        .then(setStatus)
        .catch((e: unknown) =>
          setStatusError(e instanceof Error ? e.message : "Status unavailable")
        );
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (!apiKey) {
      setIngestMessage("Enter your API key first.");
      setIngestState("error");
      return;
    }
    setIngestState("loading");
    setIngestMessage("");
    try {
      const res = await ingestFiles(files, apiKey);
      setIngestMessage(
        `Stored ${res.chunks_stored} chunks from ${res.filenames.join(", ")}`
      );
      setIngestState("success");
      fetchStatus().then(setStatus).catch(() => null);
    } catch (err) {
      setIngestMessage(err instanceof Error ? err.message : "Ingest failed");
      setIngestState("error");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <aside className="w-72 flex-shrink-0 h-full border-r border-[var(--border)] bg-[var(--surface)] flex flex-col gap-6 p-5 overflow-y-auto">
      <div>
        <h1 className="text-base font-semibold text-[var(--foreground)]">
          RAG Support Copilot
        </h1>
        <p className="text-xs text-[var(--muted)] mt-0.5">Powered by DeepSeek + ChromaDB</p>
      </div>

      <hr className="border-[var(--border)]" />

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
          Hugging Face API Key
        </label>
        <input
          type="password"
          placeholder="hf_..."
          className="w-full rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          {...register("apiKey")}
        />
        {errors.apiKey && (
          <p className="mt-1 text-xs text-[#f85149]">{errors.apiKey.message}</p>
        )}
        {!apiKey && (
          <p className="mt-1 text-xs text-[var(--muted)]">Required to query the LLM.</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Strict Mode
          </p>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Skip LLM if confidence &lt; 60%
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStrict((s) => !s)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            strict ? "bg-[var(--accent)]" : "bg-[var(--border)]"
          }`}
          aria-pressed={strict}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              strict ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <hr className="border-[var(--border)]" />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
          Ingest Documents
        </p>
        <label
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--surface-hover)] px-4 py-6 cursor-pointer hover:border-[var(--accent)] transition-colors ${
            ingestState === "loading" ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          <span className="text-2xl">
            {ingestState === "loading"
              ? "⏳"
              : ingestState === "success"
              ? "✅"
              : ingestState === "error"
              ? "❌"
              : "📄"}
          </span>
          <span className="text-xs text-[var(--muted)] text-center">
            {ingestState === "loading"
              ? "Ingesting…"
              : "Drop .txt or .md files here, or click"}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md"
            multiple
            className="sr-only"
            onChange={handleUpload}
          />
        </label>
        {ingestMessage && (
          <p
            className={`mt-2 text-xs ${
              ingestState === "error" ? "text-[#f85149]" : "text-[#3fb950]"
            }`}
          >
            {ingestMessage}
          </p>
        )}
      </div>

      <hr className="border-[var(--border)]" />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
          Index Status
        </p>
        {statusError ? (
          <p className="text-xs text-[#f85149]">{statusError}</p>
        ) : status ? (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--muted)]">Chunks stored</span>
              <span className="font-mono text-[var(--accent)]">{status.total_chunks}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--muted)]">Last ingestion</span>
              <span className="font-mono text-[var(--foreground)] text-[10px]">
                {status.last_ingestion
                  ? new Date(status.last_ingestion).toLocaleString()
                  : "—"}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--muted)]">Loading…</p>
        )}
      </div>

      <hr className="border-[var(--border)]" />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
          UI Tweaks
        </p>

        <div className="space-y-3">
          <div>
            <label className="flex justify-between text-xs mb-2">
              <span className="text-[var(--muted)]">Accent Hue</span>
              <span className="text-[var(--accent)] font-mono">{localTweaks.accentHue}°</span>
            </label>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={localTweaks.accentHue}
              onChange={(e) => updateTweak("accentHue", parseInt(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, hsl(0,0%,30%), hsl(${localTweaks.accentHue},70%,50%))`,
              }}
            />
          </div>

          <div>
            <label className="flex justify-between text-xs mb-2">
              <span className="text-[var(--muted)]">Font Size</span>
              <span className="text-[var(--accent)] font-mono">{localTweaks.fontSize}px</span>
            </label>
            <input
              type="range"
              min="12"
              max="18"
              step="1"
              value={localTweaks.fontSize}
              onChange={(e) => updateTweak("fontSize", parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="text-xs text-[var(--muted)]">Show Sources</label>
            <button
              onClick={() => updateTweak("showSources", !localTweaks.showSources)}
              className={`relative w-8 h-4 rounded-full transition-colors ${
                localTweaks.showSources ? "bg-[var(--accent)]" : "bg-[var(--border)]"
              }`}
            >
              <span
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                  localTweaks.showSources ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs text-[var(--muted)]">Show RAG Log</label>
            <button
              onClick={() => updateTweak("showRetrieval", !localTweaks.showRetrieval)}
              className={`relative w-8 h-4 rounded-full transition-colors ${
                localTweaks.showRetrieval ? "bg-[var(--accent)]" : "bg-[var(--border)]"
              }`}
            >
              <span
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                  localTweaks.showRetrieval ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
