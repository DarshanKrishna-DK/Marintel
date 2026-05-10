import type { Env } from "../env";

import { AnakinClient } from "./anakin";
import { recordSourceFailed, recordSourceOk } from "./healthMonitor";
import type { IntelligenceSynthesis } from "./groq";
import { GroqClient } from "./groq";

export type TraderSentiment = {
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
  sampleMessages: Array<{
    id: number | null;
    createdAt: string | null;
    sentiment: "Bullish" | "Bearish" | null;
    body: string;
    username: string | null;
    likes: number | null;
    reshares: number | null;
  }>;
  note: string | null;
};

export type PriceOutlook = {
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
};

export type IntelligencePipelineResult = {
  symbol: string;
  type: "equity";
  generatedAt: string;
  latencyMs: number;
  sources: {
    screener: {
      url: string;
      status: "ok" | "failed";
      latencyMs?: number;
      markdown?: string | null;
      error?: string | null;
    };
    filings: { status: "ok" | "failed"; latencyMs?: number; data?: unknown; error?: string | null };
    sebi: { status: "ok" | "failed"; latencyMs?: number; data?: unknown; error?: string | null };
    news: { status: "ok" | "failed"; latencyMs?: number; data?: unknown; error?: string | null };
    groq: { status: "ok" | "failed"; latencyMs?: number; error?: string | null };
    stocktwits: { status: "ok" | "failed"; latencyMs?: number; symbol?: string | null; data?: unknown; error?: string | null };
    yahooQuote: { status: "ok" | "failed"; latencyMs?: number; ticker?: string | null; data?: unknown; error?: string | null };
    yahooHistory: { status: "ok" | "failed"; latencyMs?: number; ticker?: string | null; data?: unknown; error?: string | null };
  };
  synthesis: IntelligenceSynthesis;
  traderSentiment: TraderSentiment | null;
  priceOutlook: PriceOutlook | null;
  warnings: string[];
};

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[truncated]";
}

function extractScreenerHighlights(markdown: string): string {
  const lines = markdown.split("\n");
  const head = lines.slice(0, 160);

  const keywords = [
    "Market Cap",
    "Stock P/E",
    "P/B",
    "EPS",
    "Dividend Yield",
    "52 Week High",
    "52 Week Low",
    "ROE",
    "ROCE",
    "Promoter",
    "FII",
    "DII",
    "Shareholding"
  ];

  const highlights: string[] = [];
  for (const line of lines) {
    const hit = keywords.some((k) => line.toLowerCase().includes(k.toLowerCase()));
    if (hit) highlights.push(line);
    if (highlights.length >= 120) break;
  }

  return [...head, "", "Highlights:", ...highlights].join("\n");
}

function inferExchangeFromUrl(url: string): string | null {
  const lower = url.toLowerCase();
  if (lower.includes("nseindia.com")) return "NSE";
  if (lower.includes("bseindia.com")) return "BSE";
  return null;
}

function compactSearchResults(results: unknown, maxItems: number) {
  if (!Array.isArray(results)) return [];
  return results.slice(0, maxItems).map((r) => ({
    url: typeof r?.url === "string" ? r.url : null,
    title: typeof r?.title === "string" ? r.title : null,
    snippet:
      typeof r?.snippet === "string" ? (r.snippet.length > 280 ? r.snippet.slice(0, 280) + "..." : r.snippet) : null,
    date: typeof r?.date === "string" ? r.date : null
  }));
}

function deriveListFromSearch(
  results: Array<{ url: string; title?: string; snippet?: string; date?: string }>,
  kind: "filing" | "sebi" | "news"
): Array<{ title: string; url: string; summary: string | null; date: string | null }> {
  return results.slice(0, 8).map((r) => ({
    title: r.title ?? (kind === "news" ? "News" : "Result"),
    url: r.url,
    summary: r.snippet ?? null,
    date: r.date ?? null
  }));
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9+.,-]/g, "").replace(/,/g, "");
    if (cleaned.trim() === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function stdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function computeTraderSentiment(stocktwitsData: unknown, fallbackSymbol: string | null): TraderSentiment {
  const obj = stocktwitsData && typeof stocktwitsData === "object" ? (stocktwitsData as any) : null;
  const usedSymbol = typeof obj?.symbol === "string" ? String(obj.symbol) : fallbackSymbol;

  const totalMessages = toFiniteNumber(obj?.total);
  const summary = obj?.sentiment_summary ?? null;
  const bullishCount = toFiniteNumber(summary?.bullish_count);
  const bearishCount = toFiniteNumber(summary?.bearish_count);
  const noneCount = toFiniteNumber(summary?.none_count);
  const bullishPct = toFiniteNumber(summary?.bullish_pct);
  const bearishPct = toFiniteNumber(summary?.bearish_pct);

  let score: number | null = null;
  if (bullishCount !== null && bearishCount !== null && bullishCount + bearishCount > 0) {
    score = Math.round((bullishCount / (bullishCount + bearishCount)) * 100);
  } else if (bullishPct !== null && bearishPct !== null && bullishPct + bearishPct > 0) {
    score = Math.round((bullishPct / (bullishPct + bearishPct)) * 100);
  } else if (bullishPct !== null && bearishPct !== null && bullishPct + bearishPct === 0) {
    score = 50;
  } else {
    score = 50;
  }

  score = score === null ? null : clamp(score, 0, 100);
  const label = score === null ? null : score >= 60 ? "bullish" : score <= 40 ? "bearish" : "neutral";

  const messages = Array.isArray(obj?.messages) ? (obj.messages as any[]) : [];
  const sampleMessages = messages.slice(0, 6).map((m) => ({
    id: toFiniteNumber(m?.id),
    createdAt: typeof m?.created_at === "string" ? m.created_at : null,
    sentiment: m?.sentiment === "Bullish" || m?.sentiment === "Bearish" ? m.sentiment : null,
    body: typeof m?.body === "string" ? (m.body.length > 240 ? m.body.slice(0, 240) + "..." : m.body) : "",
    username: typeof m?.user?.username === "string" ? m.user.username : null,
    likes: toFiniteNumber(m?.likes),
    reshares: toFiniteNumber(m?.reshares)
  }));

  const url = usedSymbol ? `https://stocktwits.com/symbol/${encodeURIComponent(usedSymbol)}` : null;

  return {
    provider: "stocktwits",
    symbol: usedSymbol ?? null,
    url,
    totalMessages: totalMessages === null ? null : Math.round(totalMessages),
    bullishCount: bullishCount === null ? null : Math.round(bullishCount),
    bearishCount: bearishCount === null ? null : Math.round(bearishCount),
    noneCount: noneCount === null ? null : Math.round(noneCount),
    bullishPct,
    bearishPct,
    score,
    label,
    sampleMessages,
    note:
      "Sentiment is based on StockTwits user tags (Bullish or Bearish) at posting time. Coverage varies by symbol."
  };
}

function computePriceOutlook(yahooQuoteData: unknown, yahooHistoryData: unknown, traderScore: number | null): PriceOutlook {
  const quoteObj = yahooQuoteData && typeof yahooQuoteData === "object" ? (yahooQuoteData as any) : null;
  const historyObj = yahooHistoryData && typeof yahooHistoryData === "object" ? (yahooHistoryData as any) : null;

  const ticker = typeof quoteObj?.symbol === "string" ? quoteObj.symbol : typeof historyObj?.symbol === "string" ? historyObj.symbol : null;
  const currency = typeof quoteObj?.currency === "string" ? quoteObj.currency : typeof historyObj?.currency === "string" ? historyObj.currency : null;

  const lastPrice =
    toFiniteNumber(quoteObj?.quote?.price) ??
    (() => {
      const points = Array.isArray(historyObj?.data) ? (historyObj.data as any[]) : [];
      const last = points.length > 0 ? points[points.length - 1] : null;
      return toFiniteNumber(last?.close);
    })() ??
    null;

  const analystTarget = toFiniteNumber(quoteObj?.stats?.analyst_target);

  const points = Array.isArray(historyObj?.data) ? (historyObj.data as any[]) : [];
  const closes = points
    .map((p) => toFiniteNumber(p?.close))
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

  const returns: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1]!;
    const curr = closes[i]!;
    if (prev > 0 && curr > 0) returns.push(Math.log(curr / prev));
  }

  const sigmaDaily = stdev(returns);
  const volatilityDailyPct = sigmaDaily === null ? null : round2(sigmaDaily * 100);

  const horizonDays = 7;
  const z90 = 1.645;
  const sigmaH = sigmaDaily === null ? null : sigmaDaily * Math.sqrt(horizonDays);
  const baseMovePct = sigmaH === null ? null : z90 * sigmaH * 100;

  const tiltNorm = traderScore === null ? 0 : (clamp(traderScore, 0, 100) - 50) / 50;
  const driftPct = sigmaH === null ? 0 : tiltNorm * (sigmaH * 100) * 0.25;

  const projectedChangePctLow = baseMovePct === null ? null : round2(-baseMovePct + driftPct);
  const projectedChangePctHigh = baseMovePct === null ? null : round2(baseMovePct + driftPct);

  let projectedLow =
    lastPrice !== null && projectedChangePctLow !== null ? round2(lastPrice * (1 + projectedChangePctLow / 100)) : null;
  let projectedHigh =
    lastPrice !== null && projectedChangePctHigh !== null ? round2(lastPrice * (1 + projectedChangePctHigh / 100)) : null;

  if (projectedLow !== null && projectedHigh !== null && projectedLow > projectedHigh) {
    const tmp = projectedLow;
    projectedLow = projectedHigh;
    projectedHigh = tmp;
  }

  const url = ticker ? `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}` : null;

  return {
    provider: "yahoo_finance",
    ticker,
    url,
    currency,
    lastPrice,
    analystTarget,
    horizonDays,
    volatilityDailyPct,
    projectedLow,
    projectedHigh,
    projectedChangePctLow,
    projectedChangePctHigh,
    method: "Experimental: 90% range from 3mo daily volatility, with a small tilt from trader sentiment when available.",
    confidence: "low",
    note: "This is not a guarantee or financial advice. It is a simple range model for demo purposes."
  };
}

export async function runIntelligencePipeline(env: Env, input: { symbol: string }): Promise<IntelligencePipelineResult> {
  const startedAt = Date.now();
  const anakin = new AnakinClient(env);
  const groq = new GroqClient(env);

  const symbol = input.symbol.toUpperCase();
  const screenerUrlPrimary = `https://www.screener.in/company/${encodeURIComponent(symbol)}/consolidated/`;
  const screenerUrlFallback = `https://www.screener.in/company/${encodeURIComponent(symbol)}/`;

  type TimedOk<T> = { ok: true; value: T; latencyMs: number };
  type TimedFail = { ok: false; error: string; latencyMs: number };
  type Timed<T> = TimedOk<T> | TimedFail;

  async function timed<T>(fn: () => Promise<T>): Promise<Timed<T>> {
    const start = Date.now();
    try {
      const value = await fn();
      return { ok: true, value, latencyMs: Date.now() - start };
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      return { ok: false, error: message, latencyMs: Date.now() - start };
    }
  }

  try {
    const stocktwitsPreferredSymbol = `${symbol}.NSE`;
    const yahooPrimaryTicker = `${symbol}.NS`;
    const yahooFallbackTicker = `${symbol}.BO`;

    const [screenerRes, filingsRes, sebiRes, newsRes, stocktwitsRes, yahooQuoteRes, yahooHistoryRes] = await Promise.all([
      timed(async () => {
        const primary = await anakin.scrapeUrl({
          url: screenerUrlPrimary,
          country: "in",
          useBrowser: false,
          generateJson: false,
          timeoutMs: 45_000
        });

        if (primary.status === "completed" && primary.markdown && primary.markdown.trim().length > 0) {
          return { url: screenerUrlPrimary, markdown: primary.markdown, error: null as string | null };
        }

        const fallback = await anakin.scrapeUrl({
          url: screenerUrlFallback,
          country: "in",
          useBrowser: false,
          generateJson: false,
          timeoutMs: 45_000
        });

        if (fallback.status === "completed" && fallback.markdown && fallback.markdown.trim().length > 0) {
          return { url: screenerUrlFallback, markdown: fallback.markdown, error: null as string | null };
        }

        const useBrowserRetry = await anakin.scrapeUrl({
          url: screenerUrlFallback,
          country: "in",
          useBrowser: true,
          generateJson: false,
          timeoutMs: 60_000
        });

        return {
          url: screenerUrlFallback,
          markdown: useBrowserRetry.markdown ?? null,
          error:
            useBrowserRetry.status === "failed"
              ? "Anakin url-scraper job failed for Screener"
              : "Screener scrape did not return markdown"
        };
      }),
      timed(() =>
        anakin.search({
          prompt: [
            `Latest corporate announcements or regulatory filings for NSE symbol ${symbol}.`,
            "Prefer official exchange sources. Include URLs.",
            "Hint: search NSE and BSE pages if possible (nseindia.com, bseindia.com)."
          ].join("\n"),
          limit: 8,
          timeoutMs: 25_000
        })
      ),
      timed(() =>
        anakin.search({
          prompt: [
            `SEBI orders / show-cause notices / regulatory actions for company with NSE symbol ${symbol}.`,
            "Prefer official SEBI sources. Include URLs. Hint: search sebi.gov.in.",
            "If nothing relevant is found, return an empty results list."
          ].join("\n"),
          limit: 6,
          timeoutMs: 25_000
        })
      ),
      timed(() =>
        anakin.search({
          prompt: [
            `Latest news headlines about ${symbol} (NSE) from Indian business news sources.`,
            "Prefer Moneycontrol, Economic Times Markets, Mint, Business Standard.",
            "Return results with URLs and titles."
          ].join("\n"),
          limit: 8,
          timeoutMs: 25_000
        })
      ),
      timed(async () => {
        const runStream = async (sym: string) => {
          const result = await anakin.wireRunTask({
            actionId: "st_symbol_stream",
            params: { symbol: sym, limit: 30 },
            timeoutMs: 25_000
          });
          if (result.status !== "completed") throw new Error(result.error);
          return result.data;
        };

        try {
          const data = await runStream(stocktwitsPreferredSymbol);
          return { symbol: stocktwitsPreferredSymbol, data };
        } catch {
          const search = await anakin.wireRunTask({
            actionId: "st_search_symbols",
            params: { query: symbol, limit: 10 },
            timeoutMs: 25_000
          });
          if (search.status !== "completed") throw new Error(search.error);

          const results = Array.isArray((search.data as any)?.results) ? ((search.data as any).results as any[]) : [];
          const best =
            results.find((r) => String(r?.exchange ?? "").toUpperCase() === "NSE") ??
            results.find((r) => String(r?.exchange ?? "").toUpperCase() === "BSE") ??
            results[0] ??
            null;

          const resolvedSymbol = typeof best?.symbol === "string" ? String(best.symbol) : stocktwitsPreferredSymbol;
          const data = await runStream(resolvedSymbol);
          return { symbol: resolvedSymbol, data };
        }
      }),
      timed(async () => {
        const runQuote = async (ticker: string) => {
          const result = await anakin.wireRunTask({
            actionId: "yf_quote",
            params: { ticker },
            timeoutMs: 25_000
          });
          if (result.status !== "completed") throw new Error(result.error);
          const price = toFiniteNumber((result.data as any)?.quote?.price);
          if (price === null) throw new Error("Yahoo quote missing price");
          return result.data;
        };

        try {
          const data = await runQuote(yahooPrimaryTicker);
          return { ticker: yahooPrimaryTicker, data };
        } catch {
          const data = await runQuote(yahooFallbackTicker);
          return { ticker: yahooFallbackTicker, data };
        }
      }),
      timed(async () => {
        const runHistory = async (ticker: string) => {
          const result = await anakin.wireRunTask({
            actionId: "yf_price_history",
            params: { ticker, range: "3mo", interval: "1d" },
            timeoutMs: 25_000
          });
          if (result.status !== "completed") throw new Error(result.error);
          const points = Array.isArray((result.data as any)?.data) ? ((result.data as any).data as any[]) : [];
          if (points.length === 0) throw new Error("Yahoo price history returned no data points");
          return result.data;
        };

        try {
          const data = await runHistory(yahooPrimaryTicker);
          return { ticker: yahooPrimaryTicker, data };
        } catch {
          const data = await runHistory(yahooFallbackTicker);
          return { ticker: yahooFallbackTicker, data };
        }
      })
    ]);

    const sources: IntelligencePipelineResult["sources"] = {
      screener: { url: screenerUrlPrimary, status: "failed", latencyMs: 0, markdown: null, error: null },
      filings: { status: "failed", latencyMs: 0, error: null },
      sebi: { status: "failed", latencyMs: 0, error: null },
      news: { status: "failed", latencyMs: 0, error: null },
      groq: { status: "failed", latencyMs: 0, error: null },
      stocktwits: { status: "failed", latencyMs: 0, symbol: null, data: null, error: null },
      yahooQuote: { status: "failed", latencyMs: 0, ticker: null, data: null, error: null },
      yahooHistory: { status: "failed", latencyMs: 0, ticker: null, data: null, error: null }
    };

    const warnings: string[] = [];

    if (screenerRes.ok) {
      sources.screener = {
        url: screenerRes.value.url,
        status: screenerRes.value.markdown ? "ok" : "failed",
        latencyMs: screenerRes.latencyMs,
        markdown: screenerRes.value.markdown ? truncate(screenerRes.value.markdown, 20_000) : null,
        error: screenerRes.value.error ?? null
      };

      if (screenerRes.value.markdown) {
        recordSourceOk("screener", { symbol, latencyMs: screenerRes.latencyMs });
      } else {
        const err = screenerRes.value.error ?? "Screener scrape missing markdown";
        warnings.push("Screener scrape missing markdown");
        recordSourceFailed("screener", { symbol, latencyMs: screenerRes.latencyMs, error: err });
      }
    } else {
      sources.screener = {
        url: screenerUrlPrimary,
        status: "failed",
        latencyMs: screenerRes.latencyMs,
        markdown: null,
        error: screenerRes.error
      };
      warnings.push("Screener scrape failed");
      recordSourceFailed("screener", { symbol, latencyMs: screenerRes.latencyMs, error: screenerRes.error });
    }

    if (filingsRes.ok) {
      sources.filings = { status: "ok", latencyMs: filingsRes.latencyMs, data: filingsRes.value.results };
      recordSourceOk("filings", { symbol, latencyMs: filingsRes.latencyMs });
    } else {
      sources.filings = { status: "failed", latencyMs: filingsRes.latencyMs, error: filingsRes.error };
      warnings.push("Filings search failed");
      recordSourceFailed("filings", { symbol, latencyMs: filingsRes.latencyMs, error: filingsRes.error });
    }

    if (sebiRes.ok) {
      sources.sebi = { status: "ok", latencyMs: sebiRes.latencyMs, data: sebiRes.value.results };
      recordSourceOk("sebi", { symbol, latencyMs: sebiRes.latencyMs });
    } else {
      sources.sebi = { status: "failed", latencyMs: sebiRes.latencyMs, error: sebiRes.error };
      warnings.push("SEBI search failed");
      recordSourceFailed("sebi", { symbol, latencyMs: sebiRes.latencyMs, error: sebiRes.error });
    }

    if (newsRes.ok) {
      sources.news = { status: "ok", latencyMs: newsRes.latencyMs, data: newsRes.value.results };
      recordSourceOk("news", { symbol, latencyMs: newsRes.latencyMs });
    } else {
      sources.news = { status: "failed", latencyMs: newsRes.latencyMs, error: newsRes.error };
      warnings.push("News search failed");
      recordSourceFailed("news", { symbol, latencyMs: newsRes.latencyMs, error: newsRes.error });
    }

    if (stocktwitsRes.ok) {
      sources.stocktwits = {
        status: "ok",
        latencyMs: stocktwitsRes.latencyMs,
        symbol: stocktwitsRes.value.symbol,
        data: stocktwitsRes.value.data
      };
      recordSourceOk("stocktwits", { symbol, latencyMs: stocktwitsRes.latencyMs });
    } else {
      sources.stocktwits = { status: "failed", latencyMs: stocktwitsRes.latencyMs, symbol: stocktwitsPreferredSymbol, error: stocktwitsRes.error };
      warnings.push("StockTwits sentiment unavailable");
      recordSourceFailed("stocktwits", { symbol, latencyMs: stocktwitsRes.latencyMs, error: stocktwitsRes.error });
    }

    if (yahooQuoteRes.ok) {
      sources.yahooQuote = { status: "ok", latencyMs: yahooQuoteRes.latencyMs, ticker: yahooQuoteRes.value.ticker, data: yahooQuoteRes.value.data };
      recordSourceOk("yahoo_quote", { symbol, latencyMs: yahooQuoteRes.latencyMs });
    } else {
      sources.yahooQuote = { status: "failed", latencyMs: yahooQuoteRes.latencyMs, ticker: yahooPrimaryTicker, error: yahooQuoteRes.error };
      warnings.push("Yahoo quote unavailable");
      recordSourceFailed("yahoo_quote", { symbol, latencyMs: yahooQuoteRes.latencyMs, error: yahooQuoteRes.error });
    }

    if (yahooHistoryRes.ok) {
      sources.yahooHistory = {
        status: "ok",
        latencyMs: yahooHistoryRes.latencyMs,
        ticker: yahooHistoryRes.value.ticker,
        data: yahooHistoryRes.value.data
      };
      recordSourceOk("yahoo_history", { symbol, latencyMs: yahooHistoryRes.latencyMs });
    } else {
      sources.yahooHistory = { status: "failed", latencyMs: yahooHistoryRes.latencyMs, ticker: yahooPrimaryTicker, error: yahooHistoryRes.error };
      warnings.push("Yahoo price history unavailable");
      recordSourceFailed("yahoo_history", { symbol, latencyMs: yahooHistoryRes.latencyMs, error: yahooHistoryRes.error });
    }

    const traderSentiment =
      sources.stocktwits.status === "ok" && sources.stocktwits.data
        ? computeTraderSentiment(sources.stocktwits.data, sources.stocktwits.symbol ?? null)
        : null;

    const priceOutlook =
      sources.yahooQuote.status === "ok" && sources.yahooHistory.status === "ok" && sources.yahooQuote.data && sources.yahooHistory.data
        ? computePriceOutlook(sources.yahooQuote.data, sources.yahooHistory.data, traderSentiment?.score ?? null)
        : null;

    const screenerForGroq = sources.screener.markdown
      ? truncate(extractScreenerHighlights(sources.screener.markdown), 10_000)
      : null;
    const filingsForGroq = compactSearchResults(sources.filings.data, 5);
    const sebiForGroq = compactSearchResults(sources.sebi.data, 5);
    const newsForGroq = compactSearchResults(sources.news.data, 6);

    const groqStart = Date.now();
    let synthesis: IntelligenceSynthesis;
    try {
      synthesis = await groq.synthesizeIntelligence({
        symbol,
        screenerMarkdown: screenerForGroq,
        filings: filingsForGroq,
        sebi: sebiForGroq,
        newsResults: newsForGroq,
        traderSentiment,
        priceOutlook,
        timeoutMs: 30_000
      });
      sources.groq = { status: "ok", latencyMs: Date.now() - groqStart, error: null };
      recordSourceOk("groq", { symbol, latencyMs: Date.now() - groqStart });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      sources.groq = { status: "failed", latencyMs: Date.now() - groqStart, error: message };
      recordSourceFailed("groq", { symbol, latencyMs: Date.now() - groqStart, error: message });
      throw err;
    }

    const filingsResults = Array.isArray(sources.filings.data) ? (sources.filings.data as any[]) : [];
    const sebiResults = Array.isArray(sources.sebi.data) ? (sources.sebi.data as any[]) : [];
    const newsResults = Array.isArray(sources.news.data) ? (sources.news.data as any[]) : [];

    if (synthesis.latestFilings.length === 0 && filingsResults.length > 0) {
      const derived = deriveListFromSearch(filingsResults as any, "filing").map((r) => ({
        date: r.date,
        exchange: inferExchangeFromUrl(r.url),
        title: r.title,
        url: r.url,
        summary: r.summary
      }));
      synthesis.latestFilings = derived;
    }

    if (synthesis.sebiAlerts.length === 0 && sebiResults.length > 0) {
      const derived = deriveListFromSearch(sebiResults as any, "sebi").map((r) => ({
        date: r.date,
        title: r.title,
        url: r.url,
        severity: null,
        summary: r.summary
      }));
      synthesis.sebiAlerts = derived;
    }

    if (synthesis.news.items.length === 0 && newsResults.length > 0) {
      const derived = deriveListFromSearch(newsResults as any, "news").map((r) => ({
        title: r.title,
        url: r.url,
        sentiment: null,
        summary: r.summary,
        date: r.date
      }));
      synthesis.news.items = derived;
    }

    if (synthesis.citations.length === 0) {
      const citations: Array<{ label: string; url: string }> = [];
      if (sources.screener.status === "ok") citations.push({ label: "Screener", url: sources.screener.url });
      for (const r of [...filingsResults.slice(0, 2), ...sebiResults.slice(0, 2), ...newsResults.slice(0, 2)]) {
        if (r && typeof r.url === "string") citations.push({ label: "Source", url: r.url });
      }
      synthesis.citations = citations;
    }

    const extraCitations: Array<{ label: string; url: string }> = [];
    if (traderSentiment?.url) extraCitations.push({ label: "StockTwits sentiment", url: traderSentiment.url });
    if (priceOutlook?.url) extraCitations.push({ label: "Yahoo Finance", url: priceOutlook.url });

    if (extraCitations.length > 0) {
      const seen = new Set((synthesis.citations ?? []).map((c) => c.url));
      for (const c of extraCitations) {
        if (!seen.has(c.url)) synthesis.citations.push(c);
      }
    }

    const totalLatencyMs = Date.now() - startedAt;
    recordSourceOk("pipeline", { symbol, latencyMs: totalLatencyMs });

    return {
      symbol,
      type: "equity",
      generatedAt: new Date().toISOString(),
      latencyMs: totalLatencyMs,
      sources,
      synthesis,
      traderSentiment,
      priceOutlook,
      warnings
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    recordSourceFailed("pipeline", { symbol, latencyMs: Date.now() - startedAt, error: message });
    throw err;
  }
}

