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

  function extractSymbolFromText(text) {
    if (!text) return null;
    const patterns = [
      /\b([A-Z0-9._-]{1,32})\s*(?:•|·)\s*(?:NSE|BSE)\b/,
      /\b(?:NSE|BSE)\s*[:\-]\s*([A-Z0-9._-]{1,32})\b/,
      /\b([A-Z0-9._-]{1,32})\s*[:\-]\s*(?:NSE|BSE)\b/,
      /\b([A-Z0-9._-]{1,32})\s*\((?:NSE|BSE)\)\b/
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const symbol = normalizeSymbol(match?.[1] ?? null);
      if (symbol && symbol !== "NSE" && symbol !== "BSE") return symbol;
    }
    return null;
  }

  function extractSymbolFromJson(root) {
    if (!root || typeof root !== "object") return null;
    const keys = new Set([
      "symbol",
      "ticker",
      "tickerSymbol",
      "tradingsymbol",
      "tradingSymbol",
      "displaySymbol",
      "nseSymbol",
      "bseSymbol"
    ]);
    const seen = new WeakSet();
    const queue = [root];

    while (queue.length > 0) {
      const node = queue.shift();
      if (!node || typeof node !== "object") continue;
      if (seen.has(node)) continue;
      seen.add(node);

      if (Array.isArray(node)) {
        for (const child of node) queue.push(child);
        continue;
      }

      for (const [key, value] of Object.entries(node)) {
        if (keys.has(key)) {
          const symbol = normalizeSymbol(value);
          if (symbol && symbol !== "NSE" && symbol !== "BSE") return symbol;
        }

        if (typeof value === "string") {
          const embedded = extractSymbolFromText(value);
          if (embedded) return embedded;
          continue;
        }

        if (value && typeof value === "object") {
          queue.push(value);
        }
      }
    }

    return null;
  }

  function detectGrowwSymbol() {
    if (location.hostname !== "groww.in") return null;
    if (!location.pathname.startsWith("/stocks/") && !location.pathname.startsWith("/stock/")) return null;

    const nextDataScript = document.getElementById("__NEXT_DATA__");
    if (nextDataScript?.textContent) {
      try {
        const payload = JSON.parse(nextDataScript.textContent);
        const symbol = extractSymbolFromJson(payload);
        if (symbol) return symbol;
      } catch {
        // ignore
      }
    }

    const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const script of jsonLdScripts) {
      if (!script.textContent) continue;
      try {
        const payload = JSON.parse(script.textContent);
        const symbol = extractSymbolFromJson(payload);
        if (symbol) return symbol;
      } catch {
        // ignore
      }
    }

    const metaText = [
      document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
      document.querySelector('meta[name="description"]')?.getAttribute("content"),
      document.querySelector('meta[property="og:description"]')?.getAttribute("content"),
      document.title
    ]
      .filter(Boolean)
      .join(" ");
    const metaSymbol = extractSymbolFromText(metaText);
    if (metaSymbol) return metaSymbol;

    const text = document.body?.innerText ?? "";
    return extractSymbolFromText(text);
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

    try {
      await chrome.runtime.sendMessage({
        type: MSG_ASSET_DETECTED,
        platform: platformName(),
        symbol,
        url
      });
      // Only mark success after the background acknowledges; otherwise retries can fix cold SW / transient failures.
      lastSent = { url, symbol };
    } catch (_err) {
      // Service worker may be asleep or message channel briefly unavailable; keep retrying scheduleDetectionWithRetries.
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

