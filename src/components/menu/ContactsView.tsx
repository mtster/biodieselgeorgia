import React, { useState, useEffect, useRef } from 'react';
import { User, Vendor, VendorContact } from '../../types';
import { BookOpen, Search, Plus, Building2, User2, Phone, Briefcase } from 'lucide-react';
import { t, formatPhone } from '../../utils/lang';
import PageHeader from '../PageHeader';
import CentralSearchBar from '../CentralSearchBar';
import { StandardTable, ColumnConfig } from '../StandardTable';
import FormModal from '../FormModal';
import { FormInput, FormSelect } from '../FormInput';

interface ContactsViewProps {
  vendors: Vendor[];
  onSaveVendor: (vendor: Vendor) => void | Promise<void>;
  onContactClick: (vendorId: string) => void;
}

interface ContactRow {
  id: string;
  name: string;
  phone: string;
  position: 'accountant' | 'director' | 'operator' | 'other';
  note?: string;
  company_name: string;
  company_code: string;
  vendor_id: string;
  vendor: Vendor;
}

export default function ContactsView({ vendors, onSaveVendor, onContactClick }: ContactsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Modal fields
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');
  const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(false);
  
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPos, setContactPos] = useState<'accountant' | 'director' | 'operator' | 'other'>('accountant');
  const [contactNote, setContactNote] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close supplier search dropdown if clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsVendorDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter out soft-deleted vendors
  const activeVendors = vendors.filter(v => !v.is_deleted);

  // Build the unified contact list
  const allContacts: ContactRow[] = [];
  activeVendors.forEach(vendor => {
    if (vendor.contacts && Array.isArray(vendor.contacts)) {
      vendor.contacts.forEach((c: VendorContact) => {
        allContacts.push({
          id: c.id,
          name: c.name,
          phone: c.phone,
          position: c.position,
          note: c.note,
          company_name: vendor.trade_name || vendor.company_name || '-',
          company_code: vendor.company_code || vendor.id_code || '-',
          vendor_id: vendor.id,
          vendor: vendor
        });
      });
    }
  });

  // Filter contacts based on search query (search name, phone, company name, company code)
  const filteredContacts = allContacts.filter(row => {
    const query = searchTerm.toLowerCase();
    return (
      row.name.toLowerCase().includes(query) ||
      row.phone.toLowerCase().includes(query) ||
      row.company_name.toLowerCase().includes(query) ||
      row.company_code.toLowerCase().includes(query) ||
      (row.note || '').toLowerCase().includes(query)
    );
  });

  // Filter suppliers in modal search
  const filteredModalVendors = activeVendors.filter(v => {
    const name = (v.trade_name || v.company_name || '').toLowerCase();
    return name.includes(vendorSearchQuery.toLowerCase());
  });

  // Define columns
  const columns: ColumnConfig<ContactRow>[] = [
    {
      header: t('Contact Name *'),
      key: 'name',
      className: 'font-bold text-gray-900',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
            <User2 size={14} />
          </div>
          <div>
            <span className="block font-semibold text-gray-800">{row.name}</span>
            {row.note && <span className="block text-[10px] text-gray-400 font-normal">{row.note}</span>}
          </div>
        </div>
      )
    },
    {
      header: t('Position / Role'),
      key: 'position',
      render: (row) => {
        const positions: Record<string, string> = {
          accountant: t('Accountant'),
          director: t('Director/Owner'),
          operator: t('Operations Mgr'),
          other: t('Other Position')
        };
        return <span className="font-semibold">{positions[row.position] || t('Other Position')}</span>;
      }
    },
    {
      header: t('Mobile Phone Number *'),
      key: 'phone',
      className: 'font-mono text-gray-800 font-bold',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Phone size={12} className="text-gray-400" />
          <span>{row.phone}</span>
        </div>
      )
    },
    {
      header: t('Company Name'),
      key: 'company_name',
      className: 'font-medium text-slate-700',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Building2 size={13} className="text-gray-400" />
          <span>{row.company_name}</span>
        </div>
      )
    },
    {
      header: t('Company Code'),
      key: 'company_code',
      className: 'font-mono text-gray-500 text-xs'
    }
  ];

  const handleAddClick = () => {
    setSelectedVendorId('');
    setVendorSearchQuery('');
    setContactName('');
    setContactPhone('');
    setContactPos('accountant');
    setContactNote('');
    setIsVendorDropdownOpen(false);
    setIsAddModalOpen(true);
  };

  const handleSaveContact = async () => {
    if (!selectedVendorId) {
      alert(t("Please select a supplier"));
      return;
    }
    if (!contactName.trim() || !contactPhone.trim()) {
      alert(t("Please fill in contact name and phone number"));
      return;
    }

    const targetVendor = activeVendors.find(v => v.id === selectedVendorId);
    if (!targetVendor) return;

    // Create a new unique contact ID
    const newContactId = 'c_' + Math.random().toString(36).substring(2, 9);
    const newContact: VendorContact = {
      id: newContactId,
      name: contactName.trim(),
      phone: contactPhone.trim(),
      position: contactPos,
      note: contactNote.trim() || undefined,
      is_default: (targetVendor.contacts || []).length === 0
    };

    const updatedVendor: Vendor = {
      ...targetVendor,
      contacts: [...(targetVendor.contacts || []), newContact]
    };

    try {
      await onSaveVendor(updatedVendor);
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Error saving contact:', err);
      alert('შეცდომა კონტაქტის შენახვისას');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        subtitle="View and manage centralized contact directory across suppliers"
        actions={
          <button
            onClick={handleAddClick}
            type="button"
            className="p-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-black rounded-xl cursor-pointer flex items-center justify-center gap-2 transition duration-150 select-none shadow-sm"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>{t("Add Contact")}</span>
          </button>
        }
      />

      <div className="bg-slate-50/50 border border-gray-100 p-4 rounded-2xl">
        <CentralSearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={t("Search contact name, phone or company...")}
        />
      </div>

      <StandardTable
        data={filteredContacts}
        columns={columns}
        onRowClick={(row) => onContactClick(row.vendor_id)}
        emptyMessage="No contacts recorded"
      />

      {/* ADD CONTACT MODAL WITH INTEGRATED SUPPLIER TYPE SEARCH */}
      <FormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t('Add Contact Person')}
        maxWidthClass="max-w-md"
        onCancel={() => setIsAddModalOpen(false)}
        onSave={handleSaveContact}
        saveLabel={t("Confirm")}
      >
        <div className="space-y-4 text-left">
          {/* Custom Autocompleting Supplier Search Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-bold text-gray-500 select-none mb-1.5">
              {t("Supplier")} *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder={t("Type to search supplier...")}
                value={vendorSearchQuery}
                onFocus={() => setIsVendorDropdownOpen(true)}
                onChange={(e) => {
                  setVendorSearchQuery(e.target.value);
                  setIsVendorDropdownOpen(true);
                  // Reset selection if query changes unless matched
                  if (selectedVendorId) {
                    const matched = activeVendors.find(v => (v.trade_name || v.company_name || '').toLowerCase() === e.target.value.toLowerCase());
                    if (!matched) setSelectedVendorId('');
                  }
                }}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl text-xs font-semibold focus:outline-none transition-all text-gray-900 font-sans"
              />
            </div>

            {isVendorDropdownOpen && (
              <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto divide-y divide-gray-50">
                {filteredModalVendors.length === 0 ? (
                  <div className="p-3 text-xs text-gray-400 italic text-center">
                    {t("No records found.")}
                  </div>
                ) : (
                  filteredModalVendors.map(vendor => (
                    <button
                      key={vendor.id}
                      type="button"
                      onClick={() => {
                        setSelectedVendorId(vendor.id);
                        setVendorSearchQuery(vendor.trade_name || vendor.company_name || '');
                        setIsVendorDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 flex flex-col transition-colors cursor-pointer ${
                        selectedVendorId === vendor.id ? 'bg-emerald-50/50 font-bold' : ''
                      }`}
                    >
                      <span className="font-semibold text-gray-800">
                        {vendor.trade_name || vendor.company_name}
                      </span>
                      <span className="text-[10px] text-gray-400 font-normal">
                        {vendor.company_code || vendor.id_code}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <FormInput
            label={t("Contact Name *")}
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />

          <FormInput
            label={t("Mobile Phone Number *")}
            type="text"
            value={contactPhone}
            fontClass="font-mono font-bold"
            onFocus={() => { if(!contactPhone) setContactPhone('+995 ') }}
            onChange={(e) => setContactPhone(formatPhone(e.target.value))}
          />

          <FormSelect
            label={t("Position / Role")}
            value={contactPos}
            onChange={(e) => setContactPos(e.target.value as any)}
          >
            <option value="accountant">{t("Accountant")}</option>
            <option value="director">{t("Director/Owner")}</option>
            <option value="operator">{t("Operations Mgr")}</option>
            <option value="other">{t("Other Position")}</option>
          </FormSelect>

          <FormInput
            label={t("Short Note (e.g. call instructions)")}
            type="text"
            value={contactNote}
            onChange={(e) => setContactNote(e.target.value)}
          />
        </div>
      </FormModal>
    </div>
  );
}
