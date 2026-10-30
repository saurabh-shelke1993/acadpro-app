import { calculateAttendanceMarks, calculateCohortCollection, dateInRange, instantInRange, monthBounds, reconcileDueLedger, splitPaymentFlows, sum } from "./metricUtils.ts";

Deno.test("monthBounds validates calendar month and IST rollover", () => {
  const b = monthBounds("2026-10-01");
  if (b.startInstant !== "2026-10-01T00:00:00+05:30" || b.endInstant !== "2026-11-01T00:00:00+05:30") throw new Error("Incorrect October bounds.");
  if (monthBounds("2024-02-01").nextMonthStart !== "2024-03-01") throw new Error("Leap-year rollover failed.");
  for (const value of ["2026-10-02", "2026-13-01", "2026-00-01", "bad"]) {
    let rejected = false; try { monthBounds(value); } catch { rejected = true; }
    if (!rejected) throw new Error(`Expected rejection for ${value}`);
  }
});

Deno.test("date and instant ranges are start-inclusive and end-exclusive", () => {
  if (!dateInRange("2026-10-01", "2026-10-01", "2026-11-01") || dateInRange("2026-11-01", "2026-10-01", "2026-11-01")) throw new Error("Date range boundary failure.");
  const b = monthBounds("2026-10-01");
  if (instantInRange("2026-09-30T18:29:59Z", b.startInstant, b.endInstant)) throw new Error("Pre-month instant included.");
  if (!instantInRange("2026-09-30T18:30:00Z", b.startInstant, b.endInstant)) throw new Error("IST month start excluded.");
  if (!instantInRange("2026-10-31T18:29:59Z", b.startInstant, b.endInstant)) throw new Error("Last month instant excluded.");
  if (instantInRange("2026-10-31T18:30:00Z", b.startInstant, b.endInstant)) throw new Error("Next month start included.");
  if (instantInRange("invalid", b.startInstant, b.endInstant)) throw new Error("Invalid date accepted.");
});

Deno.test("sum validates numeric values", () => {
  if (sum([{ amount: "120.5" }, { amount: null }, {}], "amount") !== 120.5) throw new Error("Unexpected sum.");
  for (const amount of ["bad", "   "]) {
    let rejected = false; try { sum([{ amount }], "amount"); } catch { rejected = true; }
    if (!rejected) throw new Error("Invalid amount was accepted.");
  }
});

Deno.test("splitPaymentFlows attributes payment and adjustment by transaction date", () => {
  const b = monthBounds("2026-10-01");
  const rows = [
    { id: "p1", due_id: "d1", amount_paid: 300, payment_entry_type: "payment", payment_date: "2026-10-12T10:00:00+05:30" },
    { id: "a1", due_id: "d1", amount_paid: -50, payment_entry_type: "adjustment", payment_date: "2026-10-13T10:00:00+05:30" },
    { id: "p2", due_id: "d2", amount_paid: 125, payment_entry_type: "payment", payment_date: "2026-11-01T00:00:00+05:30" },
  ];
  const result = splitPaymentFlows(rows, b.startInstant, b.endInstant);
  if (result.grossRecordedCollections !== 300 || result.signedAdjustments !== -50 || result.netRecordedCollections !== 250) throw new Error("Incorrect flow totals.");
});

Deno.test("cohort allocation includes linked transactions through cutoff only", () => {
  const b = monthBounds("2026-10-01");
  const result = calculateCohortCollection(
    [{ id: "d-oct", total_amount: 500, created_at: "2026-10-10T12:00:00+05:30" }, { id: "d-sep", total_amount: 200, created_at: "2026-09-10T12:00:00+05:30" }],
    [
      { id: "p1", due_id: "d-oct", amount_paid: 300, payment_entry_type: "payment", payment_date: "2026-10-20T12:00:00+05:30" },
      { id: "a1", due_id: "d-oct", amount_paid: -25, payment_entry_type: "adjustment", payment_date: "2026-10-21T12:00:00+05:30" },
      { id: "p2", due_id: "d-oct", amount_paid: 100, payment_entry_type: "payment", payment_date: "2026-11-01T00:00:00+05:30" },
    ], b.startInstant, b.endInstant,
  );
  if (result.billedAmount !== 500 || result.netAllocatedAmount !== 275 || result.collectionRatePercent !== 55) throw new Error("Incorrect cohort calculation.");
});

Deno.test("cohort calculation returns unavailable for malformed or unclassified source rows", () => {
  const b = monthBounds("2026-10-01");
  const malformed = calculateCohortCollection([{ id: "d1", total_amount: "bad", created_at: "2026-10-02T00:00:00+05:30" }], [], b.startInstant, b.endInstant);
  if (malformed.quality !== "unavailable" || malformed.billedAmount !== null || malformed.invalidAmountCount !== 1) throw new Error("Malformed amount not surfaced.");
  const unknown = calculateCohortCollection([{ id: "d1", total_amount: 100, created_at: "2026-10-02T00:00:00+05:30" }], [{ id: "x", due_id: "d1", amount_paid: 10, payment_entry_type: "other", payment_date: "2026-10-03T00:00:00+05:30" }], b.startInstant, b.endInstant);
  if (unknown.quality !== "unavailable" || unknown.netAllocatedAmount !== null || unknown.unclassifiedPaymentEntryCount !== 1) throw new Error("Unknown entry type not surfaced.");
});

Deno.test("reconcileDueLedger detects mismatches and refuses unknown linked types", () => {
  const result = reconcileDueLedger(
    [{ id: "clean", paid_amount: 100 }, { id: "bad", paid_amount: 100 }],
    [
      { id: "p1", due_id: "clean", amount_paid: 100, payment_entry_type: "payment", payment_date: "2026-10-01T00:00:00Z" },
      { id: "p2", due_id: "bad", amount_paid: 100, payment_entry_type: "payment", payment_date: "2026-10-01T00:00:00Z" },
      { id: "x", due_id: "bad", amount_paid: 10, payment_entry_type: "unknown", payment_date: "2026-10-01T00:00:00Z" },
    ],
  );
  if (result.checkedDueCount !== 1 || result.unclassifiedPaymentEntryCount !== 1 || result.unclassifiedDueCount !== 1) throw new Error("Reconciliation quality classification failed.");
  if (result.details[1].ledgerNet !== null || result.details[1].issue !== "unclassified_payment_entry_type") throw new Error("Unknown type incorrectly included.");
});

import { applyAttendanceScope, applyPlayerScope, parsePreviewRequest } from "./requestUtils.ts";

const academyId = "123e4567-e89b-42d3-a456-426614174000";
const centerId = "223e4567-e89b-42d3-a456-426614174000";
const batchId = "323e4567-e89b-42d3-a456-426614174000";

Deno.test("preview request parser rejects malformed bodies and identifiers", () => {
  for (const body of [null, [], "text", 42]) {
    if (parsePreviewRequest(body).ok) throw new Error("Non-object request accepted.");
  }
  const badIds = parsePreviewRequest({ academyId: "bad", scopeType: "academy", scopeId: academyId, snapshotMonth: "2026-10-01" });
  if (badIds.ok || !badIds.error.includes("UUID")) throw new Error("Malformed UUID accepted.");
});

Deno.test("preview request parser validates scope type and calendar month", () => {
  const base = { academyId, scopeId: academyId, scopeType: "academy", snapshotMonth: "2026-10-01" };
  if (!parsePreviewRequest(base).ok) throw new Error("Valid academy request rejected.");
  if (parsePreviewRequest({ ...base, scopeType: "player" }).ok) throw new Error("Unsupported scope type accepted.");
  if (parsePreviewRequest({ ...base, snapshotMonth: "2026-02-30" }).ok) throw new Error("Invalid calendar month accepted.");
  if (parsePreviewRequest({ ...base, snapshotMonth: "2026-10-02" }).ok) throw new Error("Non-first day accepted.");
  const mismatch = parsePreviewRequest({ ...base, scopeId: centerId });
  if (mismatch.ok || !mismatch.error.includes("match")) throw new Error("Mismatched academy scope accepted.");
});

Deno.test("attendance scope always applies academy predicate before narrower scope", () => {
  const calls: Array<[string, string, string]> = [];
  const builder = { eq(column: string, value: string) { calls.push(["eq", column, value]); return this; } };
  applyAttendanceScope(builder, { academyId, scopeType: "center", scopeId: centerId });
  const actual = calls.map(call => call[1] + "=" + call[2]).join(",");
  if (actual !== `academy_id=${academyId},center_id=${centerId}`) throw new Error("Center attendance predicates are incomplete or misordered.");
  calls.length = 0;
  applyAttendanceScope(builder, { academyId, scopeType: "batch", scopeId: batchId });
  if (calls.map(call => call[1]).join(",") !== "academy_id,batch_id") throw new Error("Batch attendance is not academy-first.");
});

Deno.test("player finance scope always constrains academy and optionally center", () => {
  const calls: Array<[string, string]> = [];
  const builder = { eq(column: string, value: string) { calls.push([column, value]); return this; } };
  applyPlayerScope(builder, { academyId, scopeType: "academy", scopeId: academyId });
  if (calls.length !== 1 || calls[0][0] !== "academy_id" || calls[0][1] !== academyId) throw new Error("Academy player scope is incorrect.");
  calls.length = 0;
  applyPlayerScope(builder, { academyId, scopeType: "center", scopeId: centerId });
  if (calls.map(call => call[0]).join(",") !== "academy_id,center_id") throw new Error("Center player scope is incomplete.");
});

import { validateScopeOwnership } from "./scopeValidation.ts";
const academyA = "123e4567-e89b-42d3-a456-426614174000";
const academyB = "423e4567-e89b-42d3-a456-426614174000";
const centerA = "223e4567-e89b-42d3-a456-426614174000";
const centerB = "523e4567-e89b-42d3-a456-426614174000";
const batchA = "323e4567-e89b-42d3-a456-426614174000";
const batchB = "623e4567-e89b-42d3-a456-426614174000";
const mismatchedBatch = "723e4567-e89b-42d3-a456-426614174000";
function fakeOwnershipLookup() {
  const centers = new Map([
    [centerA, { id: centerA, academy_id: academyA }],
    [centerB, { id: centerB, academy_id: academyB }],
  ]);
  const batches = new Map([
    [batchA, { id: batchA, academy_id: academyA, center_id: centerA }],
    [batchB, { id: batchB, academy_id: academyB, center_id: centerB }],
    [mismatchedBatch, { id: mismatchedBatch, academy_id: academyA, center_id: centerB }],
  ]);
  return {
    async academyExists(id: string) { return id === academyA || id === academyB; },
    async findCenter(id: string) { return centers.get(id) ?? null; },
    async findBatch(id: string) { return batches.get(id) ?? null; },
  };
}
Deno.test("ownership validator accepts academy and same-academy center/batch scopes", async () => {
  const lookup = fakeOwnershipLookup();
  await validateScopeOwnership({ academyId: academyA, scopeType: "academy", scopeId: academyA }, lookup);
  await validateScopeOwnership({ academyId: academyA, scopeType: "center", scopeId: centerA }, lookup);
  await validateScopeOwnership({ academyId: academyA, scopeType: "batch", scopeId: batchA }, lookup);
});
Deno.test("ownership validator rejects a center owned by another academy", async () => {
  let rejected = false;
  try { await validateScopeOwnership({ academyId: academyA, scopeType: "center", scopeId: centerB }, fakeOwnershipLookup()); }
  catch (error) { rejected = error instanceof Error && error.message.includes("Center is not owned"); }
  if (!rejected) throw new Error("Cross-academy center was accepted.");
});
Deno.test("ownership validator rejects a batch owned by another academy", async () => {
  let rejected = false;
  try { await validateScopeOwnership({ academyId: academyA, scopeType: "batch", scopeId: batchB }, fakeOwnershipLookup()); }
  catch (error) { rejected = error instanceof Error && error.message.includes("Batch is not owned"); }
  if (!rejected) throw new Error("Cross-academy batch was accepted.");
});
Deno.test("ownership validator rejects a batch linked to another academy's center", async () => {
  let rejected = false;
  try { await validateScopeOwnership({ academyId: academyA, scopeType: "batch", scopeId: mismatchedBatch }, fakeOwnershipLookup()); }
  catch (error) { rejected = error instanceof Error && error.message.includes("Batch center does not belong"); }
  if (!rejected) throw new Error("Batch with cross-academy center was accepted.");
});
Deno.test("ownership validator rejects missing academies and academy scope mismatch", async () => {
  const lookup = fakeOwnershipLookup();
  let missingRejected = false;
  try { await validateScopeOwnership({ academyId: "823e4567-e89b-42d3-a456-426614174000", scopeType: "academy", scopeId: "823e4567-e89b-42d3-a456-426614174000" }, lookup); }
  catch (error) { missingRejected = error instanceof Error && error.message.includes("Academy does not exist"); }
  let mismatchRejected = false;
  try { await validateScopeOwnership({ academyId: academyA, scopeType: "academy", scopeId: academyB }, lookup); }
  catch (error) { mismatchRejected = error instanceof Error && error.message.includes("must match"); }
  if (!missingRejected || !mismatchRejected) throw new Error("Missing/mismatched academy scope was accepted.");
});

Deno.test("attendance marks are unavailable when no rows exist, not verified zero", () => {
  const result = calculateAttendanceMarks([]);
  if (result.presentCount !== null || result.absentCount !== null || result.attendanceRatePercent !== null) {
    throw new Error("Empty source was represented as numeric zero.");
  }
  if (result.ignoredStatusCount !== null || result.missingScheduleIdCount !== null) {
    throw new Error("Empty source diagnostics must be null, not numeric zero.");
  }
  if (result.markQuality !== "unavailable" || result.diagnosticQuality !== "unavailable") {
    throw new Error("Empty source quality must be unavailable.");
  }
});

Deno.test("attendance marks are unavailable when rows contain no supported statuses", () => {
  const result = calculateAttendanceMarks([
    { status: "late", batch_schedule_id: "schedule-1" },
    { status: null, batch_schedule_id: null },
  ]);
  if (result.presentCount !== null || result.absentCount !== null || result.attendanceRatePercent !== null) {
    throw new Error("Unsupported statuses were converted into zero present/absent marks.");
  }
  if (result.ignoredStatusCount !== 2 || result.missingScheduleIdCount !== 1) {
    throw new Error("Attendance quality diagnostics are incorrect.");
  }
});

Deno.test("attendance marks calculate supported counts but remain partial without session coverage", () => {
  const result = calculateAttendanceMarks([
    { status: "present", batch_schedule_id: "schedule-1" },
    { status: "absent", batch_schedule_id: "schedule-1" },
    { status: "present", batch_schedule_id: null },
  ]);
  if (result.presentCount !== 2 || result.absentCount !== 1 || result.attendanceRatePercent !== 66.67) {
    throw new Error("Recorded attendance marks were calculated incorrectly.");
  }
  if (result.markQuality !== "partial" || result.missingScheduleIdCount !== 1) {
    throw new Error("Recorded marks must remain partial where schedule coverage is incomplete.");
  }
});

Deno.test("attendance marks exclude unsupported statuses from rate and preserve partial quality", () => {
  const result = calculateAttendanceMarks([
    { status: "present", batch_schedule_id: "schedule-1" },
    { status: "excused", batch_schedule_id: "schedule-1" },
  ]);
  if (result.presentCount !== 1 || result.absentCount !== 0 || result.attendanceRatePercent !== 100) {
    throw new Error("Unsupported status affected the attendance rate.");
  }
  if (result.ignoredStatusCount !== 1 || result.markQuality !== "partial") {
    throw new Error("Unsupported status was not surfaced as a quality limitation.");
  }
});

Deno.test("attendance marks report all-absent activity as a valid recorded-mark rate", () => {
  const result = calculateAttendanceMarks([
    { status: "absent", batch_schedule_id: "schedule-1" },
    { status: "absent", batch_schedule_id: "schedule-2" },
  ]);
  if (result.presentCount !== 0 || result.absentCount !== 2 || result.attendanceRatePercent !== 0) {
    throw new Error("All-absent recorded marks should yield a 0% recorded-mark rate.");
  }
  if (result.markQuality !== "partial") throw new Error("All-absent recorded marks are not expected-session coverage.");
});
