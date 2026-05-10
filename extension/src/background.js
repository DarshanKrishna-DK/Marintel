const DEFAULT_BACKEND_BASE_URL = "http://localhost:8787";

const MSG_ASSET_DETECTED = "MARINTEL_ASSET_DETECTED";
const MSG_REFRESH = "MARINTEL_REFRESH";

const STORAGE_CURRENT_ASSET_KEY = "marintel:currentAsset";

async function getBackendBaseUrl() {
  const stored = await chrome.storage.sync.get(["backendBaseUrl"]);
  const raw = stored.backendBaseUrl;
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim().replace(/\/+$/, "");
  return DEFAULT_BACKEND_BASE_URL;
}

function toOriginPattern(url) {
  const u = new URL(url);
  // Keep this in sync with Options. Host permissions are granted per scheme + hostname.
  return `${u.protocol}//${u.hostname}/*`;
}

async function hasHostPermission(url) {
  const originPattern = toOriginPattern(url);
  return await chrome.permissions.contains({ origins: [originPattern] });
}

async function fetchIntelligence(backendBaseUrl, symbol) {
  try {
    const res = await fetch(`${backendBaseUrl}/intelligence`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol, type: "equity" })
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text ? { message: text } : null;
    }

    const cache = res.headers.get("x-marintel-cache");

    if (res.ok) return { ok: true, status: res.status, cache, data };

    const msg =
      (data && typeof data === "object" && typeof data.error?.message === "string" && data.error.message) ||
      (data && typeof data === "object" && typeof data.message === "string" && data.message) ||
      `HTTP ${res.status}`;
    return { ok: false, status: res.status, cache, data, error: msg };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, cache: null, data: null, error: msg };
  }
}

async function handleFetch(symbol) {
  const backendBaseUrl = await getBackendBaseUrl();
  const permissionOk = await hasHostPermission(backendBaseUrl);
  if (!permissionOk) {
    const result = {
      ok: false,
      status: 0,
      error: "Missing host permission for backend. Open extension Options and save the backend URL to grant permission."
    };
    await chrome.storage.local.set({
      [`intelligence:${symbol}`]: { fetchedAt: new Date().toISOString(), ...result }
    });
    return result;
  }

  const result = await fetchIntelligence(backendBaseUrl, symbol);
  await chrome.storage.local.set({
    [`intelligence:${symbol}`]: { fetchedAt: new Date().toISOString(), ...result }
  });
  return result;
}

async function refetchCurrentAssetIfAny() {
  const local = await chrome.storage.local.get([STORAGE_CURRENT_ASSET_KEY]);
  const asset = local[STORAGE_CURRENT_ASSET_KEY];
  const symbol = typeof asset?.symbol === "string" ? asset.symbol.trim().toUpperCase() : "";
  if (symbol.length === 0) return;
  await handleFetch(symbol);
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(["backendBaseUrl"]);
  if (!existing.backendBaseUrl) {
    await chrome.storage.sync.set({ backendBaseUrl: DEFAULT_BACKEND_BASE_URL });
  }

  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
      // ignore
    });
  }
});

/** After Options save or side-panel permission prompt, pull intelligence again without requiring a new navigation. */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.backendBaseUrl) {
    refetchCurrentAssetIfAny().catch(() => {
      // ignore
    });
  }
});

if (chrome.permissions?.onAdded) {
  chrome.permissions.onAdded.addListener(() => {
    refetchCurrentAssetIfAny().catch(() => {
      // ignore
    });
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return;

  if (message.type === MSG_ASSET_DETECTED) {
    (async () => {
      const symbol = String(message.symbol ?? "").trim().toUpperCase();
      const platform = String(message.platform ?? "unknown");
      const url = String(message.url ?? "");

      if (symbol.length > 0) {
        await chrome.storage.local.set({
          [STORAGE_CURRENT_ASSET_KEY]: { symbol, platform, url, detectedAt: new Date().toISOString() }
        });
      }

      const result = await handleFetch(symbol);
      sendResponse(result);
    })().catch((err) => {
      sendResponse({ ok: false, status: 0, error: err instanceof Error ? err.message : "unknown error" });
    });

    return true;
  }

  if (message.type === MSG_REFRESH) {
    (async () => {
      const symbol = String(message.symbol ?? "").trim().toUpperCase();
      if (symbol.length === 0) {
        sendResponse({ ok: false, status: 400, error: "Symbol is required" });
        return;
      }

      const result = await handleFetch(symbol);
      sendResponse(result);
    })().catch((err) => {
      sendResponse({ ok: false, status: 0, error: err instanceof Error ? err.message : "unknown error" });
    });

    return true;
  }
});
