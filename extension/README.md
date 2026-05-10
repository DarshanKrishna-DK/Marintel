# Marintel Browser Extension (Phase 3 and 4)

This is the Manifest V3 extension that detects the currently viewed equity on:
- Groww (`groww.in`)
- Zerodha Kite (`kite.zerodha.com`)
- Angel One (`angelone.in`, `*.angelone.in`)

When a symbol is detected, it asks the background service worker to call the Marintel backend `POST /intelligence`.

## Run locally

1. Start the backend:

```bash
cd backend
npm run dev
```

2. Load the extension in Chrome:
- Go to `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked**
- Select the `extension/` folder

3. Configure backend URL:
- Open the extension **Details**
- Click **Extension options**
- Set your backend base URL (default `http://localhost:8787`)
- Click **Save** to grant permission
- Click **Test /health**

4. Verify detection:
- Open a supported stock page (example):
  - `https://groww.in/stocks/reliance-industries-ltd`
  - `https://www.angelone.in/stocks/reliance-industries-ltd`
- Open DevTools for that tab and the extension service worker logs (from `chrome://extensions` -> Marintel -> service worker).

## Side panel UI (Phase 4)

- Click the Marintel extension icon to open the side panel (Chrome 114+).
- The panel live-updates from `chrome.storage.local` and can refresh `/intelligence` on demand.

### Rebuild the panel UI (if you edit it)

```bash
cd extension/panel
npm run build
```

