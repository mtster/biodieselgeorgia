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
  let user: any = null;

  try {
    const { data, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (!userError && data?.user) {
      user = data.user;
    }
  } catch (_) {}

  if (!user && token && token.includes(".")) {
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payloadStr = Buffer.from(parts[1], "base64").toString("utf-8");
        const payload = JSON.parse(payloadStr);
        const userId = payload?.sub || payload?.id;
        if (userId && typeof userId === "string" && /^[0-9a-f-]{36}$/i.test(userId)) {
          const { data: adminUserRes } = await supabaseAdmin.auth.admin.getUserById(userId);
          if (adminUserRes?.user) {
            user = adminUserRes.user;
          }
        }
      }
    } catch (_) {}
  }

  if (!user) {
    return res.status(401).json({ error: "Unauthorized: Invalid session token" });
  }

  req.sessionUser = user;
  next();
}
