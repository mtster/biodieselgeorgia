import express from "express";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAdmin, isSupabaseConfigured } from "../config";
import { authenticateToken, AuthenticatedRequest } from "../middleware";

const router = express.Router();

export async function handleVehicleAccountCreation(req: express.Request, res: express.Response) {
  try {
    if (!isSupabaseConfigured || !supabaseAdmin) {
      return res.status(400).json({ error: "Supabase service role key is not configured on the server." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization token is missing" });
    }

    const token = authHeader.split(" ")[1];
    let user: any = null;

    // 1. Verify token directly with Supabase Auth
    try {
      const { data, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (!userError && data?.user) {
        user = data.user;
      }
    } catch (_) {}

    // 2. Fallback: Parse JWT claims and verify existence via elevated Admin API
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

    const userRole = user.app_metadata?.role || user.user_metadata?.role;
    const userPerms = user.app_metadata?.permissions || user.user_metadata?.permissions || {};
    const userPrivs = user.app_metadata?.privileges || user.user_metadata?.privileges || {};

    const authorizedRoles = ["admin", "purchasing_head", "purchasing_manager", "logistics_manager", "manager", "operator"];
    let isRequesterAuthorized = authorizedRoles.includes(userRole) ||
      userPerms.vehicles?.includes("add") ||
      userPerms.vehicles?.includes("modify") ||
      userPerms.vehicles?.includes("view") ||
      userPrivs.vehicles?.includes("add") ||
      userPrivs.vehicles?.includes("modify") ||
      userPrivs.vehicles?.includes("view") ||
      userPerms.users?.includes("add") ||
      userPerms.users?.includes("modify");

    if (!isRequesterAuthorized) {
      const { data: requesterProfile } = await supabaseAdmin
        .from("profiles")
        .select("role, permissions, privileges")
        .eq("id", user.id)
        .maybeSingle();
      if (
        requesterProfile &&
        (authorizedRoles.includes(requesterProfile.role) ||
         (Array.isArray(requesterProfile.permissions?.vehicles) && requesterProfile.permissions.vehicles.length > 0) ||
         (Array.isArray(requesterProfile.privileges?.vehicles) && requesterProfile.privileges.vehicles.length > 0) ||
         requesterProfile.permissions?.users?.includes("add") ||
         requesterProfile.permissions?.users?.includes("modify"))
      ) {
        isRequesterAuthorized = true;
      }
    }

    if (!isRequesterAuthorized) {
      return res.status(403).json({ error: "Access denied: Only Administrators or authorized managers can manage vehicle accounts." });
    }

    const { plate_number, password, auth_user_id, original_plate_number, vehicle_id } = req.body;
    if (!plate_number || !String(plate_number).trim()) {
      return res.status(400).json({ error: "License plate number must be provided." });
    }

    const cleanPlate = String(plate_number).trim().toUpperCase();
    const sanitizedPlate = cleanPlate.replace(/-/g, "").toLowerCase();
    const newEmail = `${sanitizedPlate}@biodiesel.ge`;

    let existingUser: any = null;

    // 1. If auth_user_id is provided, check by ID first
    if (auth_user_id && typeof auth_user_id === "string" && /^[0-9a-f-]{36}$/i.test(auth_user_id)) {
      try {
        const { data: uData, error: uErr } = await supabaseAdmin.auth.admin.getUserById(auth_user_id);
        if (!uErr && uData?.user) {
          existingUser = uData.user;
        }
      } catch (_) {}
    }

    // 2. Look up database vehicles table to see if vehicle already had an auth_user_id
    if (!existingUser) {
      try {
        const queryPlates = [cleanPlate];
        if (original_plate_number && String(original_plate_number).trim()) {
          queryPlates.push(String(original_plate_number).trim().toUpperCase());
        }
        let vQuery = supabaseAdmin.from("vehicles").select("auth_user_id").in("plate_number", queryPlates);
        if (vehicle_id && /^[0-9a-f-]{36}$/i.test(vehicle_id)) {
          vQuery = supabaseAdmin.from("vehicles").select("auth_user_id").or(`id.eq.${vehicle_id},plate_number.in.(${queryPlates.join(",")})`);
        }
        const { data: vRows } = await vQuery;
        const foundAuthId = vRows?.find(r => r.auth_user_id)?.auth_user_id;
        if (foundAuthId) {
          const { data: uData } = await supabaseAdmin.auth.admin.getUserById(foundAuthId);
          if (uData?.user) {
            existingUser = uData.user;
          }
        }
      } catch (_) {}
    }

    // 3. Look up by old plate email or metadata
    if (!existingUser && original_plate_number && String(original_plate_number).trim()) {
      const oldClean = String(original_plate_number).trim().replace(/-/g, "").toLowerCase();
      const oldEmail = `${oldClean}@biodiesel.ge`;
      const oldPlateFormatted = String(original_plate_number).trim().toUpperCase();
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        existingUser = listData?.users?.find((u) => 
          u.email?.toLowerCase() === oldEmail.toLowerCase() ||
          u.email?.replace(/-/g, "").toLowerCase() === oldEmail.toLowerCase() ||
          u.user_metadata?.plate_number?.replace(/-/g, "").toUpperCase() === oldClean.toUpperCase() ||
          u.user_metadata?.plate_number === oldPlateFormatted
        ) || null;
      } catch (_) {}
    }

    // 4. Check if a user with newEmail or cleanPlate exists
    if (!existingUser) {
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        existingUser = listData?.users?.find((u) => 
          u.email?.toLowerCase() === newEmail.toLowerCase() ||
          u.email?.replace(/-/g, "").toLowerCase() === newEmail.toLowerCase() ||
          u.email?.toLowerCase() === `${cleanPlate.toLowerCase()}@biodiesel.ge` ||
          u.user_metadata?.plate_number?.replace(/-/g, "").toUpperCase() === sanitizedPlate.toUpperCase() ||
          u.user_metadata?.plate_number === cleanPlate
        ) || null;
      } catch (_) {}
    }

    // IF EXISTING USER WAS FOUND -> RENAME / UPDATE IN PLACE (PREVENTS GHOST REDUNDANT USERS)
    if (existingUser) {
      if (existingUser.email?.toLowerCase() !== newEmail.toLowerCase()) {
        try {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
          const conflictingUsers = listData?.users?.filter(
            (u) => (u.email?.toLowerCase() === newEmail.toLowerCase() ||
                   (original_plate_number && u.user_metadata?.plate_number === original_plate_number)) &&
                   u.id !== existingUser.id
          ) || [];
          for (const conf of conflictingUsers) {
            await supabaseAdmin.auth.admin.deleteUser(conf.id).catch(() => {});
          }
        } catch (e) {
          console.warn("Conflicting vehicle user cleanup warning:", e);
        }
      }

      const updatePayload: any = {
        email: newEmail,
        email_confirm: true,
        app_metadata: {
          ...existingUser.app_metadata,
          role: "driver",
          vehicle_role: "vehicle"
        },
        user_metadata: {
          ...existingUser.user_metadata,
          role: "driver",
          vehicle_role: "vehicle",
          plate_number: cleanPlate,
          name: `Vehicle ${cleanPlate}`
        }
      };

      if (password && String(password).trim().length >= 6) {
        updatePayload.password = String(password).trim();
      }

      const { data: updateData, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        updatePayload
      );

      if (updateErr) {
        console.error("Failed to update vehicle auth user:", updateErr);
        return res.status(500).json({ error: updateErr.message });
      }

      // ALSO UPDATE VEHICLES TABLE DIRECTLY IN DATABASE SO IT STAYS IN PERFECT SYNC
      try {
        const vUpdatePayload: any = {
          plate_number: cleanPlate,
          auth_user_id: existingUser.id,
          is_deleted: false
        };
        if (req.body.model) vUpdatePayload.model = req.body.model;
        if (req.body.driver_id !== undefined) vUpdatePayload.driver_id = req.body.driver_id || null;
        if (req.body.companion_id !== undefined) vUpdatePayload.companion_id = req.body.companion_id || null;
        if (req.body.city !== undefined) vUpdatePayload.city = req.body.city || null;
        if (req.body.warehouse_id !== undefined) vUpdatePayload.warehouse_id = req.body.warehouse_id || null;
        if (req.body.direction_id !== undefined) vUpdatePayload.direction_id = req.body.direction_id || null;

        if (vehicle_id && /^[0-9a-f-]{36}$/i.test(vehicle_id)) {
          await supabaseAdmin.from("vehicles").update(vUpdatePayload).eq("id", vehicle_id);
        } else if (original_plate_number) {
          await supabaseAdmin.from("vehicles").update(vUpdatePayload).eq("plate_number", original_plate_number);
        } else {
          await supabaseAdmin.from("vehicles").update(vUpdatePayload).eq("auth_user_id", existingUser.id);
        }
      } catch (dbErr) {
        console.warn("Failed to update vehicles table during account sync:", dbErr);
      }

      return res.json({
        success: true,
        auth_user_id: existingUser.id,
        email: newEmail,
        action: "updated"
      });
    }

    // BRAND NEW VEHICLE -> CREATE NEW AUTH USER
    // Require password explicitly inputted by user (min. 6 symbols) - NO default fallback
    if (!password || String(password).trim().length < 6) {
      return res.status(400).json({ error: "Password (min. 6 symbols) is required to create a new vehicle account." });
    }

    try {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const conflicting = listData?.users?.find(
        (u) => u.email?.toLowerCase() === newEmail.toLowerCase()
      );
      if (conflicting) {
        await supabaseAdmin.auth.admin.deleteUser(conflicting.id).catch(() => {});
      }
    } catch (_) {}

    const effectivePassword = String(password).trim();

    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: newEmail,
      password: effectivePassword,
      email_confirm: true,
      phone_confirm: true,
      app_metadata: {
        role: "driver",
        vehicle_role: "vehicle"
      },
      user_metadata: {
        role: "driver",
        vehicle_role: "vehicle",
        plate_number: cleanPlate,
        name: `Vehicle ${cleanPlate}`
      },
    });

    if (adminError || !adminData?.user) {
      return res.status(500).json({ error: adminError?.message || "Failed to create vehicle account" });
    }

    // Link newly created auth_user_id into vehicles table directly
    try {
      const vPayload: any = {
        plate_number: cleanPlate,
        auth_user_id: adminData.user.id,
        is_deleted: false
      };
      if (req.body.model) vPayload.model = req.body.model;
      if (req.body.driver_id !== undefined) vPayload.driver_id = req.body.driver_id || null;
      if (req.body.companion_id !== undefined) vPayload.companion_id = req.body.companion_id || null;
      if (req.body.city !== undefined) vPayload.city = req.body.city || null;
      if (req.body.warehouse_id !== undefined) vPayload.warehouse_id = req.body.warehouse_id || null;
      if (req.body.direction_id !== undefined) vPayload.direction_id = req.body.direction_id || null;

      if (vehicle_id && /^[0-9a-f-]{36}$/i.test(vehicle_id)) {
        await supabaseAdmin.from("vehicles").update(vPayload).eq("id", vehicle_id);
      } else {
        await supabaseAdmin.from("vehicles").upsert([vPayload], { onConflict: "plate_number" });
      }
    } catch (_) {}

    return res.json({
      success: true,
      auth_user_id: adminData.user.id,
      email: newEmail,
      action: "created"
    });
  } catch (e: any) {
    console.error("Vehicle account caught exception:", e);
    let errMsg = "Internal server error";
    if (e instanceof Error) errMsg = e.message;
    res.status(500).json({ error: errMsg });
  }
}

router.post(["/api/create-vehicle-account", "/create-vehicle-account"], handleVehicleAccountCreation);

router.post(["/api/delete-vehicle-account", "/delete-vehicle-account"], async (req, res) => {
  try {
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

    const delUserRole = user.app_metadata?.role || user.user_metadata?.role;
    const delUserPerms = user.app_metadata?.permissions || user.user_metadata?.permissions || {};
    const delAuthorizedRoles = ["admin", "purchasing_head", "purchasing_manager", "logistics_manager", "manager"];
    let isDelAuthorized = delAuthorizedRoles.includes(delUserRole) ||
      delUserPerms.vehicles?.includes("delete") ||
      delUserPerms.vehicles?.includes("modify");

    if (!isDelAuthorized) {
      const { data: requesterProfile } = await supabaseAdmin
        .from("profiles")
        .select("role, permissions")
        .eq("id", user.id)
        .maybeSingle();
      if (
        requesterProfile &&
        (delAuthorizedRoles.includes(requesterProfile.role) ||
         requesterProfile.permissions?.vehicles?.includes("delete") ||
         requesterProfile.permissions?.vehicles?.includes("modify"))
      ) {
        isDelAuthorized = true;
      }
    }

    if (!isDelAuthorized) {
      return res.status(403).json({ error: "Access denied: Only Administrators or authorized managers can delete vehicle accounts." });
    }

    const { auth_user_id, plate_number } = req.body;
    let targetUserId = auth_user_id;

    if (!targetUserId && plate_number) {
      const clean = String(plate_number).trim().replace(/-/g, "").toLowerCase();
      const email = `${clean}@biodiesel.ge`;
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (existing) {
        targetUserId = existing.id;
      }
    }

    if (targetUserId) {
      await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    }

    return res.json({ success: true });
  } catch (e: any) {
    console.warn("Delete vehicle account caught exception:", e);
    res.status(500).json({ error: e.message || "Failed to delete vehicle account" });
  }
});

export default router;
