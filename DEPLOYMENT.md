# WealthPilot — Deployment Guide

Stack: **Vercel** (frontend) · **Cloudflare Tunnel** (backend ingress) · **Home Server** (FastAPI + PostgreSQL)

---

## Architecture

- `https://money.pramodgoudar.com` → Vercel frontend
- `https://api.money.pramodgoudar.com` → Cloudflare Tunnel → old laptop → FastAPI backend on `127.0.0.1:8000`
- PostgreSQL runs locally on the laptop

Do not expose PostgreSQL publicly.  
Do not use router port forwarding.  
Do not bind FastAPI to `0.0.0.0` if Cloudflare Tunnel is forwarding only to localhost.

---

## Authentication and cookie behavior

WealthPilot uses backend-protected session auth:

- Credentials (`OWNER_EMAIL`, `OWNER_PHONE`, `SECRET_KEY`) live only in backend env vars.
- Login submits email + phone to `POST /api/auth/login`.
- Backend validates them server-side and sets an **HttpOnly signed session cookie** (`wp_session`).
- Every protected API requires a valid session.
- Frontend also supports a bearer-token fallback for devices that do not persist cross-site cookies reliably.

For production with the same parent domain:

- Frontend: `https://money.pramodgoudar.com`
- Backend: `https://api.money.pramodgoudar.com`

Cookie settings:

```bash
COOKIE_SAMESITE=lax
COOKIE_SECURE=true
COOKIE_DOMAIN=.money.pramodgoudar.com
```

Expected cookie behavior:

- `httponly=True`
- `secure=True`
- `samesite=lax`
- `domain=.money.pramodgoudar.com`
- `path=/`

---

## Backend CORS requirements

Backend must allow the frontend origin only, not wildcard origins with credentials.

Required backend env:

```bash
FRONTEND_URL=https://money.pramodgoudar.com
```

Backend CORS should support:

- `allow_credentials=True`
- methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- headers: `Content-Type, Authorization, Accept`

Current backend already matches this model.

---

## Home Server Deployment with Cloudflare Tunnel

### 1. Install PostgreSQL on the laptop

Install PostgreSQL using your OS package manager.

Example verification:

```bash
psql --version
```

Create the DB user and database:

```bash
createuser wealthpilot_user --pwprompt
createdb -O wealthpilot_user wealthpilot_db
```

Test connection:

```bash
psql postgresql://wealthpilot_user:<password>@localhost:5432/wealthpilot_db
```

### 2. Configure backend environment

Create `backend/.env`:

```bash
APP_ENV=production
DATABASE_URL=postgresql+psycopg://wealthpilot_user:<password>@localhost:5432/wealthpilot_db
FRONTEND_URL=https://money.pramodgoudar.com
OWNER_EMAIL=<my-email>
OWNER_PHONE=<my-phone>
SECRET_KEY=<64-char-secret>
COOKIE_SAMESITE=lax
COOKIE_SECURE=true
COOKIE_DOMAIN=.money.pramodgoudar.com
```

Notes:

- `SECRET_KEY` should be a long random secret, for example:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 3. Install backend dependencies and run migrations

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
```

### 4. Run FastAPI locally on the laptop

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Expected:

```json
{"status":"ok"}
```

### 5. Install Cloudflare Tunnel

Install `cloudflared` on the laptop.

Authenticate:

```bash
cloudflared tunnel login
```

Create a tunnel:

```bash
cloudflared tunnel create wealthpilot-api
```

Create a tunnel config similar to:

```yaml
tunnel: <tunnel-id>
credentials-file: /home/<user>/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: api.money.pramodgoudar.com
    service: http://localhost:8000
  - service: http_status:404
```

Create the DNS route:

```bash
cloudflared tunnel route dns wealthpilot-api api.money.pramodgoudar.com
```

Run the tunnel:

```bash
cloudflared tunnel run wealthpilot-api
```

Result:

- `https://api.money.pramodgoudar.com` → Cloudflare Tunnel → `http://localhost:8000`

### 6. Update Vercel frontend env

Set this in Vercel:

```bash
VITE_API_BASE_URL=https://api.money.pramodgoudar.com
```

Then redeploy frontend.

---

## systemd service example for backend

Example file: `/etc/systemd/system/wealthpilot-backend.service`

```ini
[Unit]
Description=WealthPilot FastAPI backend
After=network.target postgresql.service

[Service]
User=<your-user>
Group=<your-user>
WorkingDirectory=/home/<your-user>/WealthPilot/backend
EnvironmentFile=/home/<your-user>/WealthPilot/backend/.env
ExecStart=/home/<your-user>/WealthPilot/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable wealthpilot-backend
sudo systemctl start wealthpilot-backend
sudo systemctl status wealthpilot-backend
```

---

## Optional systemd service for Cloudflare Tunnel

If you want the tunnel to survive reboot:

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

Or run it via your own service definition tied to the tunnel config.

---

## Backup instructions

Create a local backups folder:

```bash
mkdir -p backups
```

Daily backup command:

```bash
pg_dump wealthpilot_db > backups/wealthpilot_$(date +%F).sql
```

Recommended:

- keep backups outside the laptop as well
- example destinations:
  - external drive
  - private cloud folder
  - encrypted archive on another machine

You can later automate this with `cron` or a systemd timer.

---

## Migration from Neon to local PostgreSQL

### Export Neon

From any machine that can access Neon:

```bash
pg_dump "postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require" > wealthpilot_neon_export.sql
```

### Restore into local PostgreSQL

```bash
psql postgresql://wealthpilot_user:<password>@localhost:5432/wealthpilot_db < wealthpilot_neon_export.sql
```

If you use a custom-format dump instead:

```bash
pg_restore -d postgresql://wealthpilot_user:<password>@localhost:5432/wealthpilot_db wealthpilot_neon_export.dump
```

### Run Alembic after restore

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
```

Reason:

- ensures the restored DB is aligned with the latest code migrations

---

## Final production test checklist

- `https://api.money.pramodgoudar.com/health` returns `{"status":"ok"}`
- Vercel frontend uses:

```bash
VITE_API_BASE_URL=https://api.money.pramodgoudar.com
```

- login works with owner email + phone
- refresh stays logged in on iOS Safari
- protected API without cookie or bearer token returns `401`
- dashboard loads data
- backend starts automatically after laptop reboot
- Cloudflare Tunnel reconnects after reboot
- PostgreSQL is reachable locally only

---

## Local development

Nothing changes for local development:

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Local frontend env:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

Local backend env can stay in development mode:

```bash
APP_ENV=development
```
