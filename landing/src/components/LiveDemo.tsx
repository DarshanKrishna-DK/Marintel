import { useEffect, useMemo, useState } from "react";
import { fetchHealth, fetchIntelligence, getBackendBaseUrl, type FetchMeta, type IntelligenceResponse } from "../lib/marintelApi";
import { cn } from "../lib/cn";

function SignalPill(props: { signal: "bullish" | "neutral" | "bearish"; score: number }) {
  const tone =
    props.signal === "bullish"
      ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25"
      : props.signal === "bearish"
        ? "bg-rose-500/15 text-rose-200 ring-rose-500/25"
        : "bg-slate-500/15 text-slate-100 ring-slate-500/25";
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1", tone)}>
      <span>{props.signal.toUpperCase()}</span>
      <span className="text-[11px] font-medium opacity-80">{props.score}/100</span>
    </span>
  );
}

export function LiveDemo() {
  const [symbol, setSymbol] = useState("RELIANCE");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<FetchMeta | null>(null);
  const [data, setData] = useState<IntelligenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const baseUrl = useMemo(() => getBackendBaseUrl(), []);

  useEffect(() => {
    fetchHealth()
      .then((r) => setBackendOk(Boolean(r.ok)))
      .catch(() => setBackendOk(false));
  }, []);

  const run = async (overrideSymbol?: string) => {
    const s = (overrideSymbol ?? symbol).trim().toUpperCase();
    if (!s) return;
    setLoading(true);
    setError(null);
    setMeta(null);
    try {
      const res = await fetchIntelligence(s);
      setMeta(res.meta);
      setData(res.data);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const synthesis = data?.synthesis ?? null;
  const citations = synthesis?.citations ?? [];

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]">
      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold tracking-wide text-slate-300/80">LIVE DEMO</div>
        <div className="text-lg font-semibold text-slate-50">Generate a briefing in one call</div>
        <div className="text-sm text-slate-300/80">
          Backend: <span className="font-medium text-slate-200">{baseUrl}</span>{" "}
          <span
            className={cn(
              "ml-2 rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset",
              backendOk === false
                ? "bg-rose-500/15 text-rose-200 ring-rose-500/25"
                : backendOk === true
                  ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25"
                  : "bg-slate-500/15 text-slate-100 ring-slate-500/25"
            )}
          >
            {backendOk === false ? "offline" : backendOk === true ? "online" : "checking"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="h-11 w-full rounded-2xl border border-slate-800 bg-slate-900/40 px-4 text-sm font-semibold tracking-wide text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/60 sm:w-[260px]"
          placeholder="RELIANCE"
        />
        <button
          type="button"
          onClick={() => run()}
          disabled={loading}
          className="h-11 rounded-2xl bg-sky-500/20 px-5 text-sm font-semibold text-sky-50 ring-1 ring-inset ring-sky-500/30 transition hover:bg-sky-500/25 focus:outline-none focus:ring-2 focus:ring-sky-400/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Running..." : "Generate briefing"}
        </button>
        <button
          type="button"
          onClick={() => {
            setSymbol("TCS");
            run("TCS");
          }}
          className="h-11 rounded-2xl bg-transparent px-4 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-slate-800 transition hover:bg-slate-900/40 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
        >
          Try TCS
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {synthesis ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-50">{data?.symbol}</div>
            <SignalPill signal={synthesis.signal} score={synthesis.signalScore} />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/35 p-4">
            <div className="text-sm font-semibold text-slate-50">Summary</div>
            <div className="mt-1 text-sm text-slate-200/85">{synthesis.summary}</div>
            {meta ? (
              <div className="mt-3 text-[11px] text-slate-400">
                Status {meta.status} · Cache {meta.cache ?? "n/a"} · Request {meta.requestId ?? "n/a"} · Pipeline latency {data?.latencyMs ?? "n/a"} ms
              </div>
            ) : null}
          </div>

          {citations.length > 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/25 p-4">
              <div className="text-sm font-semibold text-slate-50">Sources</div>
              <div className="mt-2 space-y-2">
                {citations.slice(0, 4).map((c) => (
                  <a
                    key={c.url}
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 transition hover:bg-slate-950/45"
                  >
                    <div className="text-xs font-semibold text-slate-100">{c.label}</div>
                    <div className="text-[11px] text-sky-300/80 underline decoration-sky-400/30">{c.url}</div>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

