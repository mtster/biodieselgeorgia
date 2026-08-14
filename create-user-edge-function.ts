import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight inspection standard hook
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Retrieve environment parameters safe keys
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ""
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing backend configuration variables. Please set SERVICE_ROLE_KEY in Secrets Vault." }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Initialize elevated Admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    })

    // Retrieve client authorization headers
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: "Authorization session token is missing" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
    const token = authHeader.split(' ')[1]

    // Verify who is making this request natively
    const { data: { user: requester }, error: reqErr } = await supabaseAdmin.auth.getUser(token)
    if (reqErr || !requester) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Check caller attributes in user_metadata or Profiles table
    let isAuthorized = requester.user_metadata?.role === 'admin';
    if (!isAuthorized) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role, permissions')
        .eq('id', requester.id)
        .maybeSingle()

      if (profile) {
        if (
          profile.role === 'admin' || 
          profile.role === 'purchasing_head' || 
          profile.permissions?.users?.includes('modify') || 
          profile.permissions?.users?.includes('add')
        ) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Access denied. Only users with administrative privileges are authorized." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Parse payload fields
    let { action, id, email, password, name, personal_id, phone, role, permissions, privileges, vendor_id } = await req.json()
    const perms = permissions || privileges || {};
    
    // Standardize legacy role names to match database constraint
    if (role === 'manager') {
      role = 'purchasing_head';
    }
    
    // Determine CRUD action
    const targetAction = action || 'create'

    if (targetAction === 'create') {
      if (!email || !password || !name || !personal_id || !phone || !role) {
        return new Response(JSON.stringify({ error: "Required fields (email, password, name, personal_id, phone, role) are missing." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      // Create user auth credentials
      const { data: adminData, error: adminErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          name,
          personal_id,
          phone,
          role,
          permissions: perms,
          vendor_id
        }
      })

      if (adminErr || !adminData.user) {
        return new Response(JSON.stringify({ error: adminErr?.message || "Failed to create authentication credentials." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      // Create mapping record in Profiles table if not a vendor
      let userToUpsert: any = {
        id: adminData.user.id,
        name,
        personal_id,
        email,
        phone,
        role,
        permissions: perms,
        vendor_id,
        created_at: new Date().toISOString()
      };

      if (role !== 'vendor') {
        const { error: upsertErr } = await supabaseAdmin
          .from('profiles')
          .upsert(userToUpsert)

        if (upsertErr) {
          return new Response(JSON.stringify({ error: `User created in auth, but saving profile failed: ${upsertErr.message}` }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          })
        }
      }

      return new Response(JSON.stringify({ success: true, user: userToUpsert }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })

    } else if (targetAction === 'update') {
      if (!id) {
        return new Response(JSON.stringify({ error: "User ID is required for editing." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      // Prepare updates in Auth table
      const authUpdates: any = {
        user_metadata: {
          name,
          personal_id,
          phone,
          role,
          permissions: perms,
          vendor_id
        }
      }
      if (email && email.trim() !== '') {
        authUpdates.email = email.trim();
        authUpdates.email_confirm = true; // Auto confirm email in Auth immediately
      }
      if (password && password.trim() !== '') {
        authUpdates.password = password.trim();
      }

      const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates)
      if (updateAuthErr) {
        console.warn(`Auth update warning: ${updateAuthErr.message}`);
        if (updateAuthErr.message.toLowerCase().includes('user not found') && email) {
          await supabaseAdmin.auth.admin.createUser({
            id,
            email: email.trim(),
            password: (password && password.trim()) || 'Georgia2026!',
            email_confirm: true,
            phone_confirm: true,
            user_metadata: authUpdates.user_metadata
          }).catch((err) => console.warn('Fallback createUser failed:', err));
        }
      }

      // Update mapping record in Profiles table
      let userToUpsert: any = {
        name,
        personal_id,
        phone,
        role,
        permissions: perms,
        vendor_id
      }
      if (email && email.trim() !== '') {
        userToUpsert.email = email.trim();
      }

      if (role !== 'vendor') {
        const { error: upsertErr } = await supabaseAdmin
          .from('profiles')
          .update(userToUpsert)
          .eq('id', id)

        if (upsertErr) {
          return new Response(JSON.stringify({ error: `Auth updated, but profile update failed: ${upsertErr.message}` }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          })
        }
      }

      return new Response(JSON.stringify({ success: true, user: { id, ...userToUpsert } }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })

    } else if (targetAction === 'delete') {
      if (!id) {
        return new Response(JSON.stringify({ error: "User ID is required for deletion." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      // First delete from auth table
      const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(id)
      if (deleteAuthErr) {
        // If auth user wasn't found or delete failed, try to delete the profile regardless,
        // but report the auth error if critical.
        console.warn(`Auth deletion warning/error for ${id}:`, deleteAuthErr.message)
      }

      // Next delete from profiles table
      const { error: deleteProfileErr } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', id)

      if (deleteProfileErr) {
        return new Response(JSON.stringify({ error: `Failed to delete profile: ${deleteProfileErr.message}` }), {
          status: 505,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      return new Response(JSON.stringify({ success: true, deletedId: id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })

    } else {
      return new Response(JSON.stringify({ error: `Unknown action: ${targetAction}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

  } catch (err: any) {
    console.error("Unhandled error in edge function:", err);
    let errMsg = "Internal execution failure";
    if (err instanceof Error) errMsg = err.message;
    else if (typeof err === "string") errMsg = err;
    else if (typeof err === "object") errMsg = JSON.stringify(err);

    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
