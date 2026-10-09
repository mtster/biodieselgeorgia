import { Request, Response } from "express";
import crypto from "crypto";
import { supabaseAdmin, formatAuthEmail, cleanUserPhone } from "./types";
import { verifyUserManagementRequester } from "./userHelpers";

export async function handleCreateUser(req: Request, res: Response) {
  try {
    const verified = await verifyUserManagementRequester(req, res);
    if (!verified) return;

    if (!supabaseAdmin) {
      return res.status(400).json({ error: "Supabase service role key is not configured on the server." });
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
        app_metadata: {
          role: assignedRole,
          permissions: perms,
          privileges: perms
        },
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
            app_metadata: updatePayload.app_metadata,
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
        warehouse_id: warehouse_id || null,
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
    const cleanPhone = cleanUserPhone(phone);

    // Drivers and Driver Assistants DO NOT need auth users created
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
      app_metadata: {
        role: assignedRole,
        permissions: perms,
        privileges: perms
      },
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
        email: cleanEmail ? cleanEmail : null,
        personal_id: cleanPersonalId,
        phone: cleanPhone,
        role: assignedRole,
        permissions: perms,
        privileges: perms,
        warehouse_id: warehouse_id || null,
        vendor_id: vendor_id || null,
        is_blocked: is_blocked ?? false,
        is_deleted: false
      };

      const { data: profileData, error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert([profilePayload])
        .select("*")
        .single();

      if (profileError) {
        console.error("Supabase Profile Insert Error:", profileError);
      } else {
        profile = profileData;
      }
    }

    res.json({
      success: true,
      user: profile || {
        id: adminData.user.id,
        email: cleanEmail,
        name: cleanName,
        personal_id: cleanPersonalId,
        phone: cleanPhone,
        role: assignedRole,
        permissions: perms,
        vendor_id,
        is_blocked: is_blocked ?? false
      }
    });
  } catch (e: any) {
    console.error("Admin user create caught exception:", e);
    res.status(500).json({ error: e.message || "Internal server error" });
  }
}
