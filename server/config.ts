import dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

dotenv.config();

export const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
export const supabaseServiceKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export const isSupabaseConfigured = supabaseUrl !== "" && supabaseServiceKey !== "";

export const supabaseAdmin: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export const formatAuthEmail = (rawEmail?: string, fallbackId?: string): string => {
  let clean = (rawEmail && String(rawEmail).trim()) || '';
  if (!clean && fallbackId) {
    clean = `${fallbackId}@biodiesel.ge`;
  }
  if (clean && !clean.includes('@')) {
    clean = `${clean}@biodiesel.ge`;
  }
  return clean;
};
