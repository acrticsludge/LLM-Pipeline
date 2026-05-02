export type Urgency = "low" | "medium" | "high" | "critical";
export type Sentiment = "positive" | "neutral" | "negative";

export interface Resolution {
  ticket_id: string;
  possible_cause: string;
  recommended_steps: string[];
  urgency: Urgency;
  sentiment: Sentiment;
  disclaimer: string | null;
}

export interface Source {
  content: string;
  score: number;
  filename: string;
}

export interface SSEChunkEvent {
  type: "chunk";
  content: string;
}

export interface SSEFinalEvent {
  type: "final";
  resolution: Resolution;
  sources: Source[];
  corrected_query: string | null;
}

export interface SSEErrorEvent {
  type: "error";
  message: string;
}

export type SSEEvent = SSEChunkEvent | SSEFinalEvent | SSEErrorEvent;

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  resolution?: Resolution;
  sources?: Source[];
  corrected_query?: string | null;
  isStreaming?: boolean;
  error?: string;
}

export interface IngestResponse {
  chunks_stored: number;
  filenames: string[];
}

export interface StatusResponse {
  total_chunks: number;
  last_ingestion: string | null;
}
