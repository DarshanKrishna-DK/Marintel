import { z } from "zod";

import type { Env } from "../env";
import { fetchJson } from "../lib/fetchJson";

const GroqChatCompletionResponseSchema = z.object({
  id: z.string().optional(),
  choices: z.array(
    z.object({
      index: z.number().optional(),
      message: z.object({
        role: z.string().optional(),
        content: z.string().nullable().optional()
      })
    })
  )
});

export type GroqSignal = "bullish" | "neutral" | "bearish";

export type IntelligenceSynthesis = {
  summary: string;
  signal: GroqSignal;
  signalScore: number;
  financialSnapshot: {
    marketCap: string | null;
    pe: number | null;
    pb: number | null;
    eps: number | null;
    dividendYield: number | null;
    week52High: number | null;
    week52Low: number | null;
    promoterHoldingPct: number | null;
    fiiHoldingPct: number | null;
    diiHoldingPct: number | null;
  };
  latestFilings: Array<{
    date: string | null;
    exchange: string | null;
    title: string;
    url: string;
    summary: string | null;
  }>;
  sebiAlerts: Array<{
    date: string | null;
    title: string;
    url: string;
    severity: "low" | "medium" | "high" | null;
    summary: string | null;
  }>;
  news: {
    sentimentScore: number;
    items: Array<{
      title: string;
      url: string;
      sentiment: "positive" | "negative" | "neutral" | null;
      summary: string | null;
      date: string | null;
    }>;
  };
  citations: Array<{ label: string; url: string }>;
};

function coerceNullableNumber(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const cleaned = input.replace(/[^0-9+.,-]/g, "").replace(/,/g, "");
    if (cleaned.trim() === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const SignalSchema = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  return v.trim().toLowerCase();
}, z.enum(["bullish", "neutral", "bearish"]));

const ScoreSchema = z.preprocess((v) => {
  const n = coerceNullableNumber(v);
  if (n === null) return v;
  return Math.max(0, Math.min(100, Math.round(n)));
}, z.number().int().min(0).max(100));

const NullableNumberSchema = z.preprocess((v) => coerceNullableNumber(v), z.number().nullable());

const SynthesisSchema: z.ZodType<IntelligenceSynthesis> = z.object({
  summary: z.string().min(1),
  signal: SignalSchema,
  signalScore: ScoreSchema,
  financialSnapshot: z
    .object({
      marketCap: z.string().nullable().default(null),
      pe: NullableNumberSchema.default(null),
      pb: NullableNumberSchema.default(null),
      eps: NullableNumberSchema.default(null),
      dividendYield: NullableNumberSchema.default(null),
      week52High: NullableNumberSchema.default(null),
      week52Low: NullableNumberSchema.default(null),
      promoterHoldingPct: NullableNumberSchema.default(null),
      fiiHoldingPct: NullableNumberSchema.default(null),
      diiHoldingPct: NullableNumberSchema.default(null)
    })
    .default({
      marketCap: null,
      pe: null,
      pb: null,
      eps: null,
      dividendYield: null,
      week52High: null,
      week52Low: null,
      promoterHoldingPct: null,
      fiiHoldingPct: null,
      diiHoldingPct: null
    }),
  latestFilings: z
    .array(
      z.object({
        date: z.string().nullable().default(null),
        exchange: z.string().nullable().default(null),
        title: z.string().min(1),
        url: z.string().url(),
        summary: z.string().nullable().default(null)
      })
    )
    .default([]),
  sebiAlerts: z
    .array(
      z.object({
        date: z.string().nullable().default(null),
        title: z.string().min(1),
        url: z.string().url(),
        severity: z.enum(["low", "medium", "high"]).nullable().default(null),
        summary: z.string().nullable().default(null)
      })
    )
    .default([]),
  news: z
    .object({
      sentimentScore: ScoreSchema.default(50),
      items: z
        .array(
          z.object({
            title: z.string().min(1),
            url: z.string().url(),
            sentiment: z.enum(["positive", "negative", "neutral"]).nullable().default(null),
            summary: z.string().nullable().default(null),
            date: z.string().nullable().default(null)
          })
        )
        .default([])
    })
    .default({ sentimentScore: 50, items: [] }),
  citations: z
    .array(
      z.object({
        label: z.string().min(1),
        url: z.string().url()
      })
    )
    .default([])
});

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const slice = text.slice(start, end + 1);
      return JSON.parse(slice);
    }
    throw new Error("Failed to parse JSON from Groq response");
  }
}

export class GroqClient {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(env: Env) {
    if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");
    this.apiKey = env.GROQ_API_KEY;
    this.model = "llama-3.3-70b-versatile";
  }

  async synthesizeIntelligence(opts: {
    symbol: string;
    screenerMarkdown?: string | null;
    filings?: unknown;
    sebi?: unknown;
    newsResults?: unknown;
    traderSentiment?: unknown;
    priceOutlook?: unknown;
    timeoutMs: number;
  }): Promise<IntelligenceSynthesis> {
    const system = [
      "You are Marintel, an AI that generates factual, cited intelligence briefings for Indian equities.",
      "You must only use the provided data and links. Do not invent numbers or events.",
      "Return a single JSON object that matches the required schema."
    ].join("\n");

    const outputSkeleton = {
      summary: "2 to 3 sentences",
      signal: "neutral",
      signalScore: 50,
      financialSnapshot: {
        marketCap: null,
        pe: null,
        pb: null,
        eps: null,
        dividendYield: null,
        week52High: null,
        week52Low: null,
        promoterHoldingPct: null,
        fiiHoldingPct: null,
        diiHoldingPct: null
      },
      latestFilings: [],
      sebiAlerts: [],
      news: { sentimentScore: 50, items: [] },
      citations: []
    };

    const user = [
      `NSE symbol: ${opts.symbol}`,
      "",
      "Screener markdown (may be partial):",
      opts.screenerMarkdown ? opts.screenerMarkdown : "(missing)",
      "",
      "Latest filings / exchange announcements research (JSON):",
      JSON.stringify(opts.filings ?? null),
      "",
      "SEBI orders / regulatory actions research (JSON):",
      JSON.stringify(opts.sebi ?? null),
      "",
      "News search results (JSON):",
      JSON.stringify(opts.newsResults ?? null),
      "",
      "Trader sentiment (StockTwits / Wire) (JSON):",
      JSON.stringify(opts.traderSentiment ?? null),
      "",
      "Price outlook inputs (Yahoo Finance / Wire) (JSON):",
      JSON.stringify(opts.priceOutlook ?? null),
      "",
      "Return JSON in exactly this shape (fill values, keep keys):",
      JSON.stringify(outputSkeleton, null, 2),
      "",
      "Notes:",
      "- signal must be one of: bullish, neutral, bearish",
      "- signalScore must be 0-100",
      "- If a value is missing, set it to null or omit the optional field, and keep arrays empty when unknown",
      "- citations: include source URLs you relied on (use short labels like 'Screener', 'NSE filing', 'News')"
    ].join("\n");

    const res = await fetchJson<unknown>("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`
      },
      body: {
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      },
      timeoutMs: opts.timeoutMs
    });

    if (!res.ok) {
      throw new Error(`Groq chat completion failed: HTTP ${res.status}`);
    }

    const parsed = GroqChatCompletionResponseSchema.safeParse(res.data);
    if (!parsed.success) {
      throw new Error("Groq returned unexpected shape");
    }

    const content = parsed.data.choices[0]?.message.content ?? null;
    if (!content) throw new Error("Groq returned empty content");

    const json = safeJsonParse(content);
    const synthesis = SynthesisSchema.safeParse(json);
    if (synthesis.success) return synthesis.data;

    const firstIssues = synthesis.error.issues.slice(0, 5).map((i) => ({
      path: i.path.join("."),
      message: i.message
    }));

    // Repair pass: ask Groq to rewrite into the exact schema.
    const repairRes = await fetchJson<unknown>("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`
      },
      body: {
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You fix JSON outputs to match a required schema exactly." },
          {
            role: "user",
            content: [
              "Rewrite the following JSON to match the required schema exactly.",
              "Required shape:",
              JSON.stringify(outputSkeleton, null, 2),
              "",
              "Original output:",
              content
            ].join("\n")
          }
        ]
      },
      timeoutMs: opts.timeoutMs
    });

    if (!repairRes.ok) {
      throw new Error(`Groq JSON did not match expected schema. Issues: ${JSON.stringify(firstIssues)}`);
    }

    const repairParsed = GroqChatCompletionResponseSchema.safeParse(repairRes.data);
    const repairContent = repairParsed.success ? repairParsed.data.choices[0]?.message.content ?? null : null;
    if (!repairContent) {
      throw new Error(`Groq JSON did not match expected schema. Issues: ${JSON.stringify(firstIssues)}`);
    }

    const repairedJson = safeJsonParse(repairContent);
    const repaired = SynthesisSchema.safeParse(repairedJson);
    if (!repaired.success) {
      const repairIssues = repaired.error.issues.slice(0, 5).map((i) => ({
        path: i.path.join("."),
        message: i.message
      }));
      const snippet = repairContent.length > 800 ? repairContent.slice(0, 800) + "..." : repairContent;
      throw new Error(
        `Groq JSON did not match expected schema. InitialIssues: ${JSON.stringify(firstIssues)} RepairIssues: ${JSON.stringify(
          repairIssues
        )} RepairSnippet: ${snippet}`
      );
    }
    return repaired.data;
  }
}

