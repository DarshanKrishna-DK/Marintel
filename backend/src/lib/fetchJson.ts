export type FetchJsonResult<T> = {
  ok: boolean;
  status: number;
  headers: Headers;
  data: T;
};

type FetchJsonOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
};

export async function fetchJson<T>(url: string, opts: FetchJsonOptions): Promise<FetchJsonResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    const init: RequestInit = {
      method: opts.method ?? "GET",
      headers,
      signal: controller.signal
    };

    if (opts.body !== undefined) {
      headers["content-type"] = headers["content-type"] ?? "application/json";
      init.body = JSON.stringify(opts.body);
    }

    const res = await fetch(url, {
      ...init
    });

    const text = await res.text();
    const data = text.length === 0 ? (null as T) : (JSON.parse(text) as T);

    return { ok: res.ok, status: res.status, headers: res.headers, data };
  } finally {
    clearTimeout(timeout);
  }
}

