import { Request, Response } from "express";
import { supabaseAdmin, isSupabaseConfigured } from "./types";

export async function handleUserList(req: Request, res: Response) {
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
}
