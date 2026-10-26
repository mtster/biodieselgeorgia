import { createClient } from '@supabase/supabase-js';
import { persistentAuthStorage } from './persistentAuth';

// Detect Supabase credentials
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : '') || '';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : '') || '';

export const isSupabaseConfigured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';

// Initialize Supabase Client with persistent multi-tier PWA storage
export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: persistentAuthStorage as any,
      },
    })
  : null;

