# EMI Flow Implementation

## Goal

Track EMI-based purchases and repayments inside the existing Transactions area, while keeping the actual goal itself in the Goals section.

The main idea is:

- `Goals` remains the source of truth for the thing you want to achieve.
- A goal appears in EMI tracking only when `is_emi` is enabled.
- `Transactions` has a global EMI Tracker section separate from monthly cashflow.
- Normal goals and achieved purchases stay out of EMI unless explicitly marked as EMI.

This matches the current app structure, where goals already have:

- `target_amount`
- `current_amount`
- `status`
- `progress_pct`
- `shortfall_amount`
- `required_monthly_saving`
- achievement metadata

## Recommendation

Use an opt-in, goal-linked EMI flow instead of treating every goal as EMI.

Recommended shape:

- Keep `is_emi` on `financial_goals`
- Keep a `goal_id` on EMI records
- Mark EMI-related entries with `transaction_type = emi`
- Group EMI activity in the Transactions UI by goal
- Update goal progress from EMI payments

This gives you one clean flow:

1. Create a goal
2. Mark that goal as EMI
3. Record EMI payments as transactions
4. Show progress on both Goals and Transactions screens

## Why this fits the current repo

The repo already separates concerns pretty well:

- Goals are handled in `frontend/src/components/GoalsPage.tsx`
- Goal API lives in `backend/app/api/routes/goals.py`
- Goal model lives in `backend/app/models/financial_goal.py`
- Transactions are already a dedicated concept in `backend/app/models/transaction.py`

That makes Transactions the right place for the payment trail, while Goals stays the place where the user thinks about the outcome.

## UI Idea

Add a separate global section inside the Transactions page:

- Header: `EMI Tracker`
- Filters: by goal, month, status
- Cards or rows: one per goal
- Progress bar: paid vs remaining
- Next due date: next EMI due
- Recent payments: latest EMI entries under each goal

Suggested card layout:

- Goal name
- Target amount
- Paid so far
- Remaining amount
- EMI amount
- Due date
- Progress bar

Example:

```text
Home Down Payment
[███████████░░░░░░░░] 62%
Paid: ₹18,60,000
Remaining: ₹11,40,000
EMI: ₹45,000
Next due: 25 Aug 2026
```

## Backend Data Model

Current transaction model:

- `transaction_date`
- `merchant`
- `amount`
- `category`
- `payment_method`
- `card_id`
- `notes`

For EMI support, goals now have:

- `is_emi`

Future EMI payment support can add fields such as:

- `transaction_type` or `entry_type`
- `goal_id`
- `emi_plan_id` if you want a separate EMI plan table
- `installment_number`
- `due_date`
- `principal_amount`
- `interest_amount`
- `remaining_balance`

### Simple version

If you want the lightest possible change:

- add `goal_id`
- add `transaction_type = emi`
- use notes for extra EMI details

### Better version

If you want proper EMI lifecycle tracking:

- create an `emi_plans` table
- create an `emi_payments` table
- link both to `financial_goals`
- derive goal progress from payment totals

## Backend Logic

Suggested service responsibility:

- create EMI plan from a goal
- compute installment schedule
- record each payment
- update goal progress after payment
- mark goal achieved when EMI plan is complete

Likely backend locations:

- `backend/app/services/`
- `backend/app/api/routes/`
- `backend/app/models/`
- `backend/app/schemas/`

## Frontend Structure

Likely frontend places:

- `frontend/src/components/TransactionsPage.tsx` or the current transactions screen
- `frontend/src/lib/api.ts` for EMI endpoints
- `frontend/src/queries/` for cached EMI data
- `frontend/src/components/Sidebar.tsx` only if a new nav item is needed

UI should show:

- active EMI plans
- completed EMI plans
- recent EMI transactions
- progress bars per goal

## Tracking Checklist

- [x] Add opt-in EMI flag to goals
- [x] Add global EMI section inside Transactions
- [x] Show only EMI-marked goals in EMI tracker
- [ ] Decide whether EMI payments need a simple transaction type or a full EMI plan
- [ ] Add `goal_id` linkage for EMI payment records
- [ ] Add EMI schema and API routes
- [ ] Add EMI progress calculation
- [ ] Add goal-linked progress bars
- [ ] Add tests for payment posting and goal updates

## Notes

This should stay tied to goals, not become a separate finance island.

That keeps the app consistent:

- Goals define intent
- Transactions define payment history
- EMI progress bridges the two
