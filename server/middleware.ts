import express from "express";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAdmin, isSupabaseConfigured } from "./config";

export interface AuthenticatedRequest extends express.Request {
  sessionUser?: any;
}

export async function authenticateToken(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return res.status(400).json({ error: "Supabase service role key is not configured on the server." });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization token is missing" });
  }

  const token = authHeader.split(" ")[1];
  const tempClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || "");
  const { data: { user }, error: userError } = await tempClient.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({ error: "Unauthorized: Invalid session token" });
  }

  req.sessionUser = user;
  next();
}
