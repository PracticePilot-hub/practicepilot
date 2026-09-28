import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabasePublishableKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

const resolvedSupabaseUrl: string = supabaseUrl;
const resolvedSupabasePublishableKey: string = supabasePublishableKey;

declare global {
  var __practicepilotSupabaseClient: SupabaseClient | undefined;
}

function createPracticePilotSupabaseClient(): SupabaseClient {
  return createClient(
    resolvedSupabaseUrl,
    resolvedSupabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
}

export const supabase: SupabaseClient =
  typeof window !== "undefined"
    ? globalThis.__practicepilotSupabaseClient ||
      (globalThis.__practicepilotSupabaseClient =
        createPracticePilotSupabaseClient())
    : createPracticePilotSupabaseClient();
