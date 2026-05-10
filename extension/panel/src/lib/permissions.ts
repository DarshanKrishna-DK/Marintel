const DEFAULT_BACKEND_BASE_URL = "http://localhost:8787";

export function normalizeBackendBaseUrl(raw: unknown): string {
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim().replace(/\/+$/, "");
  return DEFAULT_BACKEND_BASE_URL;
}

/** Matches Options / background: scheme + hostname + /* (all ports). */
export function originPatternForBackendUrl(backendBaseUrl: string): string {
  const u = new URL(backendBaseUrl);
  return `${u.protocol}//${u.hostname}/*`;
}

export async function resolveBackendBaseUrl(): Promise<string> {
  const sync = await chrome.storage.sync.get(["backendBaseUrl"]);
  return normalizeBackendBaseUrl(sync.backendBaseUrl);
}

/**
 * Ensures optional host permission for the backend origin.
 * Must run from an extension UI context (side panel) after a user gesture so Chrome can show the prompt.
 */
export async function ensureBackendHostPermission(backendBaseUrl: string): Promise<{ ok: true } | { ok: false; pattern: string; reason: "invalid_url" | "denied" }> {
  let pattern: string;
  try {
    pattern = originPatternForBackendUrl(backendBaseUrl.replace(/\/+$/, ""));
  } catch {
    return { ok: false, pattern: "", reason: "invalid_url" };
  }

  try {
    const has = await chrome.permissions.contains({ origins: [pattern] });
    if (has) return { ok: true };
    const granted = await chrome.permissions.request({ origins: [pattern] });
    if (granted) return { ok: true };
    return { ok: false, pattern, reason: "denied" };
  } catch {
    return { ok: false, pattern, reason: "denied" };
  }
}
