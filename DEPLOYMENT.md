# WealthPilot — Deployment Guide

Stack: **Vercel** (frontend) · **Render** (backend) · **Neon** (PostgreSQL)

---

## How authentication works

WealthPilot uses backend-protected session auth:

- Credentials (`OWNER_EMAIL`, `OWNER_PHONE`, `SECRET_KEY`) live only in backend env vars — never in the frontend bundle.
- Login submits email + phone to `POST /api/auth/login`. The backend validates them server-side and sets an **HttpOnly signed session cookie** (`wp_session`).
- Every API route (`/api/holdings`, `/api/bank-accounts`, etc.) requires a valid cookie. Unauthenticated requests get `401`.
- The frontend calls `GET /api/auth/me` on load to check session state. If no valid session, the login page is shown.
- `/health`, `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` are the only unprotected endpoints.
- `/docs` and `/redoc` are disabled in production (`APP_ENV=production`).

Cookie settings in production: `HttpOnly`, `Secure`, `SameSite=None` (required for cross-domain Vercel ↔ Render).

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
   | `FRONTEND_URL` | `https://money.pramodgoudar.com` (fill in after Step 3) |
   | `APP_ENV` | `production` |
   | `OWNER_EMAIL` | your login email |
   | `OWNER_PHONE` | your login phone (digits only, e.g. `8296090286`) |
   | `SECRET_KEY` | run `python -c "import secrets; print(secrets.token_hex(32))"` and paste the output |

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

   > Credentials are no longer in Vercel env vars — they live only in the Render backend.

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

1. Open your Vercel URL → login with your email + phone → verify the dashboard loads.
2. Check `https://wealthpilot-api.onrender.com/health` → should return `{"status":"ok"}`.
3. Check `https://wealthpilot-api.onrender.com/api/auth/me` → should return `{"authenticated":false}` (no session cookie yet).
4. Check `https://wealthpilot-api.onrender.com/api/holdings` → should return `401` (protected route).
5. `/docs` and `/redoc` return 404 in production — this is expected.
6. Add a bank account or stock holding and confirm it persists on reload.

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
cp backend/.env.example backend/.env   # fill in DATABASE_URL, OWNER_EMAIL, OWNER_PHONE, SECRET_KEY
cp frontend/.env.example frontend/.env # VITE_API_BASE_URL only
```

For local dev the backend `.env` needs `APP_ENV=development` (or leave it unset — development is the default). This ensures cookies are set with `SameSite=Lax; Secure=false`, which works on localhost without HTTPS.

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
