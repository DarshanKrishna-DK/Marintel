import { z } from "zod";

import type { Env } from "../env";
import { fetchJson } from "../lib/fetchJson";
import { sleep } from "../lib/sleep";

const UrlScraperSubmitResponseSchema = z.object({
  jobId: z.string().min(1)
});

const JobStatusSchema = z.enum(["pending", "processing", "completed", "failed"]);

const UrlScraperResultSchema = z
  .object({
    id: z.string().optional(),
    status: JobStatusSchema,
    url: z.string().optional(),
    html: z.string().optional(),
    cleanedHtml: z.string().optional(),
    markdown: z.string().optional(),
    generatedJson: z.unknown().optional(),
    cached: z.boolean().optional(),
    durationMs: z.number().optional(),
    error: z.unknown().optional(),
    results: z.unknown().optional()
  })
  .passthrough();

const SearchResponseSchema = z.object({
  id: z.string().min(1),
  results: z
    .array(
      z
        .object({
          url: z.string().url(),
          title: z.string().optional(),
          snippet: z.string().optional(),
          date: z.string().optional(),
          last_updated: z.string().optional()
        })
        .passthrough()
    )
    .default([])
});

const AgenticSearchSubmitResponseSchema = z.object({
  job_id: z.string().min(1),
  status: z.string().optional(),
  message: z.string().optional(),
  created_at: z.string().optional()
});

const AgenticSearchResultSchema = z
  .object({
    id: z.string().min(1).optional(),
    status: JobStatusSchema,
    jobType: z.string().optional(),
    generatedJson: z.unknown().optional(),
    createdAt: z.string().optional(),
    completedAt: z.string().optional(),
    durationMs: z.number().optional()
  })
  .passthrough();

export type AnakinSearchResult = z.infer<typeof SearchResponseSchema>["results"][number];

const WireSearchResponseSchema = z.object({
  results: z
    .array(
      z
        .object({
          action_id: z.string().min(1),
          catalog_name: z.string().optional(),
          catalog_slug: z.string().optional(),
          name: z.string().optional(),
          description: z.string().optional(),
          mode: z.string().optional(),
          auth_required: z.boolean().optional(),
          connected: z.boolean().optional(),
          params: z.unknown().optional(),
          credits: z.number().optional()
        })
        .passthrough()
    )
    .default([])
});

const WireTaskSubmitResponseSchema = z
  .object({
    job_id: z.string().min(1),
    status: z.string().optional(),
    poll_url: z.string().optional()
  })
  .passthrough();

const WireJobStatusSchema = z.enum(["processing", "completed", "failed"]);

const WireJobSchema = z
  .object({
    status: WireJobStatusSchema,
    data: z.unknown().optional(),
    credits_used: z.number().optional(),
    execution_ms: z.number().optional(),
    error: z.unknown().optional()
  })
  .passthrough();

type UrlScrapeOptions = {
  url: string;
  country?: string;
  useBrowser?: boolean;
  generateJson?: boolean;
  sessionId?: string;
};

export class AnakinClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(env: Env) {
    if (!env.ANAKIN_API_KEY) throw new Error("ANAKIN_API_KEY is not set");
    this.baseUrl = env.ANAKIN_API_BASE_URL.replace(/\/+$/, "");
    this.apiKey = env.ANAKIN_API_KEY;
  }

  private headers() {
    return {
      "X-API-Key": this.apiKey
    };
  }

  async submitUrlScrapeJob(opts: UrlScrapeOptions): Promise<string> {
    const res = await fetchJson<unknown>(`${this.baseUrl}/url-scraper`, {
      method: "POST",
      headers: this.headers(),
      body: {
        url: opts.url,
        country: opts.country,
        useBrowser: opts.useBrowser,
        generateJson: opts.generateJson,
        sessionId: opts.sessionId
      },
      timeoutMs: 20_000
    });

    if (!res.ok) {
      throw new Error(`Anakin url-scraper submit failed: HTTP ${res.status}`);
    }

    const parsed = UrlScraperSubmitResponseSchema.safeParse(res.data);
    if (!parsed.success) {
      throw new Error("Anakin url-scraper submit returned unexpected shape");
    }

    return parsed.data.jobId;
  }

  async getUrlScrapeJob(id: string): Promise<z.infer<typeof UrlScraperResultSchema>> {
    const res = await fetchJson<unknown>(`${this.baseUrl}/url-scraper/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: this.headers(),
      timeoutMs: 20_000
    });

    if (!res.ok) {
      throw new Error(`Anakin url-scraper get failed: HTTP ${res.status}`);
    }

    const parsed = UrlScraperResultSchema.safeParse(res.data);
    if (!parsed.success) {
      throw new Error("Anakin url-scraper get returned unexpected shape");
    }

    return parsed.data;
  }

  async scrapeUrl(opts: UrlScrapeOptions & { timeoutMs: number }): Promise<z.infer<typeof UrlScraperResultSchema>> {
    const jobId = await this.submitUrlScrapeJob(opts);
    const startedAt = Date.now();

    let delayMs = 500;
    while (Date.now() - startedAt < opts.timeoutMs) {
      const job = await this.getUrlScrapeJob(jobId);
      if (job.status === "completed" || job.status === "failed") return job;
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 1.5, 4000);
    }

    throw new Error("Anakin url-scraper timed out");
  }

  async search(opts: { prompt: string; limit?: number; timeoutMs: number }): Promise<z.infer<typeof SearchResponseSchema>> {
    const res = await fetchJson<unknown>(`${this.baseUrl}/search`, {
      method: "POST",
      headers: this.headers(),
      body: {
        prompt: opts.prompt,
        limit: opts.limit
      },
      timeoutMs: opts.timeoutMs
    });

    if (!res.ok) {
      throw new Error(`Anakin search failed: HTTP ${res.status}`);
    }

    const parsed = SearchResponseSchema.safeParse(res.data);
    if (!parsed.success) {
      throw new Error("Anakin search returned unexpected shape");
    }

    return parsed.data;
  }

  async submitAgenticSearchJob(opts: { prompt: string; timeoutMs: number }): Promise<string> {
    const res = await fetchJson<unknown>(`${this.baseUrl}/agentic-search`, {
      method: "POST",
      headers: this.headers(),
      body: {
        prompt: opts.prompt
      },
      timeoutMs: opts.timeoutMs
    });

    if (!res.ok) {
      throw new Error(`Anakin agentic-search submit failed: HTTP ${res.status}`);
    }

    const parsed = AgenticSearchSubmitResponseSchema.safeParse(res.data);
    if (!parsed.success) {
      throw new Error("Anakin agentic-search submit returned unexpected shape");
    }

    return parsed.data.job_id;
  }

  async getAgenticSearchJob(id: string): Promise<z.infer<typeof AgenticSearchResultSchema>> {
    const res = await fetchJson<unknown>(`${this.baseUrl}/agentic-search/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: this.headers(),
      timeoutMs: 20_000
    });

    if (!res.ok) {
      throw new Error(`Anakin agentic-search get failed: HTTP ${res.status}`);
    }

    const parsed = AgenticSearchResultSchema.safeParse(res.data);
    if (!parsed.success) {
      throw new Error("Anakin agentic-search get returned unexpected shape");
    }

    return parsed.data;
  }

  async agenticSearch(opts: { prompt: string; timeoutMs: number }): Promise<z.infer<typeof AgenticSearchResultSchema>> {
    const jobId = await this.submitAgenticSearchJob({ prompt: opts.prompt, timeoutMs: 20_000 });
    const startedAt = Date.now();

    let delayMs = 750;
    while (Date.now() - startedAt < opts.timeoutMs) {
      const job = await this.getAgenticSearchJob(jobId);
      if (job.status === "completed" || job.status === "failed") return job;
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 1.4, 5000);
    }

    throw new Error("Anakin agentic-search timed out");
  }

  async wireSearchActions(opts: {
    q?: string;
    catalog?: string;
    category?: string;
    auth?: boolean;
    timeoutMs: number;
  }): Promise<z.infer<typeof WireSearchResponseSchema>> {
    const url = new URL(`${this.baseUrl}/holocron/search`);
    if (opts.q) url.searchParams.set("q", opts.q);
    if (opts.catalog) url.searchParams.set("catalog", opts.catalog);
    if (opts.category) url.searchParams.set("category", opts.category);
    if (typeof opts.auth === "boolean") url.searchParams.set("auth", String(opts.auth));

    const res = await fetchJson<unknown>(url.toString(), {
      method: "GET",
      headers: this.headers(),
      timeoutMs: opts.timeoutMs
    });

    if (!res.ok) {
      throw new Error(`Anakin wire search failed: HTTP ${res.status}`);
    }

    const parsed = WireSearchResponseSchema.safeParse(res.data);
    if (!parsed.success) {
      throw new Error("Anakin wire search returned unexpected shape");
    }
    return parsed.data;
  }

  async wireSubmitTask(opts: {
    actionId: string;
    params: Record<string, unknown>;
    credentialId?: string;
    timeoutMs: number;
  }): Promise<string> {
    const res = await fetchJson<unknown>(`${this.baseUrl}/holocron/task`, {
      method: "POST",
      headers: this.headers(),
      body: {
        action_id: opts.actionId,
        credential_id: opts.credentialId,
        params: opts.params
      },
      timeoutMs: opts.timeoutMs
    });

    if (!res.ok) {
      const msg =
        typeof (res.data as any)?.error?.message === "string"
          ? (res.data as any).error.message
          : `HTTP ${res.status}`;
      throw new Error(`Anakin wire task submit failed: ${msg}`);
    }

    const parsed = WireTaskSubmitResponseSchema.safeParse(res.data);
    if (!parsed.success) {
      throw new Error("Anakin wire task submit returned unexpected shape");
    }

    return parsed.data.job_id;
  }

  async wireGetJob(id: string, timeoutMs: number): Promise<z.infer<typeof WireJobSchema>> {
    const res = await fetchJson<unknown>(`${this.baseUrl}/holocron/jobs/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: this.headers(),
      timeoutMs
    });

    if (!res.ok) {
      throw new Error(`Anakin wire job get failed: HTTP ${res.status}`);
    }

    const parsed = WireJobSchema.safeParse(res.data);
    if (!parsed.success) {
      throw new Error("Anakin wire job get returned unexpected shape");
    }
    return parsed.data;
  }

  async wireRunTask(opts: {
    actionId: string;
    params: Record<string, unknown>;
    credentialId?: string;
    timeoutMs: number;
  }): Promise<
    | { status: "completed"; data: unknown; creditsUsed: number | null; executionMs: number | null }
    | { status: "failed"; error: string; creditsUsed: number | null; executionMs: number | null }
  > {
    const submitOpts: { actionId: string; params: Record<string, unknown>; timeoutMs: number; credentialId?: string } = {
      actionId: opts.actionId,
      params: opts.params,
      timeoutMs: Math.min(opts.timeoutMs, 20_000)
    };
    if (opts.credentialId) submitOpts.credentialId = opts.credentialId;

    const jobId = await this.wireSubmitTask(submitOpts);

    const startedAt = Date.now();
    let delayMs = 1500;

    while (Date.now() - startedAt < opts.timeoutMs) {
      const job = await this.wireGetJob(jobId, Math.min(15_000, opts.timeoutMs));

      if (job.status === "completed") {
        return {
          status: "completed",
          data: job.data ?? null,
          creditsUsed: typeof job.credits_used === "number" ? job.credits_used : null,
          executionMs: typeof job.execution_ms === "number" ? job.execution_ms : null
        };
      }

      if (job.status === "failed") {
        const msg =
          typeof (job.error as any)?.message === "string"
            ? String((job.error as any).message)
            : typeof job.error === "string"
              ? job.error
              : "wire task failed";
        return {
          status: "failed",
          error: msg,
          creditsUsed: typeof job.credits_used === "number" ? job.credits_used : null,
          executionMs: typeof job.execution_ms === "number" ? job.execution_ms : null
        };
      }

      await sleep(delayMs);
      delayMs = Math.min(Math.round(delayMs * 1.25), 4000);
    }

    return { status: "failed", error: "wire task timed out", creditsUsed: null, executionMs: null };
  }
}

