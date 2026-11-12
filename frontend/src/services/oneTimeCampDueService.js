import { supabase } from "../supabaseClient";

/**
 * SP3 is OFF by default, including development, until the reviewed server SQL
 * is explicitly approved, deployed in isolation, and security-tested.
 * REACT_APP_ variables are build-time public UI configuration, NOT authorization.
 * Database RLS + triggers + security-invoker RPC are the trusted guard.
 */
export const isOneTimeCampDueEnabled = () =>
  process.env.REACT_APP_ENABLE_SP3_ONE_TIME_DUES === "true";

export const createOneTimeCampDueService = async (subscriptionId, client = supabase) => {
  if (!subscriptionId || typeof subscriptionId !== "string") {
    throw new Error("Select a valid One-time camp enrollment first.");
  }
  const { data, error } = await client.rpc("create_one_time_camp_due", {
    p_subscription_id: subscriptionId,
  });
  if (error) {
    if (error.code === "PGRST202" || /could not find the function|schema cache/i.test(error.message || "")) {
      throw new Error("The One-time camp billing service is not deployed. No payment due was created.");
    }
    throw new Error(error.message || "The One-time camp due could not be created.");
  }
  if (!data || typeof data !== "object" ||
    typeof data.created !== "boolean" || !data.id || data.due_type !== "one_time") {
    throw new Error("The camp charge could not be confirmed. Refresh Payment Dues before trying again.");
  }
  return data;
};
