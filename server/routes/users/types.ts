import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceKey);

export const supabaseAdmin = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export function formatAuthEmail(inputEmail?: string): string {
  if (!inputEmail) return '';
  const trimmed = inputEmail.trim();
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  return `${trimmed.toLowerCase()}@biodiesel.ge`;
}

export function cleanUserPhone(rawPhone?: string): string {
  if (!rawPhone) return '+995 599 00 00 00';
  let phone = rawPhone.trim();
  if (!phone.startsWith('+995') && !phone.startsWith('995')) {
    phone = `+995${phone.replace(/[^0-9]/g, '')}`;
  }
  return phone;
}
