import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization, Content-Type, Accept, X-Requested-With',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ""
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing backend configuration variables. Please set SERVICE_ROLE_KEY in Secrets Vault." }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    })

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: "Authorization session token is missing" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
    const token = authHeader.split(' ')[1]

    let requester: any = null;
    try {
      const { data: { user }, error: reqErr } = await supabaseAdmin.auth.getUser(token);
      if (!reqErr && user) requester = user;
    } catch (_) {}

    if (!requester && token && token.includes('.')) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payloadStr = atob(parts[1]);
          const payload = JSON.parse(payloadStr);
          const userId = payload?.sub || payload?.id;
          if (userId && typeof userId === 'string' && /^[0-9a-f-]{36}$/i.test(userId)) {
            const { data: adminUserRes } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (adminUserRes?.user) {
              requester = adminUserRes.user;
            }
          }
        }
      } catch (_) {}
    }

    if (!requester) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const requesterRole = requester.app_metadata?.role || requester.user_metadata?.role;
    let isAuthorized = requesterRole === 'admin' || requesterRole === 'purchasing_head' || requesterRole === 'manager';

    const reqPerms = requester.app_metadata?.permissions || requester.user_metadata?.permissions || {};
    if (
      (Array.isArray(reqPerms.suppliers) && (reqPerms.suppliers.includes('modify') || reqPerms.suppliers.includes('add'))) ||
      (Array.isArray(reqPerms.users) && (reqPerms.users.includes('modify') || reqPerms.users.includes('add')))
    ) {
      isAuthorized = true;
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, permissions, is_blocked, is_deleted')
      .eq('id', requester.id)
      .maybeSingle();

    if (profile) {
      if (profile.is_blocked || profile.is_deleted) {
        return new Response(JSON.stringify({ error: "Access denied: Account is blocked or deleted." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (
        profile.role === 'admin' || 
        profile.role === 'purchasing_head' || 
        profile.permissions?.suppliers?.includes('modify') || 
        profile.permissions?.suppliers?.includes('add')
      ) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Access denied. Administrative or purchasing privileges are required." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json().catch(() => ({}));
    const { vendor_id, username, password, auth_user_id, trade_name, company_name } = body;

    const rawUsername = (username || '').toString().trim();
    if (!rawUsername) {
      return new Response(JSON.stringify({ error: "მომხმარებლის სახელი სავალდებულოა." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Append @biodiesel.ge endpoint if no @ is in the username
    const email = rawUsername.includes('@') ? rawUsername : `${rawUsername}@biodiesel.ge`;

    let existingUser: any = null;

    if (auth_user_id && /^[0-9a-f-]{36}$/i.test(auth_user_id)) {
      try {
        const { data: uData } = await supabaseAdmin.auth.admin.getUserById(auth_user_id);
        if (uData?.user) existingUser = uData.user;
      } catch (_) {}
    }

    if (!existingUser && vendor_id) {
      try {
        const { data: vRow } = await supabaseAdmin.from('vendors').select('user_id').eq('id', vendor_id).maybeSingle();
        if (vRow?.user_id) {
          const { data: uData } = await supabaseAdmin.auth.admin.getUserById(vRow.user_id);
          if (uData?.user) existingUser = uData.user;
        }
      } catch (_) {}
    }

    if (!existingUser) {
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        existingUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase()) || null;
      } catch (_) {}
    }

    let resultUserId = '';

    if (existingUser) {
      resultUserId = existingUser.id;
      const updatePayload: any = {
        email,
        email_confirm: true,
        app_metadata: { role: 'vendor' },
        user_metadata: {
          role: 'vendor',
          vendor_id,
          name: trade_name || company_name || 'Supplier'
        }
      };

      if (password && String(password).trim().length >= 6) {
        updatePayload.password = String(password).trim();
      }

      const { data: updatedData, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, updatePayload);
      if (updateErr) {
        return new Response(JSON.stringify({ error: `Supplier auth update failed: ${updateErr.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      resultUserId = updatedData.user.id;
    } else {
      const cleanPassword = (password && String(password).trim()) || 'Georgia2026!';
      const createPayload: any = {
        email,
        password: cleanPassword,
        email_confirm: true,
        app_metadata: { role: 'vendor' },
        user_metadata: {
          role: 'vendor',
          vendor_id,
          name: trade_name || company_name || 'Supplier'
        }
      };

      const { data: createdData, error: createErr } = await supabaseAdmin.auth.admin.createUser(createPayload);
      if (createErr || !createdData.user) {
        return new Response(JSON.stringify({ error: `Supplier auth creation failed: ${createErr?.message || 'Unknown error'}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      resultUserId = createdData.user.id;
    }

    // NOTE: Supplier credentials are NOT saved in the profiles table!
    // Instead, vendor_id and username are saved directly in the vendors table.

    return new Response(JSON.stringify({
      success: true,
      user_id: resultUserId,
      username: rawUsername,
      email
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
