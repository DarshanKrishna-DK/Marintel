import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CandlestickChart,
  Gauge,
  Globe,
  Layers,
  Newspaper,
  ShieldAlert,
  Sparkles,
  Timer,
  Zap
} from "lucide-react";

import { Fragment, type ReactNode } from "react";

import { LiveDemo } from "./components/LiveDemo";
import { MarketScene } from "./components/MarketScene";
import { cn } from "./lib/cn";

function SectionTitle(props: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="text-xs font-semibold tracking-[0.28em] text-sky-300/90">{props.eyebrow}</div>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
        {props.title}
      </h2>
      <p className="mt-3 text-pretty text-sm leading-6 text-slate-200/80 sm:text-base">{props.subtitle}</p>
    </div>
  );
}

function Pill(props: { children: ReactNode; tone?: "sky" | "emerald" | "rose" | "slate" }) {
  const tone =
    props.tone === "emerald"
      ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/20"
      : props.tone === "rose"
        ? "bg-rose-500/10 text-rose-200 ring-rose-500/20"
        : props.tone === "slate"
          ? "bg-slate-500/10 text-slate-100 ring-slate-500/20"
          : "bg-sky-500/10 text-sky-200 ring-sky-500/20";
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset", tone)}>
      {props.children}
    </span>
  );
}

function FeatureCard(props: { icon: ReactNode; title: string; body: string; tone?: "sky" | "emerald" | "rose" }) {
  const glow =
    props.tone === "emerald"
      ? "shadow-[0_0_0_1px_rgba(16,185,129,0.18)_inset,0_30px_90px_rgba(16,185,129,0.07)]"
      : props.tone === "rose"
        ? "shadow-[0_0_0_1px_rgba(244,63,94,0.18)_inset,0_30px_90px_rgba(244,63,94,0.06)]"
        : "shadow-[0_0_0_1px_rgba(56,189,248,0.18)_inset,0_30px_90px_rgba(56,189,248,0.06)]";
  return (
    <div className={cn("rounded-3xl border border-slate-800 bg-slate-950/55 p-5", glow)}>
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-2 text-slate-50">{props.icon}</div>
        <div>
          <div className="text-sm font-semibold text-slate-50">{props.title}</div>
          <div className="mt-1 text-sm leading-6 text-slate-200/80">{props.body}</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-full bg-[#050713] text-slate-50">
      <header className="relative overflow-hidden">
        <div className="absolute inset-0">
          <MarketScene />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050713]/40 via-[#050713]/70 to-[#050713]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(56,189,248,0.18),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.15),transparent_55%)]" />
        </div>

        <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-500/15 ring-1 ring-inset ring-sky-500/25">
              <CandlestickChart className="h-5 w-5 text-sky-200" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Marintel</div>
              <div className="text-[11px] text-slate-300/70">Indian equity intelligence, where you trade</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <a href="#product" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-200/85 hover:bg-slate-900/40">
              Product
            </a>
            <a href="#comparison" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-200/85 hover:bg-slate-900/40">
              Comparison
            </a>
            <a href="#demo" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-200/85 hover:bg-slate-900/40">
              Live demo
            </a>
            <a
              href="#get-started"
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-50 ring-1 ring-inset ring-sky-500/30 hover:bg-sky-500/25"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </nav>

        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-12 sm:pb-24 sm:pt-16">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap gap-2">
                <Pill>
                  <Zap className="h-4 w-4" /> Context-aware
                </Pill>
                <Pill tone="emerald">
                  <Timer className="h-4 w-4" /> 8 to 12 second briefings
                </Pill>
                <Pill tone="slate">
                  <Globe className="h-4 w-4" /> Built for NSE and BSE flows
                </Pill>
              </div>

              <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
                Stop context-switching. Get a clear signal, filings, SEBI checks, and news sentiment in one panel.
              </h1>
              <p className="mt-4 text-pretty text-base leading-7 text-slate-200/80">
                Marintel is a browser extension and backend intelligence engine that detects the stock you are viewing and
                returns a structured, source-backed briefing: summary, signal, snapshot metrics, filings, regulatory alerts,
                and news sentiment.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href="#demo"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500/20 px-5 py-3 text-sm font-semibold text-sky-50 ring-1 ring-inset ring-sky-500/30 hover:bg-sky-500/25"
                >
                  Run live demo <Gauge className="h-4 w-4" />
                </a>
                <a
                  href="#product"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-transparent px-5 py-3 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-slate-800 hover:bg-slate-900/40"
                >
                  See what you get <ArrowRight className="h-4 w-4" />
                </a>
                <div className="text-xs text-slate-400">
                  Not investment advice. Built for speed and clarity, not hype.
                </div>
              </div>
            </div>

            <div className="w-full max-w-xl">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold tracking-wide text-slate-300/80">PANEL PREVIEW</div>
                  <Pill tone="emerald">
                    <BadgeCheck className="h-4 w-4" /> source-backed
                  </Pill>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-50">RELIANCE</div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-500/25">
                      BULLISH <span className="text-[11px] font-medium opacity-80">72/100</span>
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/35 p-4 text-sm text-slate-200/85">
                    Quick read: earnings quality looks stable, recent news flow is mixed. Watch filings and SEBI actions
                    before sizing up.
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ["P/E", "N/A"],
                      ["52W", "N/A"],
                      ["News", "54/100"]
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-2xl border border-slate-800 bg-slate-950/35 p-3">
                        <div className="text-[11px] font-semibold text-slate-400">{k}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-50">{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    This preview is illustrative. The live demo below calls your real backend.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 border-t border-slate-800/60 bg-slate-950/20">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 text-xs text-slate-300/80">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-sky-200/90" />
              <span>Detect symbol</span>
              <span className="opacity-40">•</span>
              <span>Search and scrape</span>
              <span className="opacity-40">•</span>
              <span>Synthesize signal</span>
              <span className="opacity-40">•</span>
              <span>Cache and return</span>
            </div>
            <div className="hidden md:block">Built for trading workflows, optimized for minimal clicks.</div>
          </div>
        </div>
      </header>

      <main>
        <section id="product" className="relative mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <SectionTitle
            eyebrow="WHAT WE DO"
            title="A research brief that follows your cursor"
            subtitle="Marintel turns a noisy research workflow into a single, structured briefing that can be read in under 20 seconds."
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            <FeatureCard
              tone="sky"
              icon={<Sparkles className="h-5 w-5 text-sky-200" />}
              title="Instant signal and summary"
              body="A short, structured summary plus a bullish / neutral / bearish signal score based on the latest context and sources."
            />
            <FeatureCard
              tone="emerald"
              icon={<Newspaper className="h-5 w-5 text-emerald-200" />}
              title="News sentiment, not headlines"
              body="Condensed news items with sentiment labeling so you can spot narrative shifts without doom scrolling."
            />
            <FeatureCard
              tone="rose"
              icon={<ShieldAlert className="h-5 w-5 text-rose-200" />}
              title="Regulatory and SEBI checks"
              body="Surface regulatory actions and SEBI items early so surprises do not show up after you enter a trade."
            />
            <FeatureCard
              icon={<Layers className="h-5 w-5 text-sky-200" />}
              title="Filings and announcements"
              body="Latest filings and announcements listed with direct source links for quick verification."
            />
            <FeatureCard
              icon={<BrainCircuit className="h-5 w-5 text-sky-200" />}
              title="Built to be extended"
              body="The pipeline is modular: add more sources, monitors, or strategies without rewriting the extension."
            />
            <FeatureCard
              icon={<Gauge className="h-5 w-5 text-sky-200" />}
              title="Caching for speed"
              body="Redis-backed caching reduces repeated calls and keeps repeat page views fast and consistent."
            />
          </div>
        </section>

        <section className="relative border-y border-slate-800/70 bg-slate-950/35">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <SectionTitle
              eyebrow="USP"
              title="Designed for a trader's cognitive load"
              subtitle="Marintel optimizes for the moments that matter: before entry, after an unexpected candle, and during news-driven volatility."
            />

            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-2">
                    <Timer className="h-5 w-5 text-sky-200" />
                  </div>
                  <div className="text-base font-semibold text-slate-50">Under 20 seconds to clarity</div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-200/80">
                  The panel is structured like a trade checklist: signal, key metrics, filings, SEBI alerts, and sources.
                  It is intentionally compact so you do not get lost.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-2">
                    <BookOpen className="h-5 w-5 text-emerald-200" />
                  </div>
                  <div className="text-base font-semibold text-slate-50">Always link back to sources</div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-200/80">
                  Every claim is meant to be verifiable. The workflow is: skim the summary, then click the source that
                  matters before you act.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="comparison" className="relative mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <SectionTitle
            eyebrow="COMPARISON"
            title="Why Marintel instead of your current stack?"
            subtitle="Most tools are great individually. The problem is the workflow. Marintel is built to collapse context switching into one panel."
          />

          <div className="mt-10 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/55">
            <div className="grid grid-cols-5 gap-px bg-slate-800/70 text-xs">
              {["Capability", "Marintel", "Screener", "TradingView", "TickerTape"].map((h) => (
                <div key={h} className="bg-slate-950/60 px-4 py-3 font-semibold text-slate-200">
                  {h}
                </div>
              ))}
              {(
                [
                ["Context-aware (detect what you are viewing)", true, false, false, false],
                ["One-call brief (summary + signal + sources)", true, false, false, false],
                ["Filings + SEBI + news in one view", true, false, false, false],
                ["Cache repeated views for speed", true, false, false, false],
                ["Deep charting and indicators", false, false, true, false],
                ["Fundamental deep dive tables", true, true, false, true]
              ] as Array<[string, boolean, boolean, boolean, boolean]>
              ).map(([cap, a, b, c, d]) => (
                <Fragment key={cap}>
                  <div className="bg-slate-950/40 px-4 py-3 text-slate-200/85">{cap}</div>
                  {[a, b, c, d].map((v, idx) => (
                    <div key={`${cap}-${idx}`} className="bg-slate-950/40 px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                          v
                            ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25"
                            : "bg-slate-500/10 text-slate-200/70 ring-slate-500/20"
                        )}
                      >
                        {v ? "Yes" : "No"}
                      </span>
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-400">
            Comparison reflects a typical workflow. Features vary by plan and evolve over time.
          </div>
        </section>

        <section className="relative border-y border-slate-800/70 bg-slate-950/35">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <SectionTitle
              eyebrow="USE CASES"
              title="Built for real decisions, not dashboards"
              subtitle="Whether you trade intraday or invest long-term, Marintel is designed to answer the same question: what changed, and what should I verify?"
            />

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {[
                {
                  title: "Retail traders",
                  body: "Get a fast sanity-check before entries and after news spikes. Reduce overtrading from headline noise.",
                  icon: <CandlestickChart className="h-5 w-5 text-sky-200" />
                },
                {
                  title: "Swing traders",
                  body: "Track filings and regulatory actions between sessions. Catch narrative drift early.",
                  icon: <Newspaper className="h-5 w-5 text-emerald-200" />
                },
                {
                  title: "Long-term investors",
                  body: "Summarize and verify what matters without spending hours jumping between tabs and PDFs.",
                  icon: <BookOpen className="h-5 w-5 text-sky-200" />
                },
                {
                  title: "Analysts",
                  body: "Turn unstructured updates into structured lists and citations. Spend time on judgment, not collection.",
                  icon: <Layers className="h-5 w-5 text-sky-200" />
                },
                {
                  title: "Compliance-aware teams",
                  body: "Make SEBI actions visible in the workflow. Add internal policies later as monitors.",
                  icon: <ShieldAlert className="h-5 w-5 text-rose-200" />
                },
                {
                  title: "Builders",
                  body: "Use the backend as an intelligence API. Extend sources, scoring, and monitors as your edge evolves.",
                  icon: <BrainCircuit className="h-5 w-5 text-sky-200" />
                }
              ].map((c) => (
                <div key={c.title} className="rounded-3xl border border-slate-800 bg-slate-950/55 p-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-2">{c.icon}</div>
                    <div className="text-base font-semibold text-slate-50">{c.title}</div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-200/80">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="demo" className="relative mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <SectionTitle
            eyebrow="TRY IT"
            title="Live intelligence briefing"
            subtitle="This section calls your backend `POST /intelligence` in real time. No mock data."
          />
          <div className="mt-10">
            <LiveDemo />
          </div>
        </section>

        <section id="get-started" className="relative mx-auto max-w-6xl px-6 pb-20 pt-4 sm:pb-28">
          <SectionTitle
            eyebrow="GET STARTED"
            title="Install locally and see it in your trading flow"
            subtitle="Marintel is built as a Chrome extension + backend API. Run the backend, load the extension unpacked, then open a stock page."
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-2">
                  <Zap className="h-5 w-5 text-sky-200" />
                </div>
                <div className="text-base font-semibold text-slate-50">Backend</div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/30 p-4 font-mono text-xs text-slate-200/85">
                <div>cd backend</div>
                <div>npm run dev</div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-200/80">
                Ensure your API keys are set in <span className="font-semibold text-slate-100">backend/.env</span>.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-2">
                  <BadgeCheck className="h-5 w-5 text-emerald-200" />
                </div>
                <div className="text-base font-semibold text-slate-50">Extension</div>
              </div>
              <ol className="mt-4 space-y-2 text-sm text-slate-200/80">
                <li>1. Open chrome://extensions</li>
                <li>2. Enable Developer mode</li>
                <li>3. Load unpacked and select the extension/ folder</li>
                <li>4. Open Options, set backend URL, click Save</li>
                <li>5. Click the extension icon to open the side panel</li>
              </ol>
              <p className="mt-3 text-sm leading-6 text-slate-200/80">
                Then open Groww or Angel One for a stock. The panel will update live.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-3xl border border-slate-800 bg-slate-950/35 p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-2">
                <ShieldAlert className="h-5 w-5 text-rose-200" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-50">Disclaimer</div>
                <p className="mt-2 text-sm leading-6 text-slate-200/80">
                  Marintel provides structured information and links to sources. It does not provide financial advice.
                  Always verify filings and regulatory actions before making decisions.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/70 bg-slate-950/30">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10 text-sm text-slate-300/75 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CandlestickChart className="h-4 w-4 text-sky-200/90" />
            <span className="font-semibold text-slate-100">Marintel</span>
            <span className="opacity-50">·</span>
            <span>Browser extension for Indian equity intelligence</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-slate-500/10 px-2 py-0.5 ring-1 ring-inset ring-slate-500/20">MVP</span>
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 ring-1 ring-inset ring-sky-500/20">Dynamic</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 ring-1 ring-inset ring-emerald-500/20">Source-backed</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
