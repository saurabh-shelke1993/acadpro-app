# Kheltriva SP1 — One-time billing-cycle option and Amount labels

**Date:** 13 November 2026 (IST)
**Feature phase:** SP1 of SP1–SP4; scope restricted to the Subscription Plans page
**Branch:** `sp1-one-time-plan-cycle-and-amount-label` → `payment-module-finalization`
**Status at creation:** implemented in development branch; focused CI and Product Owner UI acceptance pending. Not a beta release approval.

## Product Owner request

1. Add **One-time** to Billing cycle beside Monthly, Quarterly and Half Yearly. Example names: Summer Camp, Winter Camp.
2. Replace **Recurring amount** with **Amount**, in both the plan form and plans table.

## Implemented in SP1

- `SubscriptionPlans.js` adds `{ value: "one_time", label: "One-time" }` to the existing billing cycle list.
- Existing `subscription_plans.billing_cycle` is a TEXT column without a restrictive check constraint in the active verified Supabase schema. The existing Insert/Update payload already sends `billing_cycle`; no new column, RLS policy, trigger, RPC or schema migration is necessary for the **plan definition only**.
- The form label, plans table header and invalid-amount error now say **Amount**, not **Recurring amount**. Existing stored `amount` and `registration_fee` fields, values, role scoping, pagination and editable plan handling are otherwise untouched.
- When the user selects One-time, an inline notice states this is **plan setup only**. No player enrollment or one-time due is created in SP1. Existing recurring plan functionality is unchanged.
- `SubscriptionPlans.test.js` uses synthetic Academy Owner/Super Admin data to check dropdown labels, form/table naming, resulting `one_time` insert payload, recurring-plan regression, lack of payment due or enrollment writes, and Super Admin academy requirement.
- Existing Subscriptions CI workflow now triggers on Subscription Plans page/styles/test changes and runs its new test along with prior subscriptions tests + React production build.

## Known boundaries

- **SP2 not implemented:** Player Subscriptions currently calculates calendar end dates only for recognized monthly/quarterly/etc. plan cycles; it **does not support `one_time` assignment**. The owner should not try to assign a newly created One-time plan until SP2.
- **SP3 not implemented:** Payment Dues does not offer `one_time` as a due type and does not protect one-time camp charges against repeat enrollment/duplicate posting. Payment collection/Parent visibility require separate SP3 regression/security review.
- SP1 does **not** alter `subscription_plans.amount` values already saved, existing `player_subscriptions` links, dues, payments or receipts.
- No hosted SQL was executed to mutate business data; no `main`, Vercel or hosted RLS deployment is authorized by SP1.
- Existing HIGH-001/HIGH-002 and AG3.4E release NO-GO remain open.

## Product Owner UI acceptance — after merging to development branch

**Role:** Academy Owner. **Page:** Finance → Subscriptions → Subscription Plans.

1. Open **Billing cycle**. **Expected:** Monthly, Quarterly, Half Yearly and **One-time**.
2. **Expected:** Input label displays **Amount** and table column displays **Amount**; **Recurring amount** is absent.
3. Set Billing cycle = **One-time**. **Expected:** a compact note explaining plan setup only; no new player, charge or invoice is generated.
4. Enter temporary form text: Plan name **Summer Camp U12**, Amount **₹3,000**, Registration fee **₹0**. **Expected:** fields accept values without changing any saved data. **Do not click Create plan on a real academy until using a controlled fixture**; the synthetic automated test exercises the save payload.
5. Change Billing cycle back to Monthly. **Expected:** one-time note disappears and normal form remains usable. Existing Monthly and Quarterly plans retain their original amount/registration values.
6. Verify Owner sees only their own academy's plan list; Super Admin still selects the intended academy; Coach and Parent must not gain access to plan management.
7. At narrow mobile widths, the form/table remains usable; no unusual horizontal overflow.

**Report PASS/FAIL for each test.** A plan created is **not** a camp enrollment or payment. Do not manually generate a monthly tuition due for a one-time camp.

## Next phases

- SP2: review/implement one-time enrollment with explicitly selected camp start/end dates, without recurring renewal.
- SP3: one-time due/payment/receipt support with backend duplicate protection and owner/parent access tests.
- SP4: complete integrated four-role end-to-end testing and release docs.

**Completion requirements:** focused PR CI PASS, production React build PASS, actual Product Owner UI acceptance; deployment/beta security gates remain separate and cannot be inferred from a successful SPA test.
