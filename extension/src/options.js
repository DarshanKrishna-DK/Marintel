const DEFAULT_BACKEND_BASE_URL = "http://localhost:8787";

function setStatus(text) {
  const el = document.getElementById("status");
  el.textContent = text;
}

function normalizeBaseUrl(raw) {
  const value = String(raw ?? "").trim();
  const url = value.length > 0 ? value : DEFAULT_BACKEND_BASE_URL;
  return url.replace(/\/+$/, "");
}

function originPatternFor(url) {
  const u = new URL(url);
  // chrome.permissions origin patterns do not need (or reliably support) explicit ports.
  // We request host access for the hostname and scheme, which covers all ports.
  return `${u.protocol}//${u.hostname}/*`;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function hasPermissionForOriginPattern(originPattern) {
  try {
    return await chrome.permissions.contains({ origins: [originPattern] });
  } catch {
    return false;
  }
}

async function loadOptions() {
  const stored = await chrome.storage.sync.get(["backendBaseUrl"]);
  const value = normalizeBaseUrl(stored.backendBaseUrl ?? DEFAULT_BACKEND_BASE_URL);
  document.getElementById("backendUrl").value = value;
}

async function saveOptions() {
  const backendBaseUrl = normalizeBaseUrl(document.getElementById("backendUrl").value);
  let originPattern;

  try {
    originPattern = originPatternFor(backendBaseUrl);
  } catch {
    setStatus("Invalid backend URL.");
    return;
  }

  let granted = false;
  try {
    granted = await chrome.permissions.request({ origins: [originPattern] });
  } catch (err) {
    setStatus(
      `Failed to request host permission.\n${err instanceof Error ? err.message : String(err)}\n\nRequested: ${originPattern}`
    );
    return;
  }
  if (!granted) {
    setStatus("Permission was not granted. Marintel cannot call your backend without it.");
    return;
  }

  await chrome.storage.sync.set({ backendBaseUrl });
  setStatus(`Saved.\nGranted permission: ${originPattern}`);
}

async function testHealth() {
  const backendBaseUrl = normalizeBaseUrl(document.getElementById("backendUrl").value);
  let originPattern;

  try {
    originPattern = originPatternFor(backendBaseUrl);
  } catch {
    setStatus("Invalid backend URL.");
    return;
  }

  const hasPermission = await hasPermissionForOriginPattern(originPattern);
  if (!hasPermission) {
    setStatus(
      [
        "Missing host permission for backend origin.",
        `Expected: ${originPattern}`,
        "",
        "Click Save and accept the permission prompt, then try again."
      ].join("\n")
    );
    return;
  }

  try {
    const res = await withTimeout(fetch(`${backendBaseUrl}/health`), 4000);
    const text = await res.text();
    setStatus(`GET /health -> ${res.status}\n${text}`);
  } catch (err) {
    setStatus(`Failed to call /health.\n${err instanceof Error ? err.message : String(err)}`);
  }
}

document.getElementById("saveBtn").addEventListener("click", () => {
  saveOptions();
});

document.getElementById("testBtn").addEventListener("click", () => {
  testHealth();
});

loadOptions();

