# Finance Analytics (Academy Owner) — F1–F8 acceptance register

Updated: 2026-10-31. Branch: `payment-module-finalization`.

## Reporting contract
- Indian financial year: April 1–March 31; monthly, quarterly, half-yearly and annual periods.
- Comparison: previous equivalent period, same period last year, or custom equal-duration period.
- Collections: recorded `payments` with `payment_entry_type = payment`, attributed to `payment_date` in Asia/Kolkata.
- Adjustments: signed `payment_entry_type = adjustment` transactions, separate from gross collections.
- Expenses: `expenses.amount_paid` by `expense_date`.
- Net cash movement = gross collections + signed adjustments − expenses. **Not accounting profit.**
- Growth: gross collections relative to positive baseline; zero/negative baseline -> N/A.
- No invented five-year history. Empty source months mean no matching ledger records, not proof of no off-platform activity.
- Center contributions use **current** `players.center_id`, not transaction-time center snapshots. Center expenses are unavailable because expenses have no center assignment.

## Read-only live audit (2026-10-31)
- 26 dues, 42 payment entries.
- 11 due-ledger mismatches: net recorded due paid amount exceeds linked transaction sum by **₹20,000**.
- 10 paid dues with no linked payment transactions: **₹20,500** recorded paid amount.
- 1 due with linked payments **₹500 above** its recorded paid amount.
- Football World: 7 mismatches, net ₹13,500 difference; Thane City FC: 4 mismatches, net ₹6,500.
- **Classification is technical, not causal.** Whether these are imports, legacy manual updates or incorrect entries is **unverified**. No records were changed.
- Collections and center reports use recorded transactions only. Do **not** reconstruct missing transaction dates or assign collections from `payment_dues.paid_amount`.
- Historical outstanding and cohort collection efficiency are **not published as verified KPIs** because supporting historical ledger completeness has not been established. They are explicitly excluded from the current verified KPI scope, not considered implemented.

## Phase status
- F1: Schema and source audit complete; causal reconciliation of 11 exceptions remains an operational follow-up.
- F2: Verified KPI metric contract for gross, adjustments, expenses, net and growth; efficiency excluded pending validated history.
- F3: Period filters and comparisons implemented.
- F4: KPI dashboard implemented for verified metrics; efficiency excluded.
- F5: Financial trends implemented.
- F6: Center contribution implemented with current-center limitation.
- F7: Read-only quality audit and exception classification implemented; no silent ledger repairs.
- F8: Automated Jest/Deno, React CI and scope-isolation fixture; browser visual/role regression remains to be signed off separately.

## F8 manual acceptance checklist (not yet certified)
- [ ] Desktop 1440/1280/1024 widths: tab and filter layout, cards, both charts.
- [ ] Mobile 390/375/320 widths: filters, card overflow, chart labels, center table usability.
- [ ] Monthly, quarterly, half-yearly and FY April/March rollover.
- [ ] Previous, same-period-last-year, valid custom equal-duration; invalid custom error and retry.
- [ ] Empty academy and zero-baseline N/A.
- [ ] Thane City FC and Football World AO accounts: data isolation in UI and network requests.
- [ ] Coach/Parent/Super Admin: no unintended Finance AO access.
- [ ] Compare selected period ledger totals with read-only SQL independently.
- [ ] Resolve or formally accept 11 ledger exceptions before asserting full source reliability.

## Release gate
Do not call Finance Analytics fully production-ready until latest branch CI is green and the manual acceptance checklist is signed off. No DB migration, live data correction or production deployment is authorized by this register.
