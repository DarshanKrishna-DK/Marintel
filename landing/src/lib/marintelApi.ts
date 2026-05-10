export type IntelligenceResponse = {
  symbol: string;
  type: string;
  generatedAt: string;
  latencyMs: number;
  warnings?: string[] | null;
  traderSentiment?: {
    provider: "stocktwits";
    symbol: string | null;
    url: string | null;
    totalMessages: number | null;
    bullishCount: number | null;
    bearishCount: number | null;
    noneCount: number | null;
    bullishPct: number | null;
    bearishPct: number | null;
    score: number | null;
    label: "bullish" | "neutral" | "bearish" | null;
    sampleMessages?: Array<{
      id: number | null;
      createdAt: string | null;
      sentiment: "Bullish" | "Bearish" | null;
      body: string;
      username: string | null;
      likes: number | null;
      reshares: number | null;
    }>;
    note: string | null;
  } | null;
  priceOutlook?: {
    provider: "yahoo_finance";
    ticker: string | null;
    url: string | null;
    currency: string | null;
    lastPrice: number | null;
    analystTarget: number | null;
    horizonDays: number;
    volatilityDailyPct: number | null;
    projectedLow: number | null;
    projectedHigh: number | null;
    projectedChangePctLow: number | null;
    projectedChangePctHigh: number | null;
    method: string;
    confidence: "low" | "medium" | "high";
    note: string | null;
  } | null;
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

export type FetchMeta = {
  requestId: string | null;
  cache: string | null;
  status: number;
};

export function getBackendBaseUrl() {
  const raw = import.meta.env.VITE_MARINTEL_BACKEND_URL as string | undefined;
  const fallback = "http://localhost:8787";
  const value = (raw && raw.trim().length > 0 ? raw.trim() : fallback).replace(/\/+$/, "");
  return value;
}

export async function fetchHealth() {
  const baseUrl = getBackendBaseUrl();
  const res = await fetch(`${baseUrl}/health`);
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function fetchIntelligence(symbol: string): Promise<{ meta: FetchMeta; data: IntelligenceResponse }> {
  const baseUrl = getBackendBaseUrl();
  const res = await fetch(`${baseUrl}/intelligence`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ symbol, type: "equity" })
  });

  const meta: FetchMeta = {
    requestId: res.headers.get("x-request-id"),
    cache: res.headers.get("x-marintel-cache"),
    status: res.status
  };

  const text = await res.text();
  if (!res.ok) {
    const msg = text.length > 0 ? text : `Request failed (${res.status})`;
    throw new Error(msg);
  }

  const data = (text ? (JSON.parse(text) as IntelligenceResponse) : (null as unknown as IntelligenceResponse));
  return { meta, data };
}

