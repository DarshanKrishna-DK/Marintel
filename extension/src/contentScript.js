(() => {
  if (window.top !== window) return;

  const MSG_ASSET_DETECTED = "MARINTEL_ASSET_DETECTED";

  let lastSent = { url: null, symbol: null };

  function normalizeSymbol(value) {
    if (!value) return null;
    const cleaned = String(value).trim().toUpperCase();
    if (!/^[A-Z0-9._-]{1,32}$/.test(cleaned)) return null;
    return cleaned;
  }

  function detectGrowwSymbol() {
    if (location.hostname !== "groww.in") return null;
    if (!location.pathname.startsWith("/stocks/")) return null;

    const text = document.body?.innerText ?? "";
    // Example: "RELIANCE •\nNSE"
    const m =
      text.match(/\b([A-Z0-9._-]{1,32})\s*•\s*(?:\n\s*)?NSE\b/) ??
      text.match(/\b([A-Z0-9._-]{1,32})\s*•\s*(?:\n\s*)?BSE\b/);
    return normalizeSymbol(m?.[1] ?? null);
  }

  function detectAngelOneSymbol() {
    const host = location.hostname;
    if (!(host === "angelone.in" || host.endsWith(".angelone.in") || host === "www.angelone.in")) return null;
    if (!location.pathname.startsWith("/stocks/")) return null;

    const text = document.body?.innerText ?? "";
    // Example:
    // RELIANCE
    //
    // NSE
    const m =
      text.match(/\b([A-Z][A-Z0-9._-]{1,31})\b\s*(?:\n\s*)+NSE\b/) ??
      text.match(/\b([A-Z][A-Z0-9._-]{1,31})\b\s*(?:\n\s*)+BSE\b/);
    return normalizeSymbol(m?.[1] ?? null);
  }

  function detectKiteSymbol() {
    if (location.hostname !== "kite.zerodha.com") return null;

    const segments = location.pathname.split("/").filter(Boolean);
    for (let i = 0; i < segments.length - 1; i += 1) {
      const seg = segments[i]?.toUpperCase();
      if (seg === "NSE" || seg === "BSE") {
        return normalizeSymbol(segments[i + 1]);
      }
    }

    const qs = new URLSearchParams(location.search);
    const fromQuery = qs.get("symbol") ?? qs.get("tradingsymbol");
    return normalizeSymbol(fromQuery);
  }

  function detectSymbol() {
    return detectGrowwSymbol() ?? detectKiteSymbol() ?? detectAngelOneSymbol();
  }

  function platformName() {
    const host = location.hostname;
    if (host === "groww.in") return "groww";
    if (host === "kite.zerodha.com") return "zerodha_kite";
    if (host === "angelone.in" || host === "www.angelone.in" || host.endsWith(".angelone.in")) return "angelone";
    return "unknown";
  }

  async function trySendDetection() {
    const url = location.href;
    const symbol = detectSymbol();
    if (!symbol) return;

    if (lastSent.url === url && lastSent.symbol === symbol) return;
    lastSent = { url, symbol };

    try {
      await chrome.runtime.sendMessage({
        type: MSG_ASSET_DETECTED,
        platform: platformName(),
        symbol,
        url
      });
    } catch (_err) {
      // ignore
    }
  }

  function scheduleDetectionWithRetries() {
    const start = Date.now();
    const attempt = async () => {
      await trySendDetection();
      if (lastSent.url === location.href && lastSent.symbol) return;
      if (Date.now() - start > 10_000) return;
      setTimeout(attempt, 600);
    };
    attempt();
  }

  function installUrlObserver(onChange) {
    let lastUrl = location.href;
    const check = () => {
      const next = location.href;
      if (next !== lastUrl) {
        lastUrl = next;
        onChange();
      }
    };

    const origPushState = history.pushState;
    const origReplaceState = history.replaceState;

    history.pushState = function (...args) {
      origPushState.apply(this, args);
      check();
    };

    history.replaceState = function (...args) {
      origReplaceState.apply(this, args);
      check();
    };

    window.addEventListener("popstate", check);
    setInterval(check, 800);
  }

  installUrlObserver(() => {
    setTimeout(scheduleDetectionWithRetries, 400);
  });

  scheduleDetectionWithRetries();
})();

