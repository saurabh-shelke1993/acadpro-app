import { supabase } from "./supabase";

export const fetchPlayerSubscriptions = async () => {
  const { data, error } = await supabase
    .from("player_subscriptions")
    .select(`
      *,
      players(
        id,
        full_name,
        academy_id,
        center_id,
        batch_id,
        academies(academy_name),
        centers(center_name),
        batches(batch_name)
      ),
      subscription_plans(
        plan_name,
        billing_cycle,
        amount
      )
    `);

  if (error) throw error;

  return data || [];
};

export const createPlayerSubscription =
  async (payload) => {
    const { data, error } = await supabase
      .from("player_subscriptions")
      .insert([payload])
      .select();

    if (error) throw error;

    return data;
  };

export const deactivatePlayerSubscription =
  async (id) => {
    const { error } = await supabase
      .from("player_subscriptions")
      .update({
        status: "inactive",
      })
      .eq("id", id);

    if (error) throw error;
  };