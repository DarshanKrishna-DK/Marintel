# Marintel Landing Page

Trading-themed, 3D landing page for Marintel with a live demo section that calls the real backend `POST /intelligence`.

## Run locally

1. Start the backend (in a separate terminal):

```bash
cd backend
npm run dev
```

2. Start the landing site:

```bash
cd landing
npm run dev
```

## Configure backend URL

Copy `.env.example` to `.env` and update the backend base URL if needed:

```bash
VITE_MARINTEL_BACKEND_URL=http://localhost:8787
```
