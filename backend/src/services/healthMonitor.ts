export type MonitorSource =
  | "pipeline"
  | "screener"
  | "filings"
  | "sebi"
  | "news"
  | "groq"
  | "stocktwits"
  | "yahoo_quote"
  | "yahoo_history"
  | "cache";

type MonitorStatus = "ok" | "failed";

type MonitorSample = {
  at: string;
  status: MonitorStatus;
  latencyMs: number | null;
  symbol: string | null;
  error: string | null;
};

type MonitorStats = {
  ok: number;
  failed: number;
  lastOkAt: string | null;
  lastFailAt: string | null;
  lastError: string | null;
  lastLatencyMs: number | null;
  recentLatenciesMs: number[];
  recentSamples: MonitorSample[];
};

const MAX_RECENT = 60;

function nowIso() {
  return new Date().toISOString();
}

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const clamped = Math.min(1, Math.max(0, q));
  const idx = Math.floor((sorted.length - 1) * clamped);
  return sorted[idx] ?? null;
}

function snapshotStats(stats: MonitorStats) {
  const latencies = [...stats.recentLatenciesMs].sort((a, b) => a - b);
  const total = stats.ok + stats.failed;
  const successRate = total > 0 ? Math.round((stats.ok / total) * 1000) / 10 : null;
  return {
    total,
    ok: stats.ok,
    failed: stats.failed,
    successRatePct: successRate,
    lastOkAt: stats.lastOkAt,
    lastFailAt: stats.lastFailAt,
    lastError: stats.lastError,
    lastLatencyMs: stats.lastLatencyMs,
    latencyP50Ms: quantile(latencies, 0.5),
    latencyP95Ms: quantile(latencies, 0.95),
    recentSamples: stats.recentSamples
  };
}

function createStats(): MonitorStats {
  return {
    ok: 0,
    failed: 0,
    lastOkAt: null,
    lastFailAt: null,
    lastError: null,
    lastLatencyMs: null,
    recentLatenciesMs: [],
    recentSamples: []
  };
}

const state: {
  startedAt: string;
  sources: Record<MonitorSource, MonitorStats>;
  cache: { hit: number; miss: number };
} = {
  startedAt: nowIso(),
  sources: {
    pipeline: createStats(),
    screener: createStats(),
    filings: createStats(),
    sebi: createStats(),
    news: createStats(),
    groq: createStats(),
    stocktwits: createStats(),
    yahoo_quote: createStats(),
    yahoo_history: createStats(),
    cache: createStats()
  },
  cache: { hit: 0, miss: 0 }
};

function recordSample(source: MonitorSource, sample: MonitorSample) {
  const stats = state.sources[source];
  if (!stats) return;

  if (sample.status === "ok") {
    stats.ok += 1;
    stats.lastOkAt = sample.at;
  } else {
    stats.failed += 1;
    stats.lastFailAt = sample.at;
    stats.lastError = sample.error ?? stats.lastError;
  }

  if (typeof sample.latencyMs === "number" && Number.isFinite(sample.latencyMs)) {
    stats.lastLatencyMs = sample.latencyMs;
    stats.recentLatenciesMs.push(sample.latencyMs);
    if (stats.recentLatenciesMs.length > MAX_RECENT) {
      stats.recentLatenciesMs.splice(0, stats.recentLatenciesMs.length - MAX_RECENT);
    }
  }

  stats.recentSamples.push(sample);
  if (stats.recentSamples.length > MAX_RECENT) {
    stats.recentSamples.splice(0, stats.recentSamples.length - MAX_RECENT);
  }
}

export function recordSourceOk(source: Exclude<MonitorSource, "cache">, opts: { symbol?: string | null; latencyMs?: number | null }) {
  recordSample(source, {
    at: nowIso(),
    status: "ok",
    symbol: opts.symbol ?? null,
    latencyMs: opts.latencyMs ?? null,
    error: null
  });
}

export function recordSourceFailed(
  source: Exclude<MonitorSource, "cache">,
  opts: { symbol?: string | null; latencyMs?: number | null; error: string }
) {
  recordSample(source, {
    at: nowIso(),
    status: "failed",
    symbol: opts.symbol ?? null,
    latencyMs: opts.latencyMs ?? null,
    error: opts.error
  });
}

export function recordCacheHit() {
  state.cache.hit += 1;
  recordSample("cache", { at: nowIso(), status: "ok", symbol: null, latencyMs: null, error: null });
}

export function recordCacheMiss() {
  state.cache.miss += 1;
  recordSample("cache", { at: nowIso(), status: "failed", symbol: null, latencyMs: null, error: "miss" });
}

export function getMonitorSnapshot() {
  const cacheTotal = state.cache.hit + state.cache.miss;
  const cacheHitRate = cacheTotal > 0 ? Math.round((state.cache.hit / cacheTotal) * 1000) / 10 : null;

  return {
    startedAt: state.startedAt,
    cache: { hit: state.cache.hit, miss: state.cache.miss, hitRatePct: cacheHitRate },
    sources: {
      pipeline: snapshotStats(state.sources.pipeline),
      screener: snapshotStats(state.sources.screener),
      filings: snapshotStats(state.sources.filings),
      sebi: snapshotStats(state.sources.sebi),
      news: snapshotStats(state.sources.news),
      groq: snapshotStats(state.sources.groq),
      stocktwits: snapshotStats(state.sources.stocktwits),
      yahoo_quote: snapshotStats(state.sources.yahoo_quote),
      yahoo_history: snapshotStats(state.sources.yahoo_history)
    }
  };
}

