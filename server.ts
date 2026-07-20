import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const port = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const isSupabaseConfigured = supabaseUrl !== "" && supabaseServiceKey !== "";

  // Dedicated admin client
  const supabaseAdmin = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

  // Endpoint to create a user administratively
  app.post("/api/create-user", async (req, res) => {
    try {
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

      // Check if user is admin
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
        return res.status(403).json({ error: "Access denied: Only Administrators can create users." });
      }

      const { email, password, name, personal_id, phone, role, permissions, privileges, warehouse_id, vendor_id } = req.body;
      const perms = permissions || privileges || {};

      if (!email || !password || !name || !personal_id || !phone || !role) {
        return res.status(400).json({ error: "All required fields (email, password, name, personal_id, phone, role) must be provided." });
      }

      // Create user administratively
      const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          name,
          personal_id,
          phone,
          role,
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
      if (role !== "vendor") {
        const { data: fetchedProfile } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("id", adminData.user.id)
          .maybeSingle();
        profile = fetchedProfile;
      }

      res.json({
        success: true,
        user: profile || {
          id: adminData.user.id,
          name,
          personal_id,
          email,
          phone,
          role,
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

  // Endpoint to delete a user administratively
  app.delete("/api/delete-user", async (req, res) => {
    try {
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

      const { error: deleteError } = await supabaseAdmin
        .from("profiles")
        .update({ is_deleted: true })
        .eq("id", id);
      if (deleteError) {
        return res.status(500).json({ error: deleteError.message });
      }

      res.json({ success: true });
    } catch (e: any) {
      console.error("Admin user deletion failed:", e);
      res.status(500).json({ error: e.message || "Internal server error" });
    }
  });

  // Proxy endpoint to read profiles bypassing RLS recursion
  app.get("/api/profiles", async (req, res) => {
    try {
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

      const { email, is_deleted, id } = req.query;
      let query = supabaseAdmin.from("profiles").select("*");

      if (email) {
        query = query.eq("email", email);
      }
      if (is_deleted !== undefined) {
        query = query.eq("is_deleted", is_deleted === "true");
      }
      if (id) {
        query = query.eq("id", id);
      }

      const { data: profiles, error: queryErr } = await query.order("name");

      if (queryErr) {
        return res.status(500).json({ error: queryErr.message });
      }

      res.json(profiles || []);
    } catch (e: any) {
      console.error("Fetch profiles via proxy failed:", e);
      res.status(500).json({ error: e.message || "Internal server error" });
    }
  });

  // Serve static assets and frontend index
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

startServer();
