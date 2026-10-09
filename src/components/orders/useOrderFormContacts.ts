import { useState, useEffect } from 'react';
import { Order, Vendor, VendorContact } from '../../types';
import { getVendorContacts } from '../../services/vendorService';

export function useOrderFormContacts(
  vendorId: string | undefined,
  contactId: string | undefined,
  suppliers: Vendor[],
  setEditingOrder: React.Dispatch<React.SetStateAction<Order | null>>
) {
  const [fetchedContacts, setFetchedContacts] = useState<VendorContact[]>([]);

  useEffect(() => {
    if (!vendorId) {
      setFetchedContacts([]);
      return;
    }

    const cleanVendorId = String(vendorId).trim().toLowerCase();
    const supplier = suppliers.find(
      s => s.id === vendorId || (s.id && String(s.id).trim().toLowerCase() === cleanVendorId)
    );
    if (supplier && supplier.contacts && supplier.contacts.length > 0) {
      setFetchedContacts(supplier.contacts);
    } else {
      getVendorContacts(vendorId).then(contacts => {
        setFetchedContacts(contacts || []);
      });
    }
  }, [vendorId, suppliers]);

  useEffect(() => {
    if (vendorId && fetchedContacts.length > 0) {
      const currentContactExists = fetchedContacts.some(c => c.id === contactId);
      if (!contactId || !currentContactExists) {
        const defaultContact = fetchedContacts.find(c => c.is_default) || fetchedContacts[0];
        if (defaultContact && defaultContact.id !== contactId) {
          setEditingOrder(prev => {
            if (!prev || prev.contact_id === defaultContact.id) return prev;
            return {
              ...prev,
              contact_id: defaultContact.id
            };
          });
        }
      }
    }
  }, [vendorId, contactId, fetchedContacts, setEditingOrder]);

  return { fetchedContacts };
}
