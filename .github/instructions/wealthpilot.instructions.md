---
applyTo: "**"
---

WealthPilot is a private personal finance dashboard.

Product direction:
- Manual-first finance tracking.
- No paid or complex market APIs in the first MVP.
- Track stock holdings, credit cards, spends, bills, payments, and insights.

Tech stack:
- Frontend: React + TypeScript + Tailwind CSS
- Backend: Python FastAPI
- Database: PostgreSQL
- ORM: SQLAlchemy / SQLModel
- Migrations: Alembic
- Charts: Recharts
- Auth: later, not part of the first MVP

Repo layout:
- `frontend/` for the React app
- `backend/` for the FastAPI app
- `docs/` for product and implementation notes

MVP modules:
- Dashboard
- Stocks / Holdings
- Credit Cards
- Transactions / Spends
- Upcoming Payments
- Analytics / Insights

Design direction:
- Premium dark fintech dashboard
- Inspired by Zerodha Console + Linear
- Use Indian currency formatting (`₹`)
- Green for profit / paid / positive
- Red for loss / overdue
- Amber for due soon

Current phase:
- Set up the project skeleton only
- Keep the structure clean and small
- Do not overbuild before the dashboard UI is in place
