import React, { useState } from 'react';
import { Vendor, User, VendorComment } from '../../types';
import { Edit3, Check } from 'lucide-react';
import { StandardTable, ColumnConfig } from '../StandardTable';
import { ManagedColumn } from '../ColumnsManagerModal';

interface Props {
  filteredVendors: Vendor[];
  users: User[];
  startEdit: (vendor: Vendor, readOnly?: boolean) => void;
  askDelete: (id: string, name: string) => void;
  selectedVendors: string[];
  setSelectedVendors: React.Dispatch<React.SetStateAction<string[]>>;
  managedCols: ManagedColumn[];
}

export default function VendorsList({
  filteredVendors,
  users,
  startEdit,
  selectedVendors = [],
  setSelectedVendors,
  managedCols = []
}: Props) {
  const [hoveredComments, setHoveredComments] = useState<{
    comments: VendorComment[];
    rect: { top: number; left: number; width: number; height: number } | null;
  } | null>(null);

  const toggleSelect = (vendorId: string) => {
    if (selectedVendors.includes(vendorId)) {
      setSelectedVendors(selectedVendors.filter(id => id !== vendorId));
    } else {
      setSelectedVendors([...selectedVendors, vendorId]);
    }
  };

  const handleRowClick = (vendor: Vendor) => {
    startEdit(vendor, false);
  };

  // Predefined column mapping
  const columnMap: Record<string, ColumnConfig<Vendor>> = {
    trade_name: {
      header: 'Trade Name',
      key: 'trade_name',
      render: (vendor) => vendor.trade_name
    },
    id_code: {
      header: 'Taxation ID',
      key: 'id_code',
      render: (vendor) => vendor.id_code
    },
    status: {
      header: 'Status',
      key: 'status',
      render: (vendor) => {
        const stat = vendor.status || 'Active';
        const colorMap: Record<string, string> = {
          'Active': 'bg-emerald-50 text-emerald-700 border-emerald-200',
          'Under Negotiation': 'bg-amber-50 text-amber-700 border-amber-200',
          'Cancelled': 'bg-rose-50 text-rose-700 border-rose-200'
        };
        return (
          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${colorMap[stat] || colorMap['Active']}`}>
            {stat}
          </span>
        );
      }
    },
    price_per_liter: {
      header: 'Rate (₾)',
      key: 'price_per_liter',
      render: (vendor) => `₾ ${vendor.price_per_liter.toFixed(2)}`
    },
    working_hours: {
      header: 'Working Hours',
      key: 'working_hours',
      render: (vendor) => vendor.working_hours
    },
    location: {
      header: 'Location',
      key: 'location',
      render: (vendor) => `${vendor.city} (${vendor.district}), ${vendor.address}`
    },
    company_code: {
      header: 'Assigned Code',
      key: 'company_code',
      render: (vendor) => vendor.company_code || '-'
    },
    primary_contact: {
      header: 'Primary Contact',
      key: 'primary_contact',
      render: (vendor) => {
        const defaultContact = (vendor.contacts || []).find(c => c.is_default);
        return defaultContact ? `${defaultContact.name} (${defaultContact.phone})` : 'No Contact';
      }
    },
    additional_contacts: {
      header: 'Additional Contacts',
      key: 'additional_contacts',
      render: (vendor) => {
        const additionalContacts = (vendor.contacts || []).filter(c => !c.is_default);
        return additionalContacts.length > 0
          ? additionalContacts.map(c => `${c.name} (${c.phone})`).join(', ')
          : '-';
      }
    },
    manager: {
      header: 'Sales Manager',
      key: 'manager',
      render: (vendor) => users.find(u => u.id === vendor.manager_id)?.name || '-'
    },
    dispatcher: {
      header: 'Operation Manager',
      key: 'dispatcher',
      render: (vendor) => users.find(u => u.id === vendor.operator_id)?.name || '-'
    },
    comments: {
      header: 'Memos / Internal Notes',
      key: 'comments',
      render: (vendor) => {
        const latestComment = vendor.comments && vendor.comments.length > 0 ? vendor.comments[0] : null;
        return (
          <div
            className="truncate max-w-[150px]"
            onMouseEnter={(e) => {
              if (vendor.comments && vendor.comments.length > 0) {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredComments({
                  comments: vendor.comments,
                  rect: {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                  }
                });
              }
            }}
            onMouseLeave={() => setHoveredComments(null)}
          >
            {latestComment ? latestComment.comment : 'No comments'}
          </div>
        );
      }
    }
  };

  const columns: ColumnConfig<Vendor>[] = [];

  // Prepend multi-select checkbox column
  columns.push({
    header: 'Sel',
    key: 'select',
    className: 'w-12 text-center',
    render: (vendor) => {
      const isChecked = selectedVendors.includes(vendor.id);
      return (
        <div onClick={(e) => e.stopPropagation()} className="flex justify-center">
          <button
            type="button"
            onClick={() => toggleSelect(vendor.id)}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-all mx-auto cursor-pointer ${
              isChecked
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            {isChecked && <Check size={11} strokeWidth={3.5} />}
          </button>
        </div>
      );
    }
  });

  // Map configured columns
  managedCols.forEach((col) => {
    if (col.visible) {
      if (columnMap[col.id]) {
        columns.push(columnMap[col.id]);
      } else {
        // Handle fallback or added custom columns
        columns.push({
          header: col.label,
          key: col.id,
          render: (v: any) => v[col.id] ?? '-'
        });
      }
    }
  });

  // Append action button column at the end
  columns.push({
    header: 'Actions',
    key: 'actions',
    className: 'text-right',
    render: (vendor) => (
      <div onClick={(e) => e.stopPropagation()} className="flex justify-end gap-1 select-none">
        <button
          onClick={() => startEdit(vendor, false)}
          className="p-1 px-1.5 text-gray-400 hover:text-emerald-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-all"
          title="Edit"
        >
          <Edit3 size={13} />
        </button>
      </div>
    )
  });

  const rowClassName = (vendor: Vendor) => {
    const isChecked = selectedVendors.includes(vendor.id);
    return isChecked ? 'bg-emerald-50/30 hover:bg-emerald-50/50' : 'hover:bg-slate-50/80';
  };

  return (
    <>
      <StandardTable
        data={filteredVendors}
        columns={columns}
        onRowClick={handleRowClick}
        rowClassName={rowClassName}
        emptyMessage="No supplier data matches current search criteria."
      />

      {hoveredComments && hoveredComments.comments.length > 0 && hoveredComments.rect && (() => {
        const tooltipWidth = 320;
        const estimatedLeft = hoveredComments.rect.left + (hoveredComments.rect.width / 2) - (tooltipWidth / 2);
        const maxLeft = typeof window !== 'undefined' ? window.innerWidth - tooltipWidth - 16 : 800;
        const clampedLeft = Math.max(16, Math.min(estimatedLeft, maxLeft));

        return (
          <div 
            style={{
              position: 'fixed',
              top: hoveredComments.rect.top < 220 
                ? `${hoveredComments.rect.top + hoveredComments.rect.height + 8}px` 
                : `${hoveredComments.rect.top - 8}px`,
              left: `${clampedLeft}px`,
              ...(hoveredComments.rect.top >= 220 ? { transform: 'translateY(-100%)' } : {})
            }}
            className="w-80 bg-white border border-slate-200 text-slate-800 rounded-xl p-3.5 shadow-xl text-[12px] leading-relaxed z-50 space-y-2 pointer-events-none select-none transition-all duration-150"
          >
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1 select-text">
              {hoveredComments.comments.map(c => (
                <div key={c.id} className="border-b border-gray-100 last:border-0 pb-1.5 last:pb-0 font-sans">
                  <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold mb-0.5 font-sans">
                    <span className="text-emerald-800 font-sans">{c.user_name}</span>
                    <span>{new Date(c.date).toLocaleString()}</span>
                  </div>
                  <p className="font-sans text-gray-750 break-words">{c.comment}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </>
  );
}
