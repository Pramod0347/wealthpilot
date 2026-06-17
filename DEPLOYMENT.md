# WealthPilot — Deployment Guide

Stack: **Vercel** (frontend) · **Render** (backend) · **Neon** (PostgreSQL)

---

## Security note — auth is frontend-only

The current login gate checks `VITE_OWNER_EMAIL` and `VITE_OWNER_PHONE` inside the React bundle. This means:

- Credentials are embedded in the compiled JS and visible to anyone who opens DevTools.
- All backend API routes are **publicly accessible** with no token or session check.

For a personal app on a private URL this is acceptable, but be aware that anyone who finds your Render URL can read and modify your data without logging in. If you want real protection, you would need to add a backend auth layer (e.g. HTTP Basic Auth on Render, or a simple API key header check in FastAPI). This guide does not add that — it deploys the app as-is.

---

## Step 1 — Neon PostgreSQL

1. Create a free project at [neon.tech](https://neon.tech).
2. Copy the **connection string** from the Neon dashboard. It looks like:
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
3. Keep this string — you will paste it as `DATABASE_URL` in Render.

---

## Step 2 — Render (backend)

1. Push this repo to GitHub (or connect an existing repo).
2. Go to [render.com](https://render.com) → **New → Web Service**.
3. Connect your GitHub repo. Set:
   - **Root directory:** `backend`
   - **Runtime:** Python 3
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Under **Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | your Neon connection string (postgresql+psycopg:// prefix — see note below) |
   | `FRONTEND_URL` | your Vercel URL — fill in after Step 3 (e.g. `https://money.pramodgoudar.com`) |
   | `APP_ENV` | `production` |

   > **URL prefix note:** Neon gives you `postgresql://...`. The app's `normalize_database_url()` function automatically converts this to `postgresql+psycopg://...` so you can paste the Neon URL directly. SSL (`?sslmode=require`) is handled by psycopg3 natively — no extra config needed.

5. Click **Create Web Service**. Note the service URL (e.g. `https://wealthpilot-api.onrender.com`).

### Run database migrations on Render

After the first deploy succeeds, open a **Shell** in the Render dashboard for your service and run:

```bash
alembic upgrade head
```

Or add it to the build command if you prefer automatic migrations:

```
pip install -r requirements.txt && alembic upgrade head
```

---

## Step 3 — Vercel (frontend)

1. Go to [vercel.com](https://vercel.com) → **New Project** → import your GitHub repo.
2. Set **Root directory** to `frontend`.
3. Framework preset: **Vite** (auto-detected).
4. Under **Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `VITE_API_BASE_URL` | your Render URL, e.g. `https://wealthpilot-api.onrender.com` |
   | `VITE_OWNER_EMAIL` | your login email |
   | `VITE_OWNER_PHONE` | your login phone |

5. Click **Deploy**.
6. Note the deployed URL. Your custom domain is `https://money.pramodgoudar.com` — add it in Vercel under **Settings → Domains** and point your DNS to Vercel.

### SPA routing

`frontend/vercel.json` already contains the rewrite rule so client-side routes (React Router) work on hard reload:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## Step 4 — Wire CORS

After both services are deployed:

1. Go back to Render → your backend service → **Environment**.
2. Set `FRONTEND_URL` to your exact Vercel URL (no trailing slash):
   ```
   https://money.pramodgoudar.com
   ```
   If you have a custom domain, add both separated by a comma:
   ```
   https://money.pramodgoudar.com,https://yourcustomdomain.com
   ```
3. Render will redeploy automatically. CORS will now allow requests from your frontend.

---

## Step 5 — Smoke test

1. Open your Vercel URL → login with your credentials → verify the dashboard loads.
2. Check `https://wealthpilot-api.onrender.com/health` → should return `{"status":"ok"}`.
3. Check `https://wealthpilot-api.onrender.com/docs` → FastAPI Swagger UI (all routes listed).
4. Add a bank account or stock holding and confirm it persists on reload.

---

## Local development

Nothing changes for local dev. Run as before:

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend (in a separate terminal)
cd backend
source .venv/bin/activate   # or: source venv/bin/activate
uvicorn app.main:app --reload
```

Local `.env` files:

```bash
cp backend/.env.example backend/.env   # fill in local DATABASE_URL
cp frontend/.env.example frontend/.env # fill in local VITE_ vars
```

---

## Updating after deploy

- **Frontend changes:** push to GitHub → Vercel redeploys automatically.
- **Backend changes:** push to GitHub → Render redeploys automatically.
- **Schema migrations:** after a backend redeploy that includes new Alembic revisions, run `alembic upgrade head` via the Render Shell.

---

## Free-tier limits (as of 2025)

| Service | Limit |
|---------|-------|
| Neon | 0.5 GB storage, 1 branch, compute pauses after inactivity |
| Render | Spins down after 15 min inactivity; cold start ~30 s |
| Vercel | 100 GB bandwidth/month, unlimited deployments |

Render's free tier sleeps the service when idle. The first request after a period of inactivity will take ~30 seconds. This is normal.
