import {
  createOneTimeCampDueService, isOneTimeCampDueEnabled
} from "./oneTimeCampDueService";

jest.mock("../supabaseClient", () => ({ supabase: { rpc: jest.fn() } }));
const { supabase } = require("../supabaseClient");

beforeEach(() => {
  jest.clearAllMocks();
});
test("SP3 feature is OFF by default without explicit reviewed server rollout", () => {
  const original = process.env.REACT_APP_ENABLE_SP3_ONE_TIME_DUES;
  delete process.env.REACT_APP_ENABLE_SP3_ONE_TIME_DUES;
  try { expect(isOneTimeCampDueEnabled()).toBe(false); }
  finally {
    if (original === undefined) delete process.env.REACT_APP_ENABLE_SP3_ONE_TIME_DUES;
    else process.env.REACT_APP_ENABLE_SP3_ONE_TIME_DUES = original;
  }
});

test("SP3 feature is enabled only by the exact true build-time value", () => {
  const original = process.env.REACT_APP_ENABLE_SP3_ONE_TIME_DUES;
  try {
    process.env.REACT_APP_ENABLE_SP3_ONE_TIME_DUES = "true";
    expect(isOneTimeCampDueEnabled()).toBe(true);
    process.env.REACT_APP_ENABLE_SP3_ONE_TIME_DUES = "1";
    expect(isOneTimeCampDueEnabled()).toBe(false);
  } finally {
    if (original === undefined) delete process.env.REACT_APP_ENABLE_SP3_ONE_TIME_DUES;
    else process.env.REACT_APP_ENABLE_SP3_ONE_TIME_DUES = original;
  }
});

test("SP3 sends subscription UUID only; the server derives amount/type/date", async () => {
  supabase.rpc.mockResolvedValue({
    data: { id: "due-1", created: true, due_type: "one_time",
      total_amount: 3000, due_date: "2027-05-12", remaining_amount: 3000 },
    error: null
  });
  const result = await createOneTimeCampDueService("subscription-1");
  expect(result.created).toBe(true);
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(supabase.rpc).toHaveBeenCalledWith(
    "create_one_time_camp_due", { p_subscription_id: "subscription-1" }
  );
});

test("SP3 repeat-call response does not create another due in client", async () => {
  supabase.rpc.mockResolvedValue({
    data: { id: "due-1", created: false, due_type: "one_time",
      total_amount: 3000, due_date: "2027-05-12" }, error: null
  });
  const result = await createOneTimeCampDueService("subscription-1");
  expect(result).toMatchObject({ id: "due-1", created: false });
});

test("SP3 missing deployment must not be mistaken for a successful charge", async () => {
  supabase.rpc.mockResolvedValue({
    data: null,
    error: { code: "PGRST202", message: "Could not find the function" }
  });
  await expect(createOneTimeCampDueService("subscription-1"))
    .rejects.toThrow(/not deployed/);
});

test("SP3 rejects an invalid or unexpectedly shaped response", async () => {
  supabase.rpc.mockResolvedValue({
    data: { created: true }, error: null
  });
  await expect(createOneTimeCampDueService("subscription-1"))
    .rejects.toThrow(/could not be confirmed/);
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
});

test("SP3 fails closed when enrollment was not selected", async () => {
  await expect(createOneTimeCampDueService(""))
    .rejects.toThrow(/Select a valid One-time/);
  expect(supabase.rpc).not.toHaveBeenCalled();
});

test("SP3 propagates backend role/academy errors without retrying payment", async () => {
  supabase.rpc.mockResolvedValue({
    data: null, error: { message: "Only Academy Owner or Super Admin can create One-time camp dues" }
  });
  await expect(createOneTimeCampDueService("foreign-subscription"))
    .rejects.toThrow(/Only Academy Owner/);
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
});
