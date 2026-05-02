import type { IngestResponse, StatusResponse } from "./types";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export async function ingestFiles(
  files: File[],
  _apiKey: string
): Promise<IngestResponse> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  const res = await fetch(`${BACKEND}/ingest`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(body.detail ?? `Ingest failed (${res.status})`);
  }
  return res.json() as Promise<IngestResponse>;
}

export async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetch(`${BACKEND}/status`);
  if (!res.ok) throw new Error(`Status check failed (${res.status})`);
  return res.json() as Promise<StatusResponse>;
}

export function getQueryUrl(): string {
  return `${BACKEND}/query`;
}
