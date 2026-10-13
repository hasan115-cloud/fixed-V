import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function isApiKey(str: string): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  // Standard Supabase anon or service_role JWT key format (eyJ...)
  return trimmed.startsWith("eyJ") && trimmed.includes(".");
}

export function isPostgresUrl(str: string): boolean {
  if (!str) return false;
  const trimmed = str.trim().toLowerCase();
  return (
    trimmed.startsWith("postgres://") ||
    trimmed.startsWith("postgresql://")
  );
}

export function parseSupabaseConnection(rawUrl?: string): { supabaseUrl?: string; supabaseKey?: string } | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    return { supabaseUrl: url.trim(), supabaseKey: key.trim() };
  }
  return null;
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = parseSupabaseConnection();
  if (config?.supabaseUrl && config?.supabaseKey) {
    try {
      return createClient(config.supabaseUrl, config.supabaseKey, {
        auth: { persistSession: false }
      });
    } catch (e) {
      console.warn("Notice: Failed to initialize Supabase client:", e);
    }
  }
  return null;
}
