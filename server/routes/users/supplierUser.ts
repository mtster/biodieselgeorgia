import { Request, Response } from "express";
import { supabaseAdmin, formatAuthEmail } from "./types";
import { verifyUserManagementRequester } from "./userHelpers";

export async function handleSupplierUser(req: Request, res: Response) {
  try {
    const verified = await verifyUserManagementRequester(req, res);
    if (!verified) return;

    if (!supabaseAdmin) {
      return res.status(400).json({ error: "Supabase service role key is not configured on the server." });
    }

    const { vendor_id, username, password, auth_user_id, trade_name, company_name } = req.body;

    const rawUsername = (username || '').toString().trim();
    if (!rawUsername) {
      return res.status(400).json({ error: "მომხმარებლის სახელი სავალდებულოა." });
    }

    const email = formatAuthEmail(rawUsername);

    let existingUser: any = null;

    if (auth_user_id && /^[0-9a-f-]{36}$/i.test(auth_user_id)) {
      try {
        const { data: uData } = await supabaseAdmin.auth.admin.getUserById(auth_user_id);
        if (uData?.user) existingUser = uData.user;
      } catch (_) {}
    }

    if (!existingUser && vendor_id) {
      try {
        const { data: vRow } = await supabaseAdmin.from('vendors').select('user_id').eq('id', vendor_id).maybeSingle();
        if (vRow?.user_id) {
          const { data: uData } = await supabaseAdmin.auth.admin.getUserById(vRow.user_id);
          if (uData?.user) existingUser = uData.user;
        }
      } catch (_) {}
    }

    if (!existingUser) {
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        existingUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase()) || null;
      } catch (_) {}
    }

    let resultUserId = '';

    if (existingUser) {
      resultUserId = existingUser.id;
      const updatePayload: any = {
        email,
        email_confirm: true,
        app_metadata: { role: 'vendor' },
        user_metadata: {
          role: 'vendor',
          vendor_id,
          name: trade_name || company_name || 'Supplier'
        }
      };

      if (password && String(password).trim().length >= 6) {
        updatePayload.password = String(password).trim();
      }

      const { data: updatedData, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, updatePayload);
      if (updateErr) {
        return res.status(500).json({ error: `Supplier auth update failed: ${updateErr.message}` });
      }
      resultUserId = updatedData.user.id;
    } else {
      const cleanPassword = (password && String(password).trim()) || 'Georgia2026!';
      const createPayload: any = {
        email,
        password: cleanPassword,
        email_confirm: true,
        app_metadata: { role: 'vendor' },
        user_metadata: {
          role: 'vendor',
          vendor_id,
          name: trade_name || company_name || 'Supplier'
        }
      };

      const { data: createdData, error: createErr } = await supabaseAdmin.auth.admin.createUser(createPayload);
      if (createErr || !createdData.user) {
        return res.status(500).json({ error: `Supplier auth creation failed: ${createErr?.message || 'Unknown error'}` });
      }
      resultUserId = createdData.user.id;
    }

    // NOTE: Supplier credentials are NOT saved in the profiles table!
    // Instead, vendor_id and username are saved directly in the vendors table.

    return res.json({
      success: true,
      user_id: resultUserId,
      username: rawUsername,
      email
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
