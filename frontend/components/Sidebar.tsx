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

interface Props {
  onSettingsChange: (apiKey: string, strict: boolean) => void;
}

export default function Sidebar({ onSettingsChange }: Props) {
  const [strict, setStrict] = useState(false);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [ingestState, setIngestState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [ingestMessage, setIngestMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    watch,
    formState: { errors },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      apiKey:
        typeof window !== "undefined"
          ? (localStorage.getItem("hf_api_key") ?? "")
          : "",
    },
  });

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
    </aside>
  );
}
