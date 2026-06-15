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

    // Check caller attributes in Profiles table to guarantee they are strictly an 'admin'
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', requester.id)
      .single()

    if (profErr || !profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: "Access denied. Only users with Admin role are authorized." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Parse payload fields
    const { action, id, email, password, name, personal_id, phone, role, privileges } = await req.json()
    
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
          privileges,
        }
      })

      if (adminErr || !adminData.user) {
        return new Response(JSON.stringify({ error: adminErr?.message || "Failed to create authentication credentials." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      // Create mapping record in Profiles table
      const userToUpsert = {
        id: adminData.user.id,
        name,
        personal_id,
        email,
        phone,
        role,
        privileges: privileges || [],
        created_at: new Date().toISOString()
      }

      const { error: upsertErr } = await supabaseAdmin
        .from('profiles')
        .upsert(userToUpsert)

      if (upsertErr) {
        return new Response(JSON.stringify({ error: `User created in auth, but saving profile failed: ${upsertErr.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
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
        email,
        user_metadata: {
          name,
          personal_id,
          phone,
          role,
          privileges,
        }
      }
      if (password && password.trim() !== '') {
        authUpdates.password = password
      }

      const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates)
      if (updateAuthErr) {
        return new Response(JSON.stringify({ error: `Auth update failed: ${updateAuthErr.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      // Update mapping record in Profiles table
      const userToUpsert = {
        id,
        name,
        personal_id,
        email,
        phone,
        role,
        privileges: privileges || []
      }

      const { error: upsertErr } = await supabaseAdmin
        .from('profiles')
        .upsert(userToUpsert)

      if (upsertErr) {
        return new Response(JSON.stringify({ error: `Auth updated, but profile update failed: ${upsertErr.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      return new Response(JSON.stringify({ success: true, user: userToUpsert }), {
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
    return new Response(JSON.stringify({ error: err.message || "Internal execution failure" }), {
      status: 505,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
