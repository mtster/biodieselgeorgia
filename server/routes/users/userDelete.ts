import { Request, Response } from "express";
import { supabaseAdmin, isSupabaseConfigured } from "./types";

export async function handleDeleteUser(req: Request, res: Response) {
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

    let isRequesterAdmin = user.app_metadata?.role === "admin" || user.user_metadata?.role === "admin";
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
}
