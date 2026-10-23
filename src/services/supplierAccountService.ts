import { supabase } from '../lib/supabase';

export interface SupplierAccountParams {
  vendorId: string;
  username: string;
  password?: string;
  authUserId?: string;
  tradeName?: string;
  companyName?: string;
}

export async function saveSupplierAccount(params: SupplierAccountParams): Promise<{ userId: string; username: string; email: string }> {
  const cleanUsername = params.username.trim();
  if (!cleanUsername) {
    throw new Error('მომხმარებლის სახელი სავალდებულოა.');
  }

  const payload = {
    vendor_id: params.vendorId,
    username: cleanUsername,
    password: params.password?.trim() || undefined,
    auth_user_id: params.authUserId || undefined,
    trade_name: params.tradeName,
    company_name: params.companyName
  };

  const useProxy = typeof window !== 'undefined' && !window.location.hostname.includes('vercel.app');
  let data: any = null;

  if (useProxy) {
    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;

      const res = await fetch('/api/supplier-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        data = await res.json();
      } else {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || `Server error (${res.status})`);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
        throw err;
      }
    }
  }

  if (!data) {
    const { data: fnData, error: fnErr } = await supabase.functions.invoke('supplier-user', {
      body: payload
    });

    if (fnErr || !fnData?.success) {
      throw new Error(fnErr?.message || fnData?.error || 'მომწოდებლის ანგარიშის შექმნა/განახლება ვერ მოხერხდა.');
    }
    data = fnData;
  }

  return {
    userId: data.user_id,
    username: data.username || cleanUsername,
    email: data.email
  };
}
