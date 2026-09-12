import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";

let client: SupabaseClient | undefined;

export function db(): SupabaseClient {
  if (!client) {
    client = createClient(config.supabaseUrl(), config.serviceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

export function authClient(): SupabaseClient {
  return createClient(config.supabaseUrl(), config.anonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
