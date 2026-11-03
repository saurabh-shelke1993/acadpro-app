import { formatPlayerProfileDate, shouldShowProfileSessionContext } from "./playerProfilePresentation";

test("formats DOB and joining date consistently with four-digit years", () => {
  expect(formatPlayerProfileDate("2025-05-13")).toBe("13 May 2025");
  expect(formatPlayerProfileDate("2026-06-09")).toBe("09 Jun 2026");
});

test("does not shift a date-only field across time zones", () => {
  expect(formatPlayerProfileDate("2026-11-03")).toBe("03 Nov 2026");
});

test("handles missing or invalid dates without inventing a value", () => {
  expect(formatPlayerProfileDate(null)).toBe("—");
  expect(formatPlayerProfileDate("")).toBe("—");
  expect(formatPlayerProfileDate("2026-02-31")).toBe("—");
  expect(formatPlayerProfileDate("not-a-date")).toBe("—");
});

test("hides repeated center/batch in the schedule when both match the player", () => {
  const player = { centers: { center_name: "GawandBaugh" }, batches: { batch_name: "Juniors" } };
  expect(shouldShowProfileSessionContext({ centerName: "GawandBaugh", batchName: "Juniors" }, player)).toBe(false);
});

test("shows schedule context for a different center or batch", () => {
  const player = { centers: { center_name: "GawandBaugh" }, batches: { batch_name: "Juniors" } };
  expect(shouldShowProfileSessionContext({ centerName: "Lodha Amara", batchName: "Juniors" }, player)).toBe(true);
  expect(shouldShowProfileSessionContext({ centerName: "GawandBaugh", batchName: "U8 Toddlers" }, player)).toBe(true);
});
