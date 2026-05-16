# Free Deployment Guide

Recommended free-ish stack:

- Frontend: Vercel free plan
- Backend API: Render free web service
- Database: Supabase free Postgres

This avoids SQLite data loss on free hosts. SQLite is fine locally, but most free web services do not persist local files reliably.

## 1. Create Supabase Database

1. Create a Supabase project.
2. Copy the Postgres connection string.
3. Use the pooled connection string if Supabase recommends it.
4. Set it as `DATABASE_URL` in the backend host.

Example format:

```txt
postgresql+psycopg://USER:PASSWORD@HOST:PORT/DATABASE
```

## 2. Deploy Backend on Render

1. Push this repo to GitHub.
2. In Render, choose `New` -> `Blueprint`.
3. Select this repo. Render will read `render.yaml`.
4. Add environment variables:

```txt
DATABASE_URL=postgresql+psycopg://...
CORS_ORIGINS=https://your-vercel-app.vercel.app,http://localhost:3000
```

5. Deploy. Your API will look like:

```txt
https://expense-tracker-api.onrender.com
```

Health check:

```txt
https://expense-tracker-api.onrender.com/health
```

API base URL:

```txt
https://expense-tracker-api.onrender.com/api
```

## 3. Deploy Frontend on Vercel

1. In Vercel, import the same GitHub repo.
2. Set root directory to `frontend`.
3. Add environment variable:

```txt
NEXT_PUBLIC_API_URL=https://expense-tracker-api.onrender.com/api
```

4. Deploy.
5. Copy your Vercel URL and add it to Render `CORS_ORIGINS`.

## 4. Local Development

Backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## iOS Options

Free option: use it as a PWA.

1. Open the Vercel URL in Safari on iPhone.
2. Tap Share.
3. Tap Add to Home Screen.

This uses the existing `manifest.json` and gives an app-like icon/standalone window.

Native App Store option: wrap with Capacitor.

- Requires Xcode on macOS.
- Requires Apple Developer Program for App Store distribution.
- Typical commands after adding Capacitor:

```bash
cd frontend
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init ExpenseTracker com.yourname.expensetracker --web-dir=out
npm run build
npx cap add ios
npx cap open ios
```

For Capacitor static export, the Next app needs extra config and testing. PWA is the fastest free path; Capacitor is the path when you want TestFlight/App Store.
