# WealthPilot

Private personal finance dashboard for manual portfolio, credit card, spend, and payment tracking.

## Repo Layout

- `frontend/` - React + TypeScript + Tailwind CSS app
- `backend/` - Python FastAPI app
- `docs/` - product notes, implementation notes, and planning docs

## Current State

Fully functional personal finance dashboard with: Portfolio, Stocks, Banks, Credit Cards, Cashflow, Fixed Savings, and Analytics pages. Dark/light theme, privacy mode, and mobile-first responsive layout.

See [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel + Render + Neon PostgreSQL deployment.

## Run

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Backend checks

- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/docs`

### Verify the backend venv

```bash
which python
which pip
```

Both should point to `backend/.venv/...` after activation.
