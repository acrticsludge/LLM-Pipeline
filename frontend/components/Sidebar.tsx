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
    <aside
      style={{
        width: 288,
        flexShrink: 0,
        height: "100%",
        borderRight: "1px solid #2a2a2a",
        background: "#161616",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: 20,
        overflowY: "auto",
        fontFamily: '"IBM Plex Mono", monospace',
      }}
    >
      <div>
        <h1 style={{ fontSize: 14, fontWeight: 600, color: "#e8e4df", marginBottom: 4 }}>
          RAG Support Copilot
        </h1>
        <p style={{ fontSize: 11, color: "#b0ab9f" }}>Powered by DeepSeek + ChromaDB</p>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #2a2a2a" }} />

      <div>
        <label
          style={{
            display: "block",
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#b0ab9f",
            marginBottom: 8,
          }}
        >
          Hugging Face API Key
        </label>
        <input
          type="password"
          placeholder="hf_..."
          style={{
            width: "100%",
            borderRadius: 6,
            background: "#262626",
            border: "1px solid #3a3a3a",
            padding: "8px 12px",
            fontSize: 12,
            color: "#e8e4df",
            fontFamily: '"IBM Plex Mono", monospace',
            outline: "none",
            transition: "border-color 0.2s",
          }}
          {...register("apiKey")}
        />
        {errors.apiKey && (
          <p style={{ marginTop: 4, fontSize: 11, color: "#ff4444" }}>
            {errors.apiKey.message}
          </p>
        )}
        {!apiKey && (
          <p style={{ marginTop: 4, fontSize: 11, color: "#b0ab9f" }}>Required to query the LLM.</p>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#b0ab9f",
              marginBottom: 4,
            }}
          >
            Strict Mode
          </p>
          <p style={{ fontSize: 10, color: "#b0ab9f" }}>Skip LLM if confidence &lt; 60%</p>
        </div>
        <button
          type="button"
          onClick={() => setStrict((s) => !s)}
          style={{
            position: "relative",
            width: 32,
            height: 18,
            borderRadius: 999,
            border: "none",
            background: strict ? "var(--accent, #ffd700)" : "#3a3a3a",
            transition: "background 0.15s",
            cursor: "pointer",
            padding: 0,
          }}
          aria-pressed={strict}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: strict ? 14 : 2,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
              transition: "transform 0.15s",
            }}
          />
        </button>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #2a2a2a" }} />

      <div>
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#b0ab9f",
            marginBottom: 8,
          }}
        >
          Ingest Documents
        </p>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderRadius: 6,
            border: "2px dashed #3a3a3a",
            background: "#262626",
            padding: "24px 16px",
            cursor: ingestState === "loading" ? "default" : "pointer",
            transition: "all 0.15s",
            opacity: ingestState === "loading" ? 0.6 : 1,
            pointerEvents: ingestState === "loading" ? "none" : "auto",
          }}
          onMouseEnter={(e) => {
            if (ingestState !== "loading") {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--accent, #ffd700)";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#3a3a3a";
          }}
        >
          <span style={{ fontSize: 24, lineHeight: 1 }}>
            {ingestState === "loading"
              ? "⏳"
              : ingestState === "success"
              ? "✅"
              : ingestState === "error"
              ? "❌"
              : "📄"}
          </span>
          <span style={{ fontSize: 11, color: "#b0ab9f", textAlign: "center" }}>
            {ingestState === "loading"
              ? "Ingesting…"
              : "Drop .txt or .md files here, or click"}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md"
            multiple
            style={{ display: "none" }}
            onChange={handleUpload}
          />
        </label>
        {ingestMessage && (
          <p
            style={{
              marginTop: 8,
              fontSize: 11,
              color: ingestState === "error" ? "#ff4444" : "#44ff44",
            }}
          >
            {ingestMessage}
          </p>
        )}
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #2a2a2a" }} />

      <div>
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#b0ab9f",
            marginBottom: 8,
          }}
        >
          Index Status
        </p>
        {statusError ? (
          <p style={{ fontSize: 11, color: "#ff4444" }}>{statusError}</p>
        ) : status ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "#b0ab9f" }}>Chunks stored</span>
              <span style={{ fontFamily: '"IBM Plex Mono", monospace', color: "var(--accent, #ffd700)" }}>
                {status.total_chunks}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
              <span style={{ color: "#b0ab9f" }}>Last ingestion</span>
              <span style={{ fontFamily: '"IBM Plex Mono", monospace', color: "#e8e4df" }}>
                {status.last_ingestion
                  ? new Date(status.last_ingestion).toLocaleString()
                  : "—"}
              </span>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 11, color: "#b0ab9f" }}>Loading…</p>
        )}
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #2a2a2a" }} />

      <div>
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#b0ab9f",
            marginBottom: 12,
          }}
        >
          UI Tweaks
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Accent Hue */}
          <div>
            <label style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 8 }}>
              <span style={{ color: "#b0ab9f" }}>Accent Hue</span>
              <span style={{ color: "var(--accent, #ffd700)", fontFamily: '"IBM Plex Mono", monospace' }}>
                {localTweaks.accentHue}°
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={localTweaks.accentHue}
              onChange={(e) => updateTweak("accentHue", parseInt(e.target.value))}
              style={{
                width: "100%",
                height: 4,
                borderRadius: 999,
                background: `linear-gradient(to right, hsl(0,0%,30%), hsl(${localTweaks.accentHue},70%,50%))`,
                appearance: "none",
                WebkitAppearance: "none",
                cursor: "pointer",
              } as React.CSSProperties}
            />
          </div>

          {/* Font Size */}
          <div>
            <label style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 8 }}>
              <span style={{ color: "#b0ab9f" }}>Font Size</span>
              <span style={{ color: "var(--accent, #ffd700)", fontFamily: '"IBM Plex Mono", monospace' }}>
                {localTweaks.fontSize}px
              </span>
            </label>
            <input
              type="range"
              min="12"
              max="18"
              step="1"
              value={localTweaks.fontSize}
              onChange={(e) => updateTweak("fontSize", parseInt(e.target.value))}
              style={{
                width: "100%",
                height: 4,
                borderRadius: 999,
                background: "#3a3a3a",
                appearance: "none",
                WebkitAppearance: "none",
                cursor: "pointer",
              } as React.CSSProperties}
            />
          </div>

          {/* Show Sources Toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: 11, color: "#b0ab9f" }}>Show Sources</label>
            <button
              onClick={() => updateTweak("showSources", !localTweaks.showSources)}
              style={{
                position: "relative",
                width: 32,
                height: 18,
                borderRadius: 999,
                border: "none",
                background: localTweaks.showSources ? "var(--accent, #ffd700)" : "#3a3a3a",
                transition: "background 0.15s",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  left: localTweaks.showSources ? 14 : 2,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
                  transition: "transform 0.15s",
                }}
              />
            </button>
          </div>

          {/* Show RAG Log Toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: 11, color: "#b0ab9f" }}>Show RAG Log</label>
            <button
              onClick={() => updateTweak("showRetrieval", !localTweaks.showRetrieval)}
              style={{
                position: "relative",
                width: 32,
                height: 18,
                borderRadius: 999,
                border: "none",
                background: localTweaks.showRetrieval ? "var(--accent, #ffd700)" : "#3a3a3a",
                transition: "background 0.15s",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  left: localTweaks.showRetrieval ? 14 : 2,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
                  transition: "transform 0.15s",
                }}
              />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.12);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          cursor: default;
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.12);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          cursor: default;
        }
      `}</style>
    </aside>
  );
}
