import { Request, Response } from "express";
import { supabaseAdmin, isSupabaseConfigured } from "./types";

export async function verifyUserManagementRequester(req: Request, res: Response): Promise<{ user: any; profile: any } | null> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    res.status(400).json({ error: "Supabase service role key is not configured on the server." });
    return null;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization token is missing" });
    return null;
  }

  const token = authHeader.split(" ")[1];
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    res.status(401).json({ error: "Unauthorized: Invalid session token" });
    return null;
  }

  // Check if requester is authorized (admin or user management permissions)
  let isRequesterAuthorized = user.app_metadata?.role === "admin" || user.user_metadata?.role === "admin";
  let requesterProfile: any = null;

  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("role, permissions")
    .eq("id", user.id)
    .maybeSingle();

  requesterProfile = prof;

  if (!isRequesterAuthorized) {
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
    res.status(403).json({ error: "Access denied: Only Administrators or authorized managers can create/modify users." });
    return null;
  }

  return { user, profile: requesterProfile };
}
