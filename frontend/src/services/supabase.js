import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  "https://ulyealhkmlorsbdiknrh.supabase.co";

const supabaseAnonKey =
  "sb_publishable_f2zr4i-x5ez3MdzsBZ36Wg_UFjZFNb5";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);