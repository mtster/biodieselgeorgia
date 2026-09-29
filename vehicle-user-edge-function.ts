import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: "Authorization session token is missing" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
    const token = authHeader.split(' ')[1]

    const { data: { user: requester }, error: reqErr } = await supabaseAdmin.auth.getUser(token)
    if (reqErr || !requester) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    let isAuthorized = requester.user_metadata?.role === 'admin' ||
      requester.user_metadata?.role === 'purchasing_head' ||
      requester.user_metadata?.permissions?.vehicles?.includes('add') ||
      requester.user_metadata?.permissions?.vehicles?.includes('modify');

    if (!isAuthorized) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role, permissions, privileges')
        .eq('id', requester.id)
        .maybeSingle()

      if (profile) {
        if (
          profile.role === 'admin' || 
          profile.role === 'purchasing_head' || 
          profile.permissions?.vehicles?.includes('add') || 
          profile.permissions?.vehicles?.includes('modify') ||
          profile.privileges?.vehicles?.includes('add') || 
          profile.privileges?.vehicles?.includes('modify')
        ) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Access denied. Only authorized administrators or managers can manage vehicle accounts." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const body = await req.json().catch(() => ({}));
    const { plate_number, password, auth_user_id, id, original_plate_number, vehicle_id } = body;

    const effectivePlate = (plate_number || body?.plate_number || '').trim().toUpperCase();
    if (!effectivePlate) {
      return new Response(JSON.stringify({ error: "License plate number must be provided." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const cleanPlate = effectivePlate;
    const sanitizedPlate = cleanPlate.replace(/-/g, "").toLowerCase();
    const newEmail = `${sanitizedPlate}@biodiesel.ge`;

    let existingUser: any = null;

    // 1. Check by provided auth_user_id or id
    const targetAuthId = auth_user_id || id;
    if (targetAuthId && /^[0-9a-f-]{36}$/i.test(targetAuthId)) {
      try {
        const { data: uData, error: uErr } = await supabaseAdmin.auth.admin.getUserById(targetAuthId);
        if (!uErr && uData?.user) {
          existingUser = uData.user;
        }
      } catch (_) {}
    }

    // 2. Check vehicles table in database
    if (!existingUser) {
      try {
        const queryPlates = [cleanPlate];
        if (original_plate_number && String(original_plate_number).trim()) {
          queryPlates.push(String(original_plate_number).trim().toUpperCase());
        }
        let vQuery = supabaseAdmin.from("vehicles").select("auth_user_id").in("plate_number", queryPlates);
        if (vehicle_id && /^[0-9a-f-]{36}$/i.test(vehicle_id)) {
          vQuery = supabaseAdmin.from("vehicles").select("auth_user_id").or(`id.eq.${vehicle_id},plate_number.in.(${queryPlates.join(",")})`);
        }
        const { data: vRows } = await vQuery;
        const foundAuthId = vRows?.find((r: any) => r.auth_user_id)?.auth_user_id;
        if (foundAuthId) {
          const { data: uData } = await supabaseAdmin.auth.admin.getUserById(foundAuthId);
          if (uData?.user) existingUser = uData.user;
        }
      } catch (_) {}
    }

    // 3. Check by old plate email or metadata
    if (!existingUser && original_plate_number && String(original_plate_number).trim()) {
      const oldClean = String(original_plate_number).trim().replace(/-/g, "").toLowerCase();
      const oldEmail = `${oldClean}@biodiesel.ge`;
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        existingUser = listData?.users?.find((u: any) => 
          u.email?.toLowerCase() === oldEmail.toLowerCase() ||
          u.user_metadata?.plate_number === original_plate_number
        ) || null;
      } catch (_) {}
    }

    // 4. Check by new plate email or metadata
    if (!existingUser) {
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        existingUser = listData?.users?.find((u: any) => 
          u.email?.toLowerCase() === newEmail.toLowerCase() ||
          u.user_metadata?.plate_number === cleanPlate
        ) || null;
      } catch (_) {}
    }

    // IF EXISTING USER WAS FOUND -> UPDATE IN PLACE
    if (existingUser) {
      if (existingUser.email?.toLowerCase() !== newEmail.toLowerCase()) {
        try {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
          const conflictingUsers = listData?.users?.filter(
            (u: any) => (u.email?.toLowerCase() === newEmail.toLowerCase() ||
                   (original_plate_number && u.user_metadata?.plate_number === original_plate_number)) &&
                   u.id !== existingUser.id
          ) || [];
          for (const conf of conflictingUsers) {
            await supabaseAdmin.auth.admin.deleteUser(conf.id).catch(() => {});
          }
        } catch (_) {}
      }

      const updatePayload: any = {
        email: newEmail,
        email_confirm: true,
        user_metadata: {
          ...existingUser.user_metadata,
          role: "driver",
          vehicle_role: "vehicle",
          plate_number: cleanPlate,
          name: `Vehicle ${cleanPlate}`
        }
      };

      if (password && String(password).trim().length >= 6) {
        updatePayload.password = String(password).trim();
      }

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        updatePayload
      );

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Sync into vehicles table directly
      try {
        const vUpdatePayload: any = {
          plate_number: cleanPlate,
          auth_user_id: existingUser.id,
          is_deleted: false
        };
        if (body.model) vUpdatePayload.model = body.model;
        if (body.driver_id !== undefined) vUpdatePayload.driver_id = body.driver_id || null;
        if (body.companion_id !== undefined) vUpdatePayload.companion_id = body.companion_id || null;
        if (body.city !== undefined) vUpdatePayload.city = body.city || null;
        if (body.warehouse_id !== undefined) vUpdatePayload.warehouse_id = body.warehouse_id || null;
        if (body.direction_id !== undefined) vUpdatePayload.direction_id = body.direction_id || null;

        if (vehicle_id && /^[0-9a-f-]{36}$/i.test(vehicle_id)) {
          await supabaseAdmin.from("vehicles").update(vUpdatePayload).eq("id", vehicle_id);
        } else if (original_plate_number) {
          await supabaseAdmin.from("vehicles").update(vUpdatePayload).eq("plate_number", original_plate_number);
        } else {
          await supabaseAdmin.from("vehicles").upsert([vUpdatePayload], { onConflict: "plate_number" });
        }
      } catch (dbErr) {
        console.warn("Failed to update vehicles table during edge function account sync:", dbErr);
      }

      return new Response(JSON.stringify({
        success: true,
        auth_user_id: existingUser.id,
        email: newEmail,
        action: "updated"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // BRAND NEW VEHICLE -> CREATE NEW AUTH USER
    if (!password || String(password).trim().length < 6) {
      return new Response(JSON.stringify({ error: "Password (min. 6 symbols) is required to create a vehicle account." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const conflicting = listData?.users?.find(
        (u: any) => u.email?.toLowerCase() === newEmail.toLowerCase()
      );
      if (conflicting) {
        await supabaseAdmin.auth.admin.deleteUser(conflicting.id).catch(() => {});
      }
    } catch (_) {}

    const effectivePassword = String(password).trim();

    const { data: adminData, error: adminErr } = await supabaseAdmin.auth.admin.createUser({
      email: newEmail,
      password: effectivePassword,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        role: "driver",
        vehicle_role: "vehicle",
        plate_number: cleanPlate,
        name: `Vehicle ${cleanPlate}`
      }
    });

    if (adminErr || !adminData?.user) {
      return new Response(JSON.stringify({ error: adminErr?.message || "Failed to create vehicle account" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Ensure vehicles table receives auth_user_id and is upserted
    try {
      const vCreatePayload: any = {
        plate_number: cleanPlate,
        auth_user_id: adminData.user.id,
        is_deleted: false
      };
      if (body.model) vCreatePayload.model = body.model;
      if (body.driver_id !== undefined) vCreatePayload.driver_id = body.driver_id || null;
      if (body.companion_id !== undefined) vCreatePayload.companion_id = body.companion_id || null;
      if (body.city !== undefined) vCreatePayload.city = body.city || null;
      if (body.warehouse_id !== undefined) vCreatePayload.warehouse_id = body.warehouse_id || null;
      if (body.direction_id !== undefined) vCreatePayload.direction_id = body.direction_id || null;

      if (vehicle_id && /^[0-9a-f-]{36}$/i.test(vehicle_id)) {
        await supabaseAdmin.from("vehicles").update(vCreatePayload).eq("id", vehicle_id);
      } else {
        await supabaseAdmin.from("vehicles").upsert([vCreatePayload], { onConflict: "plate_number" });
      }
    } catch (dbErr) {
      console.warn("Failed to set auth_user_id on vehicles table:", dbErr);
    }

    return new Response(JSON.stringify({
      success: true,
      auth_user_id: adminData.user.id,
      email: newEmail,
      action: "created"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
