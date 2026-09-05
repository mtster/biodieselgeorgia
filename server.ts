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

  // Helper to sanitize email with @biodiesel.ge fallback
  const formatAuthEmail = (rawEmail?: string, fallbackId?: string): string => {
    let clean = (rawEmail && String(rawEmail).trim()) || '';
    if (!clean && fallbackId) {
      clean = `${fallbackId}@biodiesel.ge`;
    }
    if (clean && !clean.includes('@')) {
      clean = `${clean}@biodiesel.ge`;
    }
    return clean;
  };

  // Endpoint to create a user administratively (or update if id/action provided)
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
        const cleanEmail = email ? formatAuthEmail(email) : undefined;
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
          is_blocked: is_blocked ?? false
        };
        if (cleanEmail) {
          profilePayload.email = cleanEmail;
        }

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
      }

      // Action is CREATE
      const cleanPersonalId = (personal_id && String(personal_id).trim()) || `12${Math.floor(100000000 + Math.random() * 900000000)}`;
      const cleanEmail = formatAuthEmail(email, cleanPersonalId);
      const cleanPassword = (password && String(password).trim()) || "Georgia2026!";
      const cleanName = (name && String(name).trim()) || "New User";
      const cleanPhone = (phone && String(phone).trim()) || "+995 599 00 00 00";

      // Create user administratively in auth.users
      const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
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
        const profilePayload = {
          id: adminData.user.id,
          name: cleanName,
          personal_id: cleanPersonalId,
          email: cleanEmail,
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
        user: profile || {
          id: adminData.user.id,
          name: cleanName,
          personal_id: cleanPersonalId,
          email: cleanEmail,
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
  app.post("/api/update-user", async (req, res) => {
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
      const { data: { user: requestingUser }, error: userError } = await tempClient.auth.getUser(token);

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
      const cleanEmail = email ? formatAuthEmail(email) : undefined;

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
        is_blocked: is_blocked ?? false
      };
      if (cleanEmail) {
        profilePayload.email = cleanEmail;
      }

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

  // Endpoint to create or update a vehicle auth account administratively
  app.post("/api/create-vehicle-account", async (req, res) => {
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
        const { data: requesterProfile } = await supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (requesterProfile && requesterProfile.role === "admin") {
          isRequesterAdmin = true;
        }
      }

      if (!isRequesterAdmin) {
        return res.status(403).json({ error: "Access denied: Only Administrators can create vehicle accounts." });
      }

      const { plate_number, password } = req.body;
      if (!plate_number || !password) {
        return res.status(400).json({ error: "License plate number and password must be provided." });
      }

      const sanitizedPlate = plate_number.replace(/-/g, "").toLowerCase();
      const email = `${sanitizedPlate}@biodiesel.ge`;

      const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          role: "driver",
          vehicle_role: "vehicle",
          plate_number,
          name: `Vehicle ${plate_number}`
        },
      });

      if (adminError) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = listData?.users?.find((u) => u.email === email);
        if (existing) {
          const { data: updateData, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password,
            user_metadata: {
              role: "driver",
              vehicle_role: "vehicle",
              plate_number,
              name: `Vehicle ${plate_number}`
            },
          });
          if (updateErr) {
            return res.status(500).json({ error: updateErr.message });
          }
          return res.json({ success: true, auth_user_id: existing.id });
        }
        return res.status(500).json({ error: adminError.message });
      }

      return res.json({ success: true, auth_user_id: adminData.user.id });
    } catch (e: any) {
      console.error("Admin vehicle account creation caught exception:", e);
      let errMsg = "Internal server error";
      if (e instanceof Error) errMsg = e.message;
      res.status(500).json({ error: errMsg });
    }
  });

  // Endpoint to delete a user administratively (supports both POST and DELETE)
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

  app.delete("/api/delete-user", handleDeleteUser);
  app.post("/api/delete-user", handleDeleteUser);

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

  // Dedicated endpoint for Excel batch row Gemini parsing
  app.post("/api/import-excel", async (req, res) => {
    try {
      const { rows } = req.body;
      if (!rows || !Array.isArray(rows)) {
        return res.status(400).json({ error: "No rows provided or invalid format." });
      }

      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not set." });
      }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const promptText = `
You are an expert data parser. Parse the following messy company contact rows from a Georgian Excel sheet.
For each row object:
1. Parse the "contact_cell" (კონტაქტი) and "accountant_cell" (ბუღალტერის საკონტაქტო) into clean Vendor Contacts array.
   Each contact MUST have:
   - "name": Clean Georgian name. Clean out parenthetical names or comments.
   - "phone": Structured phone numbers (e.g. 595xxxxxx or similar mobile/direct lines, containing only digits, or nicely structured space/dashes). Clean extraneous chars.
   - "position": One of "accountant", "director", "operator", "other".
   - "note": Notes about this specific person.
   - "is_default": Boolean. True for the FIRST contact or principal contact found, false for others.
2. Parse the comments and date-related logs from "comment_cell", "last_pickup_cell", "contact_time_cell", "may_comments_cell", and "april_comments_cell" into clean Comments array of objects.
   Each comment MUST have:
   - "comment": The clean Georgian text comment.
   - "date": Date in "YYYY-MM-DD" format.
   - "user_name": "System Import"

Return a structured JSON array with one object for each input string matching the "row_id".

Input Rows:
${JSON.stringify(rows, null, 2)}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                row_id: { type: Type.STRING },
                contacts: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      phone: { type: Type.STRING },
                      position: { type: Type.STRING },
                      note: { type: Type.STRING },
                      is_default: { type: Type.BOOLEAN }
                    },
                    required: ["name", "phone", "position", "is_default"]
                  }
                },
                comments: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      comment: { type: Type.STRING },
                      date: { type: Type.STRING },
                      user_name: { type: Type.STRING }
                    },
                    required: ["comment", "date", "user_name"]
                  }
                }
              },
              required: ["row_id", "contacts", "comments"]
            }
          }
        }
      });

      const parsedData = JSON.parse(response.text || "[]");
      res.json({ success: true, data: parsedData });
    } catch (e: any) {
      console.error("Gemini batch parse server error:", e);
      res.status(500).json({ error: e.message || "Failed to process rows using Gemini" });
    }
  });

  // Endpoint to run / test scheduled order generation
  app.all("/api/cron/scheduled-orders", async (req, res) => {
    try {
      if (!isSupabaseConfigured || !supabaseAdmin) {
        return res.status(500).json({ error: "Supabase service role key is not configured on the server." });
      }

      // Check authorization (Bearer token or SERVICE_ROLE_KEY or internal header)
      const authHeader = req.headers.authorization;
      const cronSecret = req.headers['x-cron-secret'];
      let isAuthorized = false;

      if (process.env.SERVICE_ROLE_KEY && authHeader?.includes(process.env.SERVICE_ROLE_KEY)) {
        isAuthorized = true;
      } else if (cronSecret && cronSecret === process.env.SERVICE_ROLE_KEY) {
        isAuthorized = true;
      } else if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const tempClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || "");
        const { data: { user }, error: authErr } = await tempClient.auth.getUser(token);
        if (!authErr && user) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          if (profile && (profile.role === "admin" || profile.role === "purchasing_head")) {
            isAuthorized = true;
          }
        }
      }

      if (!isAuthorized) {
        return res.status(401).json({ error: "Unauthorized access" });
      }

      // Determine tomorrow in Tbilisi time (UTC+4)
      const options = {
        timeZone: 'Asia/Tbilisi',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      } as const;

      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(new Date());

      const yearPart = parts.find(p => p.type === 'year')?.value;
      const monthPart = parts.find(p => p.type === 'month')?.value;
      const dayPart = parts.find(p => p.type === 'day')?.value;

      if (!yearPart || !monthPart || !dayPart) {
        return res.status(500).json({ error: "Could not parse Tbilisi time" });
      }

      const tbilisiDate = new Date(parseInt(yearPart), parseInt(monthPart) - 1, parseInt(dayPart), 12, 0, 0);
      const tomorrowDate = new Date(tbilisiDate);
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);

      const tomorrowDayIndex = tomorrowDate.getDay();
      const weekdaysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetWeekday = weekdaysMap[tomorrowDayIndex];

      const { data: vendors, error: selectError } = await supabaseAdmin
        .from('vendors')
        .select('id, company_name, trade_name, warehouse_id, frequency_weeks, tanks_to_bring, tanks_to_leave')
        .eq('is_deleted', false)
        .eq('is_planned', true)
        .eq('planned_weekday', targetWeekday);

      if (selectError) {
        return res.status(500).json({ error: selectError.message });
      }

      if (!vendors || vendors.length === 0) {
        return res.json({
          success: true,
          message: `No scheduled suppliers found for target weekday: ${targetWeekday} (tomorrow).`,
          weekdayChecked: targetWeekday,
          ordersCreated: 0
        });
      }

      const vendorIds = vendors.map(v => v.id);

      // Fetch contacts to get main contact (is_default)
      const { data: contacts } = await supabaseAdmin
        .from('vendor_contacts')
        .select('id, vendor_id, is_default, sort_order')
        .in('vendor_id', vendorIds)
        .eq('is_deleted', false)
        .order('sort_order', { ascending: false });

      const mainContactMap: Record<string, string> = {};
      if (contacts && contacts.length > 0) {
        for (const c of contacts) {
          if (!mainContactMap[c.vendor_id] || c.is_default) {
            mainContactMap[c.vendor_id] = c.id;
          }
        }
      }

      // Fetch existing orders to check frequency_weeks and prevent duplicates
      const { data: existingOrders } = await supabaseAdmin
        .from('orders')
        .select('id, vendor_id, order_date')
        .in('vendor_id', vendorIds)
        .eq('is_deleted', false)
        .order('order_date', { ascending: false });

      const latestOrderMap: Record<string, Date> = {};
      const existingTomorrowOrders = new Set<string>();
      const tomorrowYMD = tomorrowDate.toISOString().split('T')[0];

      if (existingOrders && existingOrders.length > 0) {
        for (const ord of existingOrders) {
          if (!ord.order_date) continue;
          const ordDateStr = ord.order_date.split('T')[0];
          if (ordDateStr === tomorrowYMD) {
            existingTomorrowOrders.add(ord.vendor_id);
          }
          if (!latestOrderMap[ord.vendor_id]) {
            latestOrderMap[ord.vendor_id] = new Date(ord.order_date);
          }
        }
      }

      const eligibleVendors = vendors.filter(vendor => {
        if (existingTomorrowOrders.has(vendor.id)) {
          return false;
        }

        const freq = Math.max(1, Number(vendor.frequency_weeks) || 1);
        const lastOrderDate = latestOrderMap[vendor.id];

        if (!lastOrderDate) return true;
        if (freq <= 1) return true;

        const diffMs = tomorrowDate.getTime() - lastOrderDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const minDaysRequired = (freq * 7) - 3;
        return diffDays >= minDaysRequired;
      });

      if (eligibleVendors.length === 0) {
        return res.json({
          success: true,
          message: `All scheduled suppliers for ${targetWeekday} were already created or not due based on their weekly frequency.`,
          weekdayChecked: targetWeekday,
          ordersCreated: 0
        });
      }

      const insertedOrders = [];
      const BATCH_SIZE = 100;
      for (let i = 0; i < eligibleVendors.length; i += BATCH_SIZE) {
        const batchVendors = eligibleVendors.slice(i, i + BATCH_SIZE);
        const batchOrders = batchVendors.map(vendor => {
          const orderId = 'ord_' + Math.random().toString(36).substring(2, 14);
          const randomSuffix = Math.floor(100000 + Math.random() * 900000);
          const docNumber = `AUTO-${tomorrowDate.toISOString().split('T')[0].replace(/-/g, '')}-${randomSuffix}`;

          return {
            id: orderId,
            order_date: tomorrowDate.toISOString(),
            doc_number: docNumber,
            vendor_id: vendor.id,
            warehouse_id: vendor.warehouse_id || null,
            contact_id: mainContactMap[vendor.id] || null,
            qty_requested: 0,
            tanks_to_leave: Number(vendor.tanks_to_leave) || 0,
            tanks_to_bring: Number(vendor.tanks_to_bring) || 0,
            status: 'registered',
            note: `Automated scheduled order for ${vendor.trade_name || vendor.company_name}`
          };
        });

        const { data, error: insertError } = await supabaseAdmin
          .from('orders')
          .insert(batchOrders)
          .select('id, doc_number');

        if (insertError) {
          return res.status(500).json({ error: insertError.message });
        }
        if (data) {
          insertedOrders.push(...data);
        }
      }

      res.json({
        success: true,
        message: `Successfully generated automated orders for ${targetWeekday}.`,
        weekdayChecked: targetWeekday,
        ordersCreated: insertedOrders.length,
        orders: insertedOrders
      });
    } catch (e: any) {
      console.error("Scheduled orders error:", e);
      res.status(500).json({ error: e.message || "Internal server error" });
    }
  });

  // Overdue vendors report endpoint using LEFT JOIN LATERAL
  app.get("/api/reports/overdue-vendors", async (req, res) => {
    try {
      if (!isSupabaseConfigured || !supabaseAdmin) {
        return res.status(500).json({ error: "Supabase service role is not configured" });
      }

      // First attempt PostgreSQL RPC function get_overdue_vendors()
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("get_overdue_vendors");
      if (!rpcError && rpcData) {
        return res.json({ success: true, data: rpcData });
      }

      // Second attempt view overdue_vendors_view
      const { data: viewData, error: viewError } = await supabaseAdmin
        .from("overdue_vendors_view")
        .select("*")
        .order("overdue_days", { ascending: false });

      if (!viewError && viewData) {
        return res.json({ success: true, data: viewData });
      }

      // Fallback: Query active vendors and newest orders
      const { data: vendors, error: vErr } = await supabaseAdmin
        .from("vendors")
        .select("id, id_code, company_name, trade_name, city, district, manager_id, is_active, overdue_threshold_days, created_at")
        .eq("is_deleted", false)
        .eq("is_active", true);

      if (vErr) {
        return res.status(500).json({ error: vErr.message });
      }

      const { data: orders, error: oErr } = await supabaseAdmin
        .from("orders")
        .select("vendor_id, order_date")
        .eq("is_deleted", false)
        .eq("status", "completed")
        .order("order_date", { ascending: false });

      if (oErr) {
        return res.status(500).json({ error: oErr.message });
      }

      const latestOrderMap: Record<string, string> = {};
      for (const ord of orders || []) {
        if (ord.vendor_id && !latestOrderMap[ord.vendor_id] && ord.order_date) {
          latestOrderMap[ord.vendor_id] = ord.order_date;
        }
      }

      const now = new Date();
      const results = [];

      for (const v of vendors || []) {
        const lastOrderDateStr = latestOrderMap[v.id];
        if (lastOrderDateStr) {
          const threshold = v.overdue_threshold_days;
          if (threshold !== null && threshold !== undefined && threshold > 0) {
            const diffDays = Math.floor((now.getTime() - new Date(lastOrderDateStr).getTime()) / (1000 * 60 * 60 * 24));
            const overdueDays = diffDays - threshold;
            if (overdueDays > 0) {
              results.push({
                ...v,
                status: 'Active',
                last_order_date: lastOrderDateStr,
                days_ago: diffDays,
                overdue_days: overdueDays
              });
            }
          }
        } else {
          // No orders placed: check if 30 days have passed since created_at
          const createdTime = v.created_at ? new Date(v.created_at).getTime() : now.getTime();
          const daysSinceCreation = Math.floor((now.getTime() - createdTime) / (1000 * 60 * 60 * 24));
          if (daysSinceCreation > 30) {
            const overdueDays = daysSinceCreation - 30;
            results.push({
              ...v,
              status: 'Active',
              last_order_date: null,
              days_ago: daysSinceCreation,
              overdue_days: overdueDays
            });
          }
        }
      }

      results.sort((a, b) => b.overdue_days - a.overdue_days);
      res.json({ success: true, data: results });
    } catch (err: any) {
      console.error("Overdue vendors error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
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
