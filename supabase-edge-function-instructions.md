# Supabase Edge Function: Admin User Creation

This document contains the complete production-ready source code of the **Supabase Edge Function** to safely handle secure administratively authorized user creation under complete `admin` role restriction, along with step-by-step instructions on deployment.

---

## 1. Quick Setup & Configuration Instructions

Only Users holding the dynamic `admin` role in your public `profiles` table are authorized to invoke this function.

### Step 1: Initialize the Edge Function
In your local CLI terminal, navigate into your Supabase project directory and create the function:
```bash
supabase functions new create-user
```
This command generates a new folder inside your codebase: `supabase/functions/create-user/index.ts`.

### Step 2: Configure Environment Secret Vault
Ensure that your Supabase Edge Function container has access to your master credentials. Run the following command in your terminal:
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```
*(Supabase dynamically provides the `SUPABASE_URL` environment variable automatically, so you do not need to declare it manually).*

### Step 3: Deploy to Production Cloud
Compile and deploy the code securely using:
```bash
supabase functions deploy create-user --no-verify-jwt
```
*(We use `--no-verify-jwt` because our TypeScript script manually extracts, parses & validates the caller’s session JWT safely against the live `profiles` database table inside the secure script execution context).*

---

## 2. Complete Edge Function Code (`index.ts`)

Paste this exact content directly into your `supabase/functions/create-user/index.ts` file:

```typescript
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing backend configuration variables in Supabase Secrets Vault." }), 
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
    const { email, password, name, personal_id, phone, role, privileges } = await req.json()
    if (!email || !password || !name || !personal_id || !phone || !role) {
      return new Response(JSON.stringify({ error: "Required fields (email, password, name, personal_id, phone, role) are missing." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Construct user auth trigger credentials
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
      return new Response(JSON.stringify({ error: adminErr?.message || "Failed to finalize auth credentials container." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Force create mapping record in Profiles table
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

    // Directly insert into public.profiles to bypass trigger delay syncs
    const { error: upsertErr } = await supabaseAdmin
      .from('profiles')
      .upsert(userToUpsert)

    if (upsertErr) {
      console.warn("Manual profile sync log failed (trigger may override):", upsertErr.message)
    }

    return new Response(JSON.stringify({ success: true, user: userToUpsert }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal execution failure" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
```
