// utils/supabaseClient.mjs
import { createClient } from "@supabase/supabase-js";
if (process.env.NODE_ENV !== "production") {
  await import("dotenv/config");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default supabase;
