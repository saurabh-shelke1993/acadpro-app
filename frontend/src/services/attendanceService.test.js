import { supabase } from "../supabaseClient";
import { updateAttendanceStatus, saveAttendanceRecords } from "./attendanceService";

jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn() } }));

let query;
let outcome;
beforeEach(() => {
  jest.clearAllMocks();
  outcome = { data: [{ id: "attendance-1" }], error: null };
  query = {
    update: jest.fn(() => query),
    eq: jest.fn(() => query),
    select: jest.fn(async () => outcome),
    insert: jest.fn(async () => ({ error: null })),
  };
  supabase.from.mockReturnValue(query);
});

test("AM4 status update confirms exactly one attendance row was changed", async () => {
  await expect(updateAttendanceStatus("attendance-1", "absent")).resolves.toBeUndefined();
  expect(supabase.from).toHaveBeenCalledWith("attendance");
  expect(query.update).toHaveBeenCalledWith({ status: "absent" });
  expect(query.eq).toHaveBeenCalledWith("id", "attendance-1");
  expect(query.select).toHaveBeenCalledWith("id");
});

test("AM4 rejects a zero-row UPDATE hidden by RLS", async () => {
  outcome = { data: [], error: null };
  await expect(updateAttendanceStatus("attendance-1", "present"))
    .rejects.toThrow("was not applied");
});

test("AM4 propagates database errors and rejects malformed update results", async () => {
  outcome = { data: null, error: new Error("RLS update denied") };
  await expect(updateAttendanceStatus("attendance-1", "present")).rejects.toThrow("RLS update denied");
  outcome = { data: null, error: null };
  await expect(updateAttendanceStatus("attendance-1", "present")).rejects.toThrow("was not applied");
});

test("Original attendance INSERT behavior is unchanged", async () => {
  const rows = [{ player_id: "player-1", status: "present" }];
  await expect(saveAttendanceRecords(rows)).resolves.toBeUndefined();
  expect(query.insert).toHaveBeenCalledWith(rows);
});
