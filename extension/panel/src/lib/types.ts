export type MarintelCurrentAsset = {
  symbol: string;
  platform: string;
  url: string;
  detectedAt: string;
};

export type MarintelErrorPayload = {
  error?: { code?: string; message?: string } | null;
  message?: string;
};

export type MarintelIntelligencePipelineResult = {
  symbol: string;
  type: string;
  generatedAt: string;
  latencyMs: number;
  warnings?: string[] | null;
  synthesis?: {
    summary: string;
    signal: "bullish" | "neutral" | "bearish";
    signalScore: number;
    financialSnapshot?: Record<string, unknown>;
    latestFilings?: Array<{ date?: string | null; exchange?: string | null; title: string; url: string; summary?: string | null }>;
    sebiAlerts?: Array<{ date?: string | null; title: string; url: string; severity?: string | null; summary?: string | null }>;
    news?: { sentimentScore: number; items: Array<{ title: string; url: string; sentiment?: string | null; summary?: string | null; date?: string | null }> };
    citations?: Array<{ label: string; url: string }>;
  };
};

export type MarintelCacheEntry = {
  fetchedAt: string;
  ok: boolean;
  status: number;
  cache?: string | null;
  data: unknown;
  error?: string;
};

