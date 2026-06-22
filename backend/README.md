# WealthPilot Backend

FastAPI backend for the WealthPilot MVP.

## Stack

- FastAPI
- PostgreSQL
- SQLAlchemy
- Alembic
- Pydantic
- python-dotenv
- Uvicorn

## Setup

1. Create and activate the virtual environment.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies.

```bash
pip install -r requirements.txt
```

3. Create your local environment file.

```bash
cp .env.example .env
```

4. Update `DATABASE_URL` in `.env` to point to your local PostgreSQL database.

Default format:

```bash
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/wealthpilot
```

## Run migrations

Create the database first, then run:

```bash
.venv/bin/alembic upgrade head
```

If PostgreSQL is not running or the database does not exist, Alembic will fail to connect.

## Run the API

```bash
.venv/bin/uvicorn app.main:app --reload
```

## Current MVP routes

- `GET /health`
- `GET /api/holdings`
- `POST /api/holdings`
- `GET /api/holdings/{holding_id}`
- `PATCH /api/holdings/{holding_id}`
- `DELETE /api/holdings/{holding_id}`
- `GET /api/dashboard/summary`

## Production Startup And Auth

WealthPilot frontend is expected to run on Vercel and call this backend on Render.

### Startup flow

- Frontend calls `GET /health` first.
- If Render is sleeping, frontend keeps retrying `/health` for up to 90 seconds.
- While Render wakes up, frontend shows a dedicated server warming screen instead of the login page.
- After `/health` is healthy, frontend calls `GET /api/auth/me`.
- Only then does the frontend show either the app or the login screen.

### Current cross-domain setup

Frontend:

```bash
https://money.pramodgoudar.com
```

Backend:

```bash
https://wealthpilot-api.onrender.com
```

Recommended env:

```bash
FRONTEND_URL=https://money.pramodgoudar.com
COOKIE_SAMESITE=none
COOKIE_SECURE=true
COOKIE_DOMAIN=
```
