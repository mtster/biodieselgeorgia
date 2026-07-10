import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Vendor, VendorContact, Warehouse, City, 
  District, Communication, Direction 
} from '../../types';
import { Search, Plus, Building2, User2, Phone } from 'lucide-react';
import { t, formatPhone } from '../../utils/lang';
import PageHeader from '../PageHeader';
import CentralSearchBar from '../CentralSearchBar';
import { StandardTable, ColumnConfig } from '../StandardTable';
import FormModal from '../FormModal';
import { FormInput, FormSelect } from '../FormInput';
import VendorForm from '../vendors/VendorForm';
import { getVendorContacts } from '../../services/vendorService';

interface ContactsViewProps {
  vendors: Vendor[];
  onSaveVendor: (vendor: Vendor) => void | Promise<void>;
  onContactClick: (vendorId: string) => void;

  // Needed for rendering VendorForm inline
  warehouses: Warehouse[];
  users: User[];
  cities: City[];
  districts: District[];
  directions: Direction[];
  currentUser: User;
  communications?: Communication[];
  onSaveCommunication?: (comm: Communication) => Promise<void> | void;
  onDeleteCommunication?: (id: string) => Promise<void> | void;
}

interface ContactRow {
  id: string;
  name: string;
  phone: string;
  position: 'director' | 'manager' | 'object_number' | 'accountant' | 'cook' | 'other';
  note?: string;
  email?: string;
  company_name: string;
  company_code: string;
  vendor_id: string;
  vendor: Vendor;
}

export default function ContactsView({ 
  vendors, 
  onSaveVendor, 
  onContactClick,
  warehouses,
  users,
  cities,
  districts,
  directions,
  currentUser,
  communications = [],
  onSaveCommunication,
  onDeleteCommunication
}: ContactsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedVendorForForm, setSelectedVendorForForm] = useState<Vendor | null>(null);

  // Modal fields
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');
  const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(false);
  
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPos, setContactPos] = useState<'director' | 'manager' | 'object_number' | 'accountant' | 'cook' | 'other'>('director');
  const [contactNote, setContactNote] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Pagination states
  const [contactsList, setContactsList] = useState<ContactRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

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

  const loadContacts = async () => {
    setIsLoading(true);
    try {
      const contacts = await getVendorContacts();
      
      const rows: ContactRow[] = contacts.map((c: any) => {
        const vInfo: any = vendors.find((v: any) => v.id === c.vendor_id) || {};
        return {
          id: c.id,
          name: c.name || '',
          phone: c.phone || '',
          position: c.position || 'other',
          note: c.note || '',
          email: c.email || '',
          company_name: vInfo.trade_name || vInfo.company_name || '-',
          company_code: vInfo.company_code || vInfo.id_code || '-',
          vendor_id: c.vendor_id || '',
          vendor: vInfo as Vendor
        };
      });

      // Filter rows in-memory by search term
      const term = searchTerm.toLowerCase().trim();
      const filtered = rows.filter(row => {
        if (!term) return true;
        return (
          row.name.toLowerCase().includes(term) ||
          row.phone.toLowerCase().includes(term) ||
          row.company_name.toLowerCase().includes(term) ||
          row.company_code.toLowerCase().includes(term) ||
          row.note.toLowerCase().includes(term) ||
          row.email.toLowerCase().includes(term)
        );
      });

      setContactsList(filtered);
      setTotalCount(filtered.length);
    } catch (err) {
      console.error('Error loading contacts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync selectedVendorForForm if vendors list is updated in App level
  useEffect(() => {
    if (selectedVendorForForm) {
      const updated = vendors.find(v => v.id === selectedVendorForForm.id);
      if (updated) {
        setSelectedVendorForForm(updated);
      }
    }
  }, [vendors, selectedVendorForForm]);

  useEffect(() => {
    loadContacts();
  }, [searchTerm, vendors]);

  // Filter suppliers in modal search
  const filteredModalVendors = activeVendors.filter(v => {
    const name = (v.trade_name || v.company_name || '').toLowerCase();
    return name.includes(vendorSearchQuery.toLowerCase());
  });

  // Define columns with logical max-width constraints to prevent wide stretching
  const columns: ColumnConfig<ContactRow>[] = [
    {
      header: t('Contact Name'),
      key: 'name',
      className: 'text-gray-700 max-w-[180px] truncate',
      render: (row) => (
        <div className="flex items-center gap-2 truncate">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
            <User2 size={14} />
          </div>
          <div className="min-w-0 flex-1 truncate text-left">
            <span className="block text-gray-700 font-medium truncate">{row.name}</span>
            {row.note && <span className="block text-[10px] text-gray-400 font-normal truncate">{row.note}</span>}
          </div>
        </div>
      )
    },
    {
      header: t('Position / Role'),
      key: 'position',
      className: 'text-gray-700 max-w-[140px] truncate',
      render: (row) => {
        const positions: Record<string, string> = {
          director: t('Director/Owner'),
          manager: t('Manager'),
          object_number: t('Object Number'),
          accountant: t('Accountant'),
          cook: t('Cook'),
          other: t('Other Position')
        };
        return <span className="text-gray-700 font-medium truncate">{positions[row.position] || t('Other Position')}</span>;
      }
    },
    {
      header: t('Mobile Phone Number'),
      key: 'phone',
      className: 'font-mono text-gray-700 max-w-[140px] truncate',
      render: (row) => (
        <div className="flex items-center gap-1.5 truncate">
          <Phone size={12} className="text-gray-400 shrink-0" />
          <span className="truncate">{row.phone}</span>
        </div>
      )
    },
    {
      header: t('Company Name'),
      key: 'company_name',
      className: 'text-gray-700 max-w-[180px] truncate',
      render: (row) => (
        <div className="flex items-center gap-2 truncate">
          <Building2 size={13} className="text-gray-400 shrink-0" />
          <span className="truncate">{row.company_name}</span>
        </div>
      )
    },
    {
      header: t('Company Code'),
      key: 'company_code',
      className: 'font-mono text-gray-500 text-xs max-w-[120px] truncate'
    }
  ];

  const handleAddClick = () => {
    setSelectedVendorId('');
    setVendorSearchQuery('');
    setContactName('');
    setContactPhone('');
    setContactPos('director');
    setContactNote('');
    setContactEmail('');
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
      email: contactEmail.trim() || undefined,
      is_default: (targetVendor.contacts || []).length === 0
    };

    const updatedVendor: Vendor = {
      ...targetVendor,
      contacts: [...(targetVendor.contacts || []), newContact]
    };

    try {
      await onSaveVendor(updatedVendor);
      setIsAddModalOpen(false);
      loadContacts();
    } catch (err) {
      console.error('Error saving contact:', err);
      alert('შეცდომა კონტაქტის შენახვისას');
    }
  };

  // Cursor and backspace preservation handlers for phone input
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const val = input.value;
    const start = input.selectionStart || 0;

    const beforeCursor = val.slice(0, start);
    const digitsBefore = beforeCursor.replace(/[^0-9+]/g, '').length;

    const formatted = formatPhone(val);
    setContactPhone(formatted);

    setTimeout(() => {
      let newPos = 0;
      let digitCount = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (formatted[i] !== ' ') {
          digitCount++;
        }
        if (digitCount === digitsBefore) {
          newPos = i + 1;
          break;
        }
      }
      input.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const preventCursorBehindPlus = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    if (input.selectionStart !== null && input.selectionStart < 1) {
      input.setSelectionRange(1, Math.max(1, input.selectionEnd || 1));
    }
  };

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const input = e.currentTarget;
      const start = input.selectionStart;
      const end = input.selectionEnd;

      if (start === 1 && end === 1) {
        e.preventDefault();
        return;
      }

      if (start === end && start !== null && start > 0) {
        const val = input.value;
        const charToLeft = val[start - 1];

        if (charToLeft === ' ') {
          e.preventDefault();

          let deleteIdx = start - 1;
          while (deleteIdx >= 0 && val[deleteIdx] === ' ') {
            deleteIdx--;
          }

          if (deleteIdx >= 0) {
            const newVal = val.slice(0, deleteIdx) + val.slice(deleteIdx + 1);
            const formatted = formatPhone(newVal);

            const digitsBefore = val.slice(0, deleteIdx).replace(/[^0-9+]/g, '').length;
            setContactPhone(formatted);

            setTimeout(() => {
              let newPos = 0;
              let digitCount = 0;
              for (let i = 0; i < formatted.length; i++) {
                if (formatted[i] !== ' ') {
                  digitCount++;
                }
                if (digitCount === digitsBefore) {
                  newPos = i + 1;
                  break;
                }
              }
              input.setSelectionRange(newPos, newPos);
            }, 0);
          }
        }
      }
    }
  };

  // Render the breadcrumb title if editing a vendor directly inline
  const pageTitle = selectedVendorForForm ? (
    <div className="flex items-center gap-1.5 md:gap-2 flex-wrap text-sm md:text-base">
      <span className="text-gray-500 font-semibold">{t("Contacts")}</span>
      <span className="text-gray-450 font-medium">&gt;</span>
      <span className="text-emerald-850 font-bold">
        {t("Supplier")}: <span className="underline">{selectedVendorForForm.trade_name || selectedVendorForForm.company_name}</span>
      </span>
    </div>
  ) : (
    t("Contacts")
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        onBack={selectedVendorForForm ? () => setSelectedVendorForForm(null) : undefined}
        actions={
          !selectedVendorForForm && (
            <button
              onClick={handleAddClick}
              type="button"
              className="p-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-black rounded-xl cursor-pointer flex items-center justify-center gap-2 transition duration-150 select-none shadow-sm"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>{t("Add Contact")}</span>
            </button>
          )
        }
      />

      {selectedVendorForForm ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-1">
          <VendorForm
            editingVendor={selectedVendorForForm}
            setEditingVendor={setSelectedVendorForForm}
            warehouses={warehouses}
            users={users}
            cities={cities}
            districts={districts}
            directions={directions}
            currentUser={currentUser}
            onSave={async (updatedVendor) => {
              await onSaveVendor(updatedVendor);
              setSelectedVendorForForm(null); // Return to contacts list upon save
            }}
            onCancel={() => setSelectedVendorForForm(null)}
            communications={communications}
            onSaveCommunication={onSaveCommunication}
            onDeleteCommunication={onDeleteCommunication}
          />
        </div>
      ) : (
        <>
          {/* Plain search bar without any enclosing box styled outline */}
          <CentralSearchBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder={t("Search contact name, phone or company...")}
          />

          <StandardTable
            data={contactsList}
            columns={columns}
            onRowClick={(row) => {
              const matchedVendor = activeVendors.find(v => v.id === row.vendor_id);
              if (matchedVendor) {
                setSelectedVendorForForm(matchedVendor);
              }
            }}
            emptyMessage="No contacts recorded"
          />
        </>
      )}

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
            onSelect={preventCursorBehindPlus}
            onClick={preventCursorBehindPlus}
            onTouchEnd={preventCursorBehindPlus}
            onChange={handlePhoneChange}
            onKeyDown={handlePhoneKeyDown}
          />

          <FormInput
            label={t("Email")}
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />

          <FormSelect
            label={t("Position / Role")}
            value={contactPos}
            onChange={(e) => setContactPos(e.target.value as any)}
          >
            <option value="director">{t("Director/Owner")}</option>
            <option value="manager">{t("Manager")}</option>
            <option value="object_number">{t("Object Number")}</option>
            <option value="accountant">{t("Accountant")}</option>
            <option value="cook">{t("Cook")}</option>
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
