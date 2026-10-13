import { useRef, useCallback } from 'react';
import { Vendor, VendorContact } from '../../../types';

export function getCleanUsername(u: string | undefined): string {
  if (!u) return '';
  const trimmed = u.trim();
  if (trimmed.endsWith('@biodiesel.ge')) {
    return trimmed.substring(0, trimmed.length - '@biodiesel.ge'.length);
  }
  return trimmed;
}

export interface VendorSnapshot {
  vendor: Vendor;
  username: string;
  contacts: VendorContact[];
}

export function useVendorValidation(
  editingVendor: Vendor,
  tempContacts: VendorContact[],
  usernameInput: string,
  passwordInput: string,
  isNew: boolean
) {
  const initialSnapshotRef = useRef<VendorSnapshot>({
    vendor: JSON.parse(JSON.stringify(editingVendor)),
    username: getCleanUsername(editingVendor.username),
    contacts: editingVendor.contacts ? JSON.parse(JSON.stringify(editingVendor.contacts)) : []
  });

  const updateSnapshot = useCallback((vendor: Vendor, contacts?: VendorContact[]) => {
    const defaultHours = vendor.working_hours || '10:00 - 19:00';
    initialSnapshotRef.current = {
      vendor: {
        ...JSON.parse(JSON.stringify(vendor)),
        working_hours: defaultHours
      },
      username: getCleanUsername(vendor.username),
      contacts: contacts ? JSON.parse(JSON.stringify(contacts)) : (vendor.contacts ? JSON.parse(JSON.stringify(vendor.contacts)) : [])
    };
  }, []);

  const hasVendorChanges = useCallback((): boolean => {
    if (!editingVendor.id || isNew) return true;

    // Check account changes
    if (passwordInput.trim() !== '') return true;
    if (usernameInput.trim() !== initialSnapshotRef.current.username.trim()) return true;

    const initV = initialSnapshotRef.current.vendor;

    // Compare scalar fields
    const fieldsToCompare: (keyof Vendor)[] = [
      'trade_name', 'company_name', 'id_code', 'company_code',
      'city', 'district', 'address', 'warehouse_id', 'direction_id',
      'manager_id', 'operator_id', 'bank_account',
      'working_hours', 'planned_weekday'
    ];

    for (const f of fieldsToCompare) {
      if (f === 'working_hours') {
        const v1 = (editingVendor[f] || '10:00 - 19:00').trim();
        const v2 = (initV[f] || '10:00 - 19:00').trim();
        if (v1 !== v2) return true;
        continue;
      }
      const v1 = (editingVendor[f] ?? '').toString().trim();
      const v2 = (initV[f] ?? '').toString().trim();
      if (v1 !== v2) return true;
    }

    // Compare numeric and boolean values
    if ((editingVendor.status || 'Active') !== (initV.status || 'Active')) return true;
    if (Number(editingVendor.price_per_liter || 0) !== Number(initV.price_per_liter || 0)) return true;
    if (Number(editingVendor.overdue_threshold_days || 0) !== Number(initV.overdue_threshold_days || 0)) return true;
    if (Boolean(editingVendor.is_planned) !== Boolean(initV.is_planned)) return true;
    if (Number(editingVendor.frequency_weeks || 1) !== Number(initV.frequency_weeks || 1)) return true;
    if (Number(editingVendor.tanks_to_bring || 0) !== Number(initV.tanks_to_bring || 0)) return true;
    if (Number(editingVendor.tanks_to_leave || 0) !== Number(initV.tanks_to_leave || 0)) return true;

    // Compare custom fields
    const allKeys = Array.from(new Set([...Object.keys(editingVendor), ...Object.keys(initV)]));
    for (const k of allKeys) {
      if (k.startsWith('custom_')) {
        if ((editingVendor as any)[k] !== (initV as any)[k]) return true;
      }
    }

    // Compare comments
    const initComments = JSON.stringify(initV.comments || []);
    const currComments = JSON.stringify(editingVendor.comments || []);
    if (initComments !== currComments) return true;

    // Compare contacts
    const initContacts = initialSnapshotRef.current.contacts || [];
    const hasOnlyLoadedExistingContacts = initContacts.length === 0 && tempContacts.length > 0 && tempContacts.every(c => !c.id.startsWith('cont-') && !c.id.startsWith('main-cont-'));
    if (!hasOnlyLoadedExistingContacts && tempContacts.length !== initContacts.length) return true;

    if (!hasOnlyLoadedExistingContacts) {
      for (let i = 0; i < tempContacts.length; i++) {
        const tc = tempContacts[i];
        if (tc.id.startsWith('cont-') || tc.id.startsWith('main-cont-')) return true;

        const matchedInit = initContacts.find(c => c.id === tc.id);
        if (!matchedInit) return true;

        if ((tc.name || '').trim() !== (matchedInit.name || '').trim()) return true;
        if ((tc.phone || '').trim() !== (matchedInit.phone || '').trim()) return true;
        if ((tc.position || '').toString() !== (matchedInit.position || '').toString()) return true;
        if ((tc.email || '').trim() !== (matchedInit.email || '').trim()) return true;
        if ((tc.note || '').trim() !== (matchedInit.note || '').trim()) return true;
        if (Boolean(tc.is_active ?? true) !== Boolean(matchedInit.is_active ?? true)) return true;
        if (Boolean(tc.is_default) !== Boolean(matchedInit.is_default)) return true;
      }
    }

    return false;
  }, [editingVendor, tempContacts, usernameInput, passwordInput, isNew]);

  const validateVendorForm = useCallback((): { errs: Record<string, string>; needsUserCreationOrUpdate: boolean } => {
    const errs: Record<string, string> = {};

    if (!editingVendor.trade_name?.trim()) {
      errs.trade_name = 'სავაჭრო სახელი სავალდებულოა.';
    }
    if (!editingVendor.city) {
      errs.city = 'ქალაქი სავალდებულოა.';
    }
    if (!editingVendor.district) {
      errs.district = 'რაიონი სავალდებულოა.';
    }
    if (!editingVendor.address?.trim()) {
      errs.address = 'მისამართი სავალდებულოა.';
    }
    if (!editingVendor.warehouse_id) {
      errs.warehouse_id = 'მინიჭებული საწყობი სავალდებულოა.';
    }
    if (!editingVendor.direction_id) {
      errs.direction_id = 'მიმართულება სავალდებულოა.';
    }

    const effectiveContacts = tempContacts.length > 0 ? tempContacts : (editingVendor.contacts || []);
    if (isNew && effectiveContacts.length === 0) {
      errs.contacts = 'სულ მცირე ერთი კონტაქტი უნდა იყოს დამატებული.';
    }

    const cleanCurrentUsername = getCleanUsername(editingVendor.username || '');
    const isUsernameChanged = usernameInput.trim() !== cleanCurrentUsername;
    const hasExistingUser = !!editingVendor.user_id;

    let needsUserCreationOrUpdate = false;
    if (usernameInput.trim() || passwordInput.trim()) {
      if (!usernameInput.trim()) {
        errs.username = 'მომხმარებლის სახელი სავალდებულოა.';
      } else if (!passwordInput.trim() && (!hasExistingUser || isUsernameChanged)) {
        errs.password = 'პაროლი სავალდებულოა.';
      } else {
        needsUserCreationOrUpdate = true;
      }
    }

    return { errs, needsUserCreationOrUpdate };
  }, [editingVendor, tempContacts, usernameInput, passwordInput, isNew]);

  return {
    initialSnapshotRef,
    updateSnapshot,
    hasVendorChanges,
    validateVendorForm
  };
}
