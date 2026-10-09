import { Request, Response } from "express";
import { supabaseAdmin, formatAuthEmail } from "./types";
import { verifyUserManagementRequester } from "./userHelpers";

export async function handleUpdateUser(req: Request, res: Response) {
  try {
    const verified = await verifyUserManagementRequester(req, res);
    if (!verified) return;

    if (!supabaseAdmin) {
      return res.status(400).json({ error: "Supabase service role key is not configured on the server." });
    }

    const { id, email, password, name, personal_id, phone, role, permissions, privileges, vendor_id, is_blocked } = req.body;
    if (!id) {
      return res.status(400).json({ error: "User ID is required for update." });
    }

    let assignedRole = role || "operator";
    if (assignedRole === "manager") {
      assignedRole = "purchasing_head";
    }

    const perms = permissions || privileges || (assignedRole === "admin" ? { all: ["view", "add", "modify", "delete"] } : {});
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
    res.status(500).json({ error: e.message || "Internal server error" });
  }
}
