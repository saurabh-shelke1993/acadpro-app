# Kheltriva — PS-L2.2 Owner Architecture Decisions D1–D7

**Approved:** 6 November 2026
**Branch reviewed:** `payment-module-finalization`
**Status:** **Owner business rules approved; technical schema remains proposed/unapplied.** No database schema, RLS, grants, RPCs, billing code, subscriptions, dues, payments or scheduled jobs were modified during this checkpoint.

## D1 — Tuition exclusivity and optional camp add-ons

**Approved:** A child cannot hold two overlapping **regular tuition entitlements** for the same academy, whether monthly, quarterly, half-yearly or yearly. This rule applies **across different subscription agreement IDs** and different plans, based on actual entitlement date intervals—not merely on whether a database row says Active.

| Example | Required behavior |
|---|---|
| Monthly tuition 1–30 November plus quarterly tuition starting 15 November | **Reject** simultaneous overlapping regular tuition |
| Monthly tuition 1–30 November, switch to quarterly starting 1 December | Allow future-effective switch after current entitlement ends, subject to approved transition |
| Monthly tuition 1–30 November plus separate Diwali camp 10–14 November | **Allow** camp participation without replacing or repricing monthly tuition |

**Special camps:** A Diwali fun session, holiday camp or workshop is a separate, **nonrecurring programme enrolment**, with its own session calendar and optional reference to the player's existing regular tuition agreement. It is **not** a second regular tuition subscription, does not trigger monthly/quarterly auto-renewal or change the contracted recurring rate, and is outside the regular tuition no-overlap constraint. The repository currently has no camp module.

**Unresolved camp fee detail:** Participation could be free, included in monthly tuition or separately charged. The Owner has not yet decided which; do not generate a camp due or assume a pricing rule. Camp enrolment/charging is a separately approved future feature, **not** included automatically in PS-L2.3.

**PS-L2.3 design implication:** Agreement-level uniqueness and `UNIQUE(agreement_id,period_sequence)` alone are insufficient. Design a database-authoritative overlap rule at **academy_id + player_id + regular_tuition entitlement dates**, including across distinct agreements and under concurrent requests. A player-level lock and/or reviewed cross-agreement exclusion strategy is needed. Do not add `UNIQUE(player_id) WHERE status='active'` to current dirty legacy data; four players had multiple Active agreements in the read-only inventory. Do not delete or deactivate them automatically.

## D2 — Academy proration choice: approved

**Scheduled training sessions are the academy default** for first partial fixed-calendar-month tuition proration. Academy Owner can configure **calendar-day** calculation as an alternative. Record the chosen method in versioned academy policy and snapshot it into the future agreement/period. The current PS-L1P2 form shows a simulation only.

## D3 — Approved holiday/session exclusions

For session-based proration, exclude **Academy Owner-approved** cancelled occurrences and holidays from applicable full-period and eligible scheduled-session counts, recording academy, batch, session, occurrence date, reason and approver. Coach messages alone do not authorize financial adjustments. Do not automatically alter calendar-day pricing or retroactively discount actual absences. No holiday/cancellation ledger exists currently.

## D4 — Keep existing contract terms: approved

Original contracted recurring rate, agreed billing alignment and cycle persist when academy defaults or the catalog plan price changes. Amend only with an **audited Owner-approved future-only** change. Camps do not reprice regular tuition.

## D5 — No eligible first-period sessions: approved

Defer initial tuition billing to the next eligible period, or allow a documented Owner-approved exception; **never** automatically generate a ₹0 pending due.

## D6 — Coach Paused status only: approved

Coach sees **Paused** on the assigned batch/attendance roster, with no access to rates, dues, payments, receipts or private adjustment explanations. Existing ROLE_MATRIX Coach subscription-read text conflicts with live no-Coach-SELECT RLS. Future implementation should offer a narrowly scoped status projection and then reconcile documentation, rather than granting financial table access today.

## D7 — Financial ancestry and privileges: approved direction

Protect existing subscription → due → payment history from destructive cascading deletion and review excessive table privileges including TRUNCATE. **Actual FK/GRANT/RLS changes require separate implementation approval and isolated payment/receipt/UPI/role regression.** D7 is not permission to apply them in the live database now.

## Legacy HOLD and PS-L2.3 permission boundary

All **22 legacy subscription agreements** remain **on renewal HOLD** until the Academy Owner confirms correct player/academy/plan, originally agreed price, verified paid-through and first prospective renewal date for each. Prior audit recorded four academy mismatches; a subsequent live SELECT-only review recorded three. Reconcile on a fresh snapshot; do not infer, repair or back-bill.

The approved D1–D7 product rules permit **preparing PS-L2.3 regular-tuition SQL migrations and isolated tests as unapplied repository artifacts only**. Live schema changes, security grant revocations, new dues, camp product implementation and automated billing need explicit separate authorizations.

**Next camp-specific decision:** Should an academy mark each camp **free, included in normal tuition, or independently chargeable**? Its answer does not block PS-L2.3's core tuition migration candidate.
