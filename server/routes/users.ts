import express from "express";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAdmin, isSupabaseConfigured, formatAuthEmail } from "../config";
import { handleVehicleAccountCreation } from "./vehicles";

const router = express.Router();

// Endpoint to create a user administratively (or update if id/action provided)
router.post("/api/create-user", async (req, res) => {
  if (req.body?.action === "vehicle_create_or_update") {
    return handleVehicleAccountCreation(req, res);
  }
  try {
    if (!isSupabaseConfigured || !supabaseAdmin) {
      return res.status(400).json({ error: "Supabase service role key is not configured on the server." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization token is missing" });
    }

    const token = authHeader.split(" ")[1];
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Unauthorized: Invalid session token" });
    }

    // Check if user is authorized (admin or user management permissions)
    let isRequesterAuthorized = user.user_metadata?.role === "admin";
    if (!isRequesterAuthorized) {
      const { data: requesterProfile } = await supabaseAdmin
        .from("profiles")
        .select("role, permissions")
        .eq("id", user.id)
        .maybeSingle();
      if (
        requesterProfile &&
        (requesterProfile.role === "admin" ||
         requesterProfile.role === "purchasing_head" ||
         requesterProfile.permissions?.users?.includes("add") ||
         requesterProfile.permissions?.users?.includes("modify"))
      ) {
        isRequesterAuthorized = true;
      }
    }

    if (!isRequesterAuthorized) {
      return res.status(403).json({ error: "Access denied: Only Administrators or authorized managers can create/modify users." });
    }

    const { action, id, email, password, name, personal_id, phone, role, permissions, privileges, warehouse_id, vendor_id, is_blocked } = req.body;
    const perms = permissions || privileges || {};
    let assignedRole = role || "operator";
    if (assignedRole === "manager") {
      assignedRole = "purchasing_head";
    }

    // If action is update or an ID is present, perform update
    if (action === "update" || (id && action !== "create")) {
      const hasEmail = Boolean(email && String(email).trim());
      const cleanEmail = hasEmail ? formatAuthEmail(email) : '';
      const updatePayload: any = {
        user_metadata: {
          name: (name && String(name).trim()) || "",
          personal_id: (personal_id && String(personal_id).trim()) || "",
          phone: (phone && String(phone).trim()) || "",
          role: assignedRole,
          permissions: perms,
          privileges: perms,
          vendor_id: vendor_id || null,
        }
      };

      if (cleanEmail) {
        updatePayload.email = cleanEmail;
        updatePayload.email_confirm = true;
      }
      if (password && String(password).trim() !== "") {
        updatePayload.password = String(password).trim();
      }

      const { error: adminError } = await supabaseAdmin.auth.admin.updateUserById(id, updatePayload);
      if (adminError) {
        console.warn("Supabase Admin Auth Update Warning:", adminError.message);
        if (adminError.message.toLowerCase().includes("user not found") && cleanEmail) {
          await supabaseAdmin.auth.admin.createUser({
            id,
            email: cleanEmail,
            password: (password && String(password).trim()) || "Georgia2026!",
            email_confirm: true,
            phone_confirm: true,
            user_metadata: updatePayload.user_metadata
          }).catch((err) => console.warn("Fallback createUser failed:", err));
        }
      }

      const profilePayload: any = {
        name: (name && String(name).trim()) || "",
        personal_id: (personal_id && String(personal_id).trim()) || "",
        phone: (phone && String(phone).trim()) || "",
        role: assignedRole,
        permissions: perms,
        vendor_id: vendor_id || null,
        is_blocked: is_blocked ?? false,
        email: cleanEmail ? cleanEmail : null
      };

      const { data: updatedProfile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .update(profilePayload)
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (profileErr) {
        console.error("Supabase Profile Update Error:", profileErr);
      }

      return res.json({
        success: true,
        user: updatedProfile ? {
          ...updatedProfile,
          email: updatedProfile.email || ''
        } : {
          id,
          email: cleanEmail || '',
          name,
          personal_id,
          phone,
          role: assignedRole,
          permissions: perms,
          vendor_id,
          is_blocked: is_blocked ?? false
        }
      });
    }

    // Action is CREATE
    const cleanPersonalId = (personal_id && String(personal_id).trim()) || `12${Math.floor(100000000 + Math.random() * 900000000)}`;
    const hasEmail = Boolean(email && String(email).trim());
    const cleanEmail = hasEmail ? formatAuthEmail(email) : '';
    const cleanName = (name && String(name).trim()) || "New User";
    const cleanPhone = (phone && String(phone).trim()) || "+995 599 00 00 00";

    // Drivers and Driver Assistants DO NOT need auth users created (they don't log in anywhere)
    // They are purely informational rows inserted directly into the profiles table
    if (assignedRole === "driver" || assignedRole === "driver_assistant") {
      const profileId = (id && /^[0-9a-f-]{36}$/i.test(id)) ? id : crypto.randomUUID();
      const profilePayload: any = {
        id: profileId,
        name: cleanName,
        personal_id: cleanPersonalId,
        phone: cleanPhone,
        role: assignedRole,
        permissions: {},
        privileges: [],
        vendor_id: null,
        is_blocked: is_blocked ?? false,
        is_deleted: false,
        email: cleanEmail ? cleanEmail : null
      };

      const { data: createdProfile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .insert([profilePayload])
        .select("*")
        .single();

      if (profileErr) {
        console.error("Supabase Driver Profile Creation Error:", profileErr);
        return res.status(500).json({ error: profileErr.message });
      }

      return res.json({
        success: true,
        user: createdProfile
      });
    }

    const authEmail = cleanEmail || `${cleanPersonalId}@internal.driver`;
    const cleanPassword = (password && String(password).trim()) || "Georgia2026!";

    // Create user administratively in auth.users
    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: cleanPassword,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        name: cleanName,
        personal_id: cleanPersonalId,
        phone: cleanPhone,
        role: assignedRole,
        permissions: perms,
        privileges: perms,
        vendor_id,
      },
    });

    if (adminError || !adminData.user) {
      console.error("Supabase Admin Auth Error:", adminError);
      return res.status(500).json({ error: adminError?.message || "Failed to create user in Auth database" });
    }

    let profile = null;
    if (assignedRole !== "vendor") {
      const profilePayload: any = {
        id: adminData.user.id,
        name: cleanName,
        personal_id: cleanPersonalId,
        email: cleanEmail ? cleanEmail : null,
        phone: cleanPhone,
        role: assignedRole,
        permissions: perms,
        vendor_id: vendor_id || null,
        is_deleted: false,
        is_blocked: false,
      };

      const { data: savedProfile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" })
        .select()
        .maybeSingle();

      if (profileErr) {
        console.error("Profile upsert error:", profileErr);
        return res.status(500).json({ error: profileErr.message });
      }
      profile = savedProfile;
    }

    res.json({
      success: true,
      user: profile ? {
        ...profile,
        email: profile.email || ''
      } : {
        id: adminData.user.id,
        name: cleanName,
        personal_id: cleanPersonalId,
        email: cleanEmail || '',
        phone: cleanPhone,
        role: assignedRole,
        permissions: perms,
        privileges: perms,
        vendor_id,
        created_at: adminData.user.created_at,
      },
    });
  } catch (e: any) {
    console.error("Admin user creation caught exception:", e);
    let errMsg = "Internal server error";
    if (e instanceof Error) errMsg = e.message;
    else if (typeof e === "string") errMsg = e;
    else if (typeof e === "object") errMsg = JSON.stringify(e);
    res.status(500).json({ error: errMsg });
  }
});

// Endpoint to update user auth details administratively (e.g. auth email, password, metadata, profiles)
router.post("/api/update-user", async (req, res) => {
  try {
    if (!isSupabaseConfigured || !supabaseAdmin) {
      return res.status(400).json({ error: "Supabase service role key is not configured on the server." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization token is missing" });
    }

    const token = authHeader.split(" ")[1];
    const { data: { user: requestingUser }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !requestingUser) {
      return res.status(401).json({ error: "Unauthorized: Invalid session token" });
    }

    // Check if user is admin or modifying own profile or has permission
    let isRequesterAdmin = requestingUser.user_metadata?.role === "admin";
    if (!isRequesterAdmin) {
      const { data: requesterProfile } = await supabaseAdmin
        .from("profiles")
        .select("role, permissions")
        .eq("id", requestingUser.id)
        .maybeSingle();
      if (requesterProfile) {
        if (
          requesterProfile.role === "admin" || 
          requesterProfile.role === "purchasing_head" || 
          requesterProfile.permissions?.users?.includes("modify") ||
          requesterProfile.permissions?.users?.includes("add")
        ) {
          isRequesterAdmin = true;
        }
      }
    }

    if (!isRequesterAdmin && requestingUser.id !== req.body?.id) {
      return res.status(403).json({ error: "Access denied. Only users with administrative privileges are authorized." });
    }

    const { id, email, password, name, personal_id, phone, role, permissions, privileges, vendor_id, is_blocked } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing user ID for update" });
    }

    let assignedRole = role || "operator";
    if (assignedRole === "manager") {
      assignedRole = "purchasing_head";
    }

    const perms = permissions || privileges || (assignedRole === "admin" ? { all: ["view", "add", "modify", "delete"] } : {});
    const hasEmail = Boolean(email && String(email).trim());
    const cleanEmail = hasEmail ? formatAuthEmail(email) : '';

    const updatePayload: any = {
      user_metadata: {
        name: (name && String(name).trim()) || "",
        personal_id: (personal_id && String(personal_id).trim()) || "",
        phone: (phone && String(phone).trim()) || "",
        role: assignedRole,
        permissions: perms,
        privileges: perms,
        vendor_id: vendor_id || null,
      }
    };

    if (cleanEmail) {
      updatePayload.email = cleanEmail;
      updatePayload.email_confirm = true; // Auto-confirm email change immediately in auth.users
    }
    if (password && String(password).trim() !== "") {
      updatePayload.password = String(password).trim();
    }

    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.updateUserById(id, updatePayload);

    if (adminError) {
      console.warn("Supabase Admin Auth Update Warning:", adminError.message);
      if (adminError.message.toLowerCase().includes("user not found") && cleanEmail) {
        await supabaseAdmin.auth.admin.createUser({
          id,
          email: cleanEmail,
          password: (password && String(password).trim()) || "Georgia2026!",
          email_confirm: true,
          phone_confirm: true,
          user_metadata: updatePayload.user_metadata
        }).catch((err) => console.warn("Fallback createUser failed:", err));
      }
    }

    const profilePayload: any = {
      name: (name && String(name).trim()) || "",
      personal_id: (personal_id && String(personal_id).trim()) || "",
      phone: (phone && String(phone).trim()) || "",
      role: assignedRole,
      permissions: perms,
      vendor_id: vendor_id || null,
      is_blocked: is_blocked ?? false,
      email: cleanEmail ? cleanEmail : null
    };

    const { data: updatedProfile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update(profilePayload)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (profileErr) {
      console.error("Supabase Profile Update Error:", profileErr);
    }

    res.json({
      success: true,
      user: updatedProfile || {
        id,
        email: cleanEmail || email,
        name,
        personal_id,
        phone,
        role: assignedRole,
        permissions: perms,
        vendor_id,
        is_blocked: is_blocked ?? false
      }
    });
  } catch (e: any) {
    console.error("Admin user update caught exception:", e);
    let errMsg = "Internal server error";
    if (e instanceof Error) errMsg = e.message;
    else if (typeof e === "string") errMsg = e;
    else if (typeof e === "object") errMsg = JSON.stringify(e);
    res.status(500).json({ error: errMsg });
  }
});

// Endpoint to delete a user administratively
const handleDeleteUser = async (req: express.Request, res: express.Response) => {
  try {
    if (!isSupabaseConfigured || !supabaseAdmin) {
      return res.status(400).json({ error: "Supabase service role key is not configured on the server." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization token is missing" });
    }

    const token = authHeader.split(" ")[1];
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Unauthorized: Invalid session token" });
    }

    let isRequesterAdmin = user.user_metadata?.role === "admin";
    if (!isRequesterAdmin) {
      const { data: requesterProfile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (!profileErr && requesterProfile && requesterProfile.role === "admin") {
        isRequesterAdmin = true;
      }
    }

    if (!isRequesterAdmin) {
      return res.status(403).json({ error: "Access denied: Only Administrators can delete users." });
    }

    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Check if target user has admin role - ONLY admin users can delete admin users
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", id)
      .maybeSingle();

    if (targetProfile && targetProfile.role === "admin" && !isRequesterAdmin) {
      return res.status(403).json({ error: "ადმინისტრატორის როლის მქონე მომხმარებლის წაშლა შეუძლია მხოლოდ ადმინისტრატორს." });
    }

    // Delete from auth or ban user so they cannot login anymore
    await supabaseAdmin.auth.admin.deleteUser(id).catch(async (authErr: any) => {
      console.warn(`Auth delete fallback for ${id}:`, authErr?.message);
      await supabaseAdmin.auth.admin.updateUserById(id, {
        ban_duration: '876000h',
        user_metadata: { is_blocked: true, is_deleted: true }
      }).catch(() => {});
    });

    // Update both is_deleted AND is_blocked to true
    const { error: deleteError } = await supabaseAdmin
      .from("profiles")
      .update({ is_deleted: true, is_blocked: true })
      .eq("id", id);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    res.json({ success: true });
  } catch (e: any) {
    console.error("Admin user deletion failed:", e);
    res.status(500).json({ error: e.message || "Internal server error" });
  }
};

router.delete("/api/delete-user", handleDeleteUser);
router.post("/api/delete-user", handleDeleteUser);

// Proxy endpoint to read profiles bypassing RLS recursion
router.get("/api/profiles", async (req, res) => {
  try {
    if (!isSupabaseConfigured || !supabaseAdmin) {
      return res.status(400).json({ error: "Supabase service role key is not configured on the server." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization token is missing" });
    }

    const token = authHeader.split(" ")[1];
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Unauthorized: Invalid session token" });
    }

    const { email, is_deleted, id, limit, offset, search } = req.query;
    const isPaginated = limit !== undefined && offset !== undefined;
    let query = supabaseAdmin.from("profiles").select("*", isPaginated ? { count: "exact" } : {});

    if (email) {
      query = query.eq("email", email);
    }
    if (is_deleted !== undefined) {
      query = query.eq("is_deleted", is_deleted === "true");
    } else {
      query = query.eq("is_deleted", false);
    }
    if (id) {
      query = query.eq("id", id);
    }
    if (search && typeof search === "string" && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`name.ilike.${term},email.ilike.${term},personal_id.ilike.${term}`);
    }

    query = query.order("name", { ascending: true });

    if (isPaginated) {
      const lim = parseInt(limit as string, 10) || 12;
      const off = parseInt(offset as string, 10) || 0;
      query = query.range(off, off + lim - 1);
      const { data: profiles, count, error: queryErr } = await query;
      if (queryErr) {
        return res.status(500).json({ error: queryErr.message });
      }
      return res.json({ users: profiles || [], totalCount: count || 0 });
    }

    const { data: profiles, error: queryErr } = await query;

    if (queryErr) {
      return res.status(500).json({ error: queryErr.message });
    }

    res.json(profiles || []);
  } catch (e: any) {
    console.error("Fetch profiles via proxy failed:", e);
    res.status(500).json({ error: e.message || "Internal server error" });
  }
});

export default router;
