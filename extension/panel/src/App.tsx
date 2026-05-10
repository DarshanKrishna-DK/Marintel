import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "./lib/cn";
import { MSG_REFRESH, STORAGE_CURRENT_ASSET_KEY, intelligenceKey } from "./lib/constants";
import { ensureBackendHostPermission, resolveBackendBaseUrl } from "./lib/permissions";
import type { MarintelCacheEntry, MarintelCurrentAsset, MarintelIntelligencePipelineResult } from "./lib/types";

function formatPlatform(platform: string) {
  if (platform === "groww") return "Groww";
  if (platform === "zerodha_kite") return "Zerodha Kite";
  if (platform === "angelone") return "Angel One";
  return platform;
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "string") return value.trim().length === 0 ? "N/A" : value;
  if (typeof value === "number") return Number.isFinite(value) ? value.toString() : "N/A";
  return String(value);
}

function SignalBadge(props: { signal: string; score: number }) {
  const tone =
    props.signal === "bullish"
      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
      : props.signal === "bearish"
        ? "bg-rose-500/15 text-rose-300 ring-rose-500/30"
        : "bg-slate-500/15 text-slate-200 ring-slate-500/30";
  const label = props.signal.toUpperCase();
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold ring-1", tone)}>
      <span>{label}</span>
      <span className="text-[10px] font-medium opacity-85">{props.score}/100</span>
    </span>
  );
}

function Card(props: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-800 bg-slate-900/35 p-3 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]",
        props.className
      )}
    >
      {props.children}
    </div>
  );
}

function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
}) {
  const base =
    "inline-flex select-none items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-400/60 disabled:opacity-60 disabled:cursor-not-allowed";
  const tone =
    props.variant === "ghost"
      ? "bg-transparent hover:bg-slate-800/60 text-slate-100"
      : "bg-sky-500/20 hover:bg-sky-500/25 ring-1 ring-inset ring-sky-500/35 text-sky-50";
  return (
    <button type="button" className={cn(base, tone)} onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
  );
}

function Skeleton(props: { className: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-slate-800/60", props.className)} />;
}

async function getLocal<T>(keys: string[]): Promise<Record<string, T>> {
  return (await chrome.storage.local.get(keys)) as Record<string, T>;
}

async function getSync(keys: string[]): Promise<Record<string, unknown>> {
  return (await chrome.storage.sync.get(keys)) as Record<string, unknown>;
}

export default function App() {
  const [backendBaseUrl, setBackendBaseUrl] = useState<string | null>(null);
  const [asset, setAsset] = useState<MarintelCurrentAsset | null>(null);
  const [entry, setEntry] = useState<MarintelCacheEntry | null>(null);
  const [tab, setTab] = useState<"brief" | "filings" | "news" | "sebi" | "sources">("brief");
  const [symbolInput, setSymbolInput] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const currentAssetSymbolRef = useRef<string | null>(null);

  const activeSymbol = asset?.symbol ?? (symbolInput.trim().length > 0 ? symbolInput.trim().toUpperCase() : null);

  const parsed = useMemo(() => {
    if (!entry?.ok) return null;
    return entry.data as MarintelIntelligencePipelineResult;
  }, [entry]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const sync = await getSync(["backendBaseUrl"]);
      if (!mounted) return;
      if (typeof sync.backendBaseUrl === "string" && sync.backendBaseUrl.trim().length > 0) {
        setBackendBaseUrl(sync.backendBaseUrl.trim());
      }

      const local = await getLocal<unknown>([STORAGE_CURRENT_ASSET_KEY]);
      if (!mounted) return;
      const nextAsset = (local[STORAGE_CURRENT_ASSET_KEY] as MarintelCurrentAsset | undefined) ?? null;
      setAsset(nextAsset);
      currentAssetSymbolRef.current = nextAsset?.symbol ?? null;

      if (nextAsset?.symbol) {
        const e = await getLocal<MarintelCacheEntry>([intelligenceKey(nextAsset.symbol)]);
        if (!mounted) return;
        setEntry((e[intelligenceKey(nextAsset.symbol)] as MarintelCacheEntry | undefined) ?? null);
      }
    };

    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== "local") return;
      if (changes[STORAGE_CURRENT_ASSET_KEY]) {
        const next = (changes[STORAGE_CURRENT_ASSET_KEY]?.newValue as MarintelCurrentAsset | undefined) ?? null;
        setAsset(next);
        currentAssetSymbolRef.current = next?.symbol ?? null;

        // If we have cached intelligence already (or it changed in the same event), load it.
        const nextSymbol = next?.symbol ?? null;
        if (nextSymbol) {
          const key = intelligenceKey(nextSymbol);
          if (changes[key]) {
            setEntry((changes[key]?.newValue as MarintelCacheEntry | undefined) ?? null);
          } else {
            setEntry(null);
            getLocal<MarintelCacheEntry>([key])
              .then((e) => setEntry((e[key] as MarintelCacheEntry | undefined) ?? null))
              .catch(() => {
                // ignore
              });
          }
        } else {
          setEntry(null);
        }
      }

      const symbol = currentAssetSymbolRef.current;
      if (!symbol) return;
      const key = intelligenceKey(symbol);
      if (changes[key]) {
        setEntry((changes[key]?.newValue as MarintelCacheEntry | undefined) ?? null);
      }
    };

    load().catch((err) => {
      setPanelError(err instanceof Error ? err.message : "Failed to load panel state");
    });
    chrome.storage.onChanged.addListener(onChanged);

    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async (symbolOverride?: string) => {
    const symbol = (symbolOverride ?? activeSymbol)?.trim().toUpperCase();
    if (!symbol) return;

    setPanelError(null);
    setRefreshing(true);
    try {
      const backendUrl = await resolveBackendBaseUrl();
      const perm = await ensureBackendHostPermission(backendUrl);
      if (!perm.ok) {
        if (perm.reason === "invalid_url") {
          setPanelError("Invalid backend URL in Options. Open Options and set a URL like http://localhost:8787");
        } else {
          setPanelError(
            `Host permission was denied for ${perm.pattern || "backend"}. Click Refresh again and allow access, or open Options and Save the backend URL.`
          );
        }
        const e = await getLocal<MarintelCacheEntry>([intelligenceKey(symbol)]);
        setEntry((e[intelligenceKey(symbol)] as MarintelCacheEntry | undefined) ?? null);
        return;
      }

      const res = (await chrome.runtime.sendMessage({ type: MSG_REFRESH, symbol })) as unknown as
        | { ok: boolean; status: number; error?: string }
        | undefined;
      if (!res) {
        setPanelError("No response from background worker.");
      } else if (!res.ok) {
        setPanelError(res.error ?? `Request failed (status ${res.status})`);
      }

      const e = await getLocal<MarintelCacheEntry>([intelligenceKey(symbol)]);
      setEntry((e[intelligenceKey(symbol)] as MarintelCacheEntry | undefined) ?? null);
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [activeSymbol]);

  /** Opening the side panel is a user gesture; request backend host access early so automatic page detection can fetch. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const backendUrl = await resolveBackendBaseUrl();
        await ensureBackendHostPermission(backendUrl);
      } catch {
        // ignore
      }
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** If the background cached a permission error for the detected symbol, retry fetch after the panel can grant host access. */
  useEffect(() => {
    const sym = asset?.symbol?.trim().toUpperCase();
    if (!sym) return;

    const permissionBlocked = (e: MarintelCacheEntry | null | undefined) =>
      Boolean(
        e &&
          !e.ok &&
          e.status === 0 &&
          typeof e.error === "string" &&
          (e.error.includes("Missing host permission") || e.error.includes("permission"))
      );

    let cancelled = false;
    const id = window.setTimeout(async () => {
      const key = intelligenceKey(sym);
      const local = await getLocal<MarintelCacheEntry>([key]);
      const ent = local[key] as MarintelCacheEntry | undefined;
      if (cancelled) return;
      if (permissionBlocked(ent)) {
        await refresh(sym);
      }
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [asset?.symbol, asset?.detectedAt, refresh]);

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const top = (
    <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-wide text-slate-300/80">MARINTEL</div>
          <div className="truncate text-sm font-semibold text-slate-50">
            {asset ? `${asset.symbol} on ${formatPlatform(asset.platform)}` : "Waiting for a stock page"}
          </div>
          <div className="truncate text-[11px] text-slate-400">
            {backendBaseUrl ? `Backend: ${backendBaseUrl}` : "Backend: not configured"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={openOptions}>
            Options
          </Button>
          <Button onClick={() => refresh()} disabled={!activeSymbol || refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>
    </div>
  );

  const noData = (
    <Card>
      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-50">Open a supported stock page</div>
        <div className="text-xs text-slate-300/80">
          Marintel detects symbols on Groww, Angel One, and Zerodha Kite. Once detected, it fetches a live intelligence
          briefing from your backend.
        </div>
        <div className="text-xs text-slate-300/80">
          You can also fetch directly by symbol using the input below.
        </div>
      </div>
    </Card>
  );

  const input = (
    <Card className="p-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <input
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value)}
          placeholder="Symbol (example: RELIANCE)"
          className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
        />
        <Button onClick={() => refresh(symbolInput)} disabled={symbolInput.trim().length === 0 || refreshing}>
          Fetch
        </Button>
      </div>
    </Card>
  );

  const tabs = (
    <div className="flex flex-wrap gap-2">
      {(
        [
          ["brief", "Brief"],
          ["filings", "Filings"],
          ["news", "News"],
          ["sebi", "SEBI"],
          ["sources", "Sources"]
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setTab(id)}
          className={cn(
            "rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition",
            tab === id
              ? "bg-sky-500/20 text-sky-50 ring-sky-500/35"
              : "bg-slate-900/30 text-slate-200 ring-slate-800 hover:bg-slate-900/50"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const brief = (() => {
    if (!activeSymbol) return null;

    if (!entry) {
      return (
        <Card>
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-10/12" />
          </div>
        </Card>
      );
    }

    if (!entry.ok) {
      return (
        <Card>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-rose-200">Briefing failed</div>
            <div className="text-xs text-slate-200/80">
              {entry.error ?? "The backend returned an error."} (status {entry.status})
            </div>
            <div className="text-xs text-slate-300/70">
              If this is a permissions issue, open Options and save the backend URL to grant host permission.
            </div>
          </div>
        </Card>
      );
    }

    const s = parsed?.synthesis;
    const fin = (s?.financialSnapshot ?? {}) as Record<string, unknown>;
    const metrics: Array<[string, unknown]> = [
      ["Market cap", fin["marketCap"]],
      ["P/E", fin["pe"]],
      ["P/B", fin["pb"]],
      ["EPS", fin["eps"]],
      ["Dividend yield", fin["dividendYield"]],
      ["52W high", fin["week52High"]],
      ["52W low", fin["week52Low"]],
      ["Promoter %", fin["promoterHoldingPct"]],
      ["FII %", fin["fiiHoldingPct"]],
      ["DII %", fin["diiHoldingPct"]]
    ];

    return (
      <div className="space-y-3">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-slate-400">
                Updated {new Date(entry.fetchedAt).toLocaleTimeString()} {entry.cache ? `(${entry.cache})` : ""}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-50">{s?.summary ?? "No summary returned."}</div>
            </div>
            {s ? <SignalBadge signal={s.signal} score={s.signalScore} /> : null}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-50">Snapshot</div>
            <div className="text-[11px] text-slate-400">
              Pipeline latency: {parsed?.latencyMs ? `${parsed.latencyMs} ms` : "N/A"}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                <div className="text-[10px] font-semibold text-slate-400">{label}</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-50">{displayValue(value)}</div>
              </div>
            ))}
          </div>
        </Card>

        {parsed?.traderSentiment || parsed?.priceOutlook ? (
          <Card>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-50">Sentiment and outlook</div>
              <div className="text-[11px] text-slate-400">Experimental</div>
            </div>

            {parsed.traderSentiment ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-slate-50">Trader sentiment</div>
                  {parsed.traderSentiment.label && typeof parsed.traderSentiment.score === "number" ? (
                    <SignalBadge signal={parsed.traderSentiment.label} score={parsed.traderSentiment.score} />
                  ) : null}
                </div>
                <div className="text-[11px] text-slate-400">{parsed.traderSentiment.note ?? "Source: StockTwits"}</div>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div className="text-[10px] font-semibold text-slate-400">Bullish</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-50">
                      {displayValue(parsed.traderSentiment.bullishPct)}%{" "}
                      <span className="text-[10px] font-medium text-slate-400">({displayValue(parsed.traderSentiment.bullishCount)})</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div className="text-[10px] font-semibold text-slate-400">Bearish</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-50">
                      {displayValue(parsed.traderSentiment.bearishPct)}%{" "}
                      <span className="text-[10px] font-medium text-slate-400">({displayValue(parsed.traderSentiment.bearishCount)})</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div className="text-[10px] font-semibold text-slate-400">Messages</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-50">
                      {displayValue(parsed.traderSentiment.totalMessages)}
                    </div>
                  </div>
                </div>

                {parsed.traderSentiment.sampleMessages && parsed.traderSentiment.sampleMessages.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    <div className="text-[11px] font-semibold tracking-wide text-slate-300/80">Recent posts</div>
                    {parsed.traderSentiment.sampleMessages.slice(0, 3).map((m) => (
                      <div key={`${m.id ?? "x"}:${m.createdAt ?? ""}`} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] font-semibold text-slate-200">{m.username ?? "user"}</div>
                          <div className="text-[11px] text-slate-400">{m.sentiment ?? "neutral"}</div>
                        </div>
                        <div className="mt-1 text-xs text-slate-200/85">{m.body}</div>
                      </div>
                    ))}
                    {parsed.traderSentiment.url ? (
                      <a
                        href={parsed.traderSentiment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-[11px] font-semibold text-sky-200/90 underline decoration-sky-400/30"
                      >
                        Open StockTwits
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {parsed.priceOutlook ? (
              <div className={cn("space-y-2", parsed.traderSentiment ? "mt-4 border-t border-slate-800 pt-4" : "mt-3")}>
                <div className="text-xs font-semibold text-slate-50">Price outlook (7D)</div>
                <div className="text-[11px] text-slate-400">{parsed.priceOutlook.note ?? parsed.priceOutlook.method}</div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div className="text-[10px] font-semibold text-slate-400">Last</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-50">
                      {displayValue(parsed.priceOutlook.lastPrice)} {parsed.priceOutlook.currency ?? ""}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div className="text-[10px] font-semibold text-slate-400">Range (90%)</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-50">
                      {displayValue(parsed.priceOutlook.projectedLow)} to {displayValue(parsed.priceOutlook.projectedHigh)}
                    </div>
                    <div className="mt-1 text-[10px] font-medium text-slate-400">
                      {displayValue(parsed.priceOutlook.projectedChangePctLow)}% to {displayValue(parsed.priceOutlook.projectedChangePctHigh)}%
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div className="text-[10px] font-semibold text-slate-400">Vol (daily)</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-50">
                      {displayValue(parsed.priceOutlook.volatilityDailyPct)}%
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div className="text-[10px] font-semibold text-slate-400">Analyst target</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-50">
                      {displayValue(parsed.priceOutlook.analystTarget)}
                    </div>
                  </div>
                </div>

                {parsed.priceOutlook.url ? (
                  <a
                    href={parsed.priceOutlook.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-[11px] font-semibold text-sky-200/90 underline decoration-sky-400/30"
                  >
                    Open Yahoo Finance
                  </a>
                ) : null}
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    );
  })();

  const list = (items: Array<{ title: string; url: string; date?: string | null; summary?: string | null }>, empty: string) => {
    if (!items || items.length === 0) {
      return (
        <Card>
          <div className="text-xs text-slate-300/80">{empty}</div>
        </Card>
      );
    }

    return (
      <div className="space-y-2">
        {items.map((it) => (
          <Card key={it.url}>
            <a href={it.url} target="_blank" rel="noreferrer" className="block space-y-1">
              <div className="text-xs font-semibold text-slate-50">{it.title}</div>
              <div className="text-[11px] text-slate-400">{it.date ?? "Date unknown"}</div>
              {it.summary ? <div className="text-xs text-slate-200/80">{it.summary}</div> : null}
              <div className="text-[11px] text-sky-300/80 underline decoration-sky-400/30">{it.url}</div>
            </a>
          </Card>
        ))}
      </div>
    );
  };

  const filings = list(parsed?.synthesis?.latestFilings ?? [], "No filings found.");

  const sebi = list(
    (parsed?.synthesis?.sebiAlerts ?? []).map((a) => ({ title: a.title, url: a.url, date: a.date, summary: a.summary })),
    "No SEBI actions found."
  );

  const news = (() => {
    const n = parsed?.synthesis?.news;
    const items = n?.items ?? [];
    if (!n || items.length === 0) return <Card><div className="text-xs text-slate-300/80">No news found.</div></Card>;
    return (
      <div className="space-y-2">
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-50">News sentiment</div>
            <div className="text-[11px] text-slate-400">Score: {n.sentimentScore}/100</div>
          </div>
        </Card>
        {items.map((it) => (
          <Card key={it.url}>
            <a href={it.url} target="_blank" rel="noreferrer" className="block space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-50">{it.title}</div>
                <div className="shrink-0 text-[11px] font-semibold text-slate-300">{it.sentiment ?? "neutral"}</div>
              </div>
              <div className="text-[11px] text-slate-400">{it.date ?? "Date unknown"}</div>
              {it.summary ? <div className="text-xs text-slate-200/80">{it.summary}</div> : null}
              <div className="text-[11px] text-sky-300/80 underline decoration-sky-400/30">{it.url}</div>
            </a>
          </Card>
        ))}
      </div>
    );
  })();

  const sources = (() => {
    const citations = parsed?.synthesis?.citations ?? [];
    const warnings = parsed?.warnings ?? [];
    return (
      <div className="space-y-2">
        <Card>
          <div className="text-xs font-semibold text-slate-50">Citations</div>
          <div className="mt-2 space-y-2">
            {citations.length === 0 ? (
              <div className="text-xs text-slate-300/80">No citations returned.</div>
            ) : (
              citations.map((c) => (
                <a
                  key={c.url}
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2"
                >
                  <div className="text-xs font-semibold text-slate-50">{c.label}</div>
                  <div className="text-[11px] text-sky-300/80 underline decoration-sky-400/30">{c.url}</div>
                </a>
              ))
            )}
          </div>
        </Card>

        {warnings && warnings.length > 0 ? (
          <Card>
            <div className="text-xs font-semibold text-slate-50">Warnings</div>
            <ul className="mt-2 space-y-1 text-xs text-slate-200/80">
              {warnings.map((w) => (
                <li key={w}>- {w}</li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    );
  })();

  return (
    <div className="min-h-full bg-slate-950 text-slate-50">
      {top}

      <div className="space-y-3 px-4 py-4">
        {panelError ? (
          <Card>
            <div className="text-xs font-semibold text-rose-200">Panel error</div>
            <div className="mt-1 text-xs text-slate-200/80">{panelError}</div>
          </Card>
        ) : null}

        {!asset ? noData : null}
        {input}
        {tabs}

        {tab === "brief" ? brief : null}
        {tab === "filings" ? filings : null}
        {tab === "news" ? news : null}
        {tab === "sebi" ? sebi : null}
        {tab === "sources" ? sources : null}
      </div>
    </div>
  );
}
