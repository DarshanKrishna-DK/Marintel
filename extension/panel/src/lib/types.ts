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

export type MarintelCacheEntry = {
  fetchedAt: string;
  ok: boolean;
  status: number;
  cache?: string | null;
  data: unknown;
  error?: string;
};

