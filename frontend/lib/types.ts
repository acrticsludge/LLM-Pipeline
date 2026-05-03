export type Urgency = "low" | "medium" | "high" | "critical";
export type Sentiment = "positive" | "neutral" | "negative";

export interface Resolution {
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

export interface SSEFinalEventTicket {
  type: "final";
  is_ticket: true;
  resolution: Resolution;
  sources: Source[];
  corrected_query: string | null;
}

export interface SSEFinalEventNonTicket {
  type: "final";
  is_ticket: false;
  message: string;
  sources: [];
  corrected_query: string | null;
}

export type SSEFinalEvent = SSEFinalEventTicket | SSEFinalEventNonTicket;

export interface SSEErrorEvent {
  type: "error";
  message: string;
}

export type SSEEvent = SSEChunkEvent | SSEFinalEvent | SSEErrorEvent;

export interface RetrievalLogEntry {
  time: string;
  action: string;
  score?: number | null;
  chunks?: number | null;
  latency?: number | null;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  resolution?: Resolution;
  sources?: Source[];
  corrected_query?: string | null;
  isNonTicket?: boolean;
  isStreaming?: boolean;
  error?: string;
  followUps?: string[];
  retrievalLog?: RetrievalLogEntry[];
  feedback?: "up" | "down" | null;
}

export interface IngestResponse {
  chunks_stored: number;
  filenames: string[];
}

export interface StatusResponse {
  total_chunks: number;
  last_ingestion: string | null;
}
