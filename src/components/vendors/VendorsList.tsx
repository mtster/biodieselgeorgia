import React, { useState } from 'react';
import { Vendor, User, VendorComment, Communication } from '../../types';
import { t } from '../../utils/lang';
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
  communications: Communication[];
}

export default function VendorsList({
  filteredVendors,
  users,
  startEdit,
  selectedVendors = [],
  setSelectedVendors,
  managedCols = [],
  communications = []
}: Props) {
  const [hoveredTooltip, setHoveredTooltip] = useState<{
    items: { key: string; author: string; date: string; content: string }[];
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
      header: t('Trade Name'),
      key: 'trade_name',
      className: 'min-w-[150px] max-w-[200px]',
      render: (vendor) => <div className="truncate" title={vendor.trade_name}>{vendor.trade_name}</div>
    },
    id_code: {
      header: t('Taxation ID'),
      key: 'id_code',
      className: 'min-w-[100px] max-w-[150px]',
      render: (vendor) => <div className="truncate" title={vendor.id_code}>{vendor.id_code}</div>
    },
    status: {
      header: t('Status'),
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
            {t(stat)}
          </span>
        );
      }
    },
    price_per_liter: {
      header: t('Rate (₾)'),
      key: 'price_per_liter',
      render: (vendor) => `₾ ${vendor.price_per_liter.toFixed(2)}`
    },
    working_hours: {
      header: t('Working Hours'),
      key: 'working_hours',
      className: 'min-w-[100px] max-w-[150px]',
      render: (vendor) => <div className="truncate" title={vendor.working_hours}>{vendor.working_hours}</div>
    },
    location: {
      header: t('Location'),
      key: 'location',
      className: 'min-w-[150px] max-w-[250px]',
      render: (vendor) => {
        const text = `${vendor.city} (${vendor.district}), ${vendor.address}`;
        return <div className="truncate" title={text}>{text}</div>
      }
    },
    barrels_amount: {
      header: t('Barrels Amount'),
      key: 'barrels_amount',
      render: (vendor) => vendor.barrels_amount === undefined || vendor.barrels_amount === null ? '-' : vendor.barrels_amount
    },
    company_code: {
      header: t('Assigned Code'),
      key: 'company_code',
      render: (vendor) => vendor.company_code || '-'
    },
    primary_contact: {
      header: t('Primary Contact'),
      key: 'primary_contact',
      className: 'min-w-[150px] max-w-[200px]',
      render: (vendor) => {
        const defaultContact = (vendor.contacts || []).find(c => c.is_default);
        const text = defaultContact ? `${defaultContact.name} (${defaultContact.phone})` : t('No Contact');
        return <div className="truncate" title={text}>{text}</div>
      }
    },
    additional_contacts: {
      header: t('Additional Contacts'),
      key: 'additional_contacts',
      className: 'min-w-[150px] max-w-[200px]',
      render: (vendor) => {
        const additionalContacts = (vendor.contacts || []).filter(c => !c.is_default && c.name !== "__DYNAMIC_CUSTOM_FIELDS__");
        const text = additionalContacts.length > 0
          ? additionalContacts.map(c => `${c.name} (${c.phone})`).join(', ')
          : '-';
        return <div className="truncate" title={text}>{text}</div>
      }
    },
    manager: {
      header: t('Sales Manager'),
      key: 'manager',
      className: 'min-w-[100px]',
      render: (vendor) => <div className="truncate" title={users.find(u => u.id === vendor.manager_id)?.name || ''}>{users.find(u => u.id === vendor.manager_id)?.name || '-'}</div>
    },
    dispatcher: {
      header: t('Operation Manager'),
      key: 'dispatcher',
      className: 'min-w-[100px]',
      render: (vendor) => <div className="truncate" title={users.find(u => u.id === vendor.operator_id)?.name || ''}>{users.find(u => u.id === vendor.operator_id)?.name || '-'}</div>
    },
    communications: {
      header: t('Communications'),
      key: 'communications',
      className: 'min-w-[150px] max-w-[200px]',
      render: (vendor) => {
        const vendorComms = (communications || [])
          .filter(c => c.vendor_id === vendor.id && !c.is_deleted)
          .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());

        const latestComm = vendorComms[0];
        return (
          <div
            className="truncate max-w-full text-slate-750 font-sans cursor-pointer"
            onMouseEnter={(e) => {
              if (vendorComms.length > 0) {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredTooltip({
                  items: vendorComms.map(c => {
                    const matchedUser = users.find(u => u.id === c.user_id);
                    return {
                      key: c.id,
                      author: matchedUser?.name || c.user_name || t('System'),
                      date: new Date(c.date_time).toLocaleDateString() + ' ' + (c.date_time.includes('T') ? c.date_time.split('T')[1].substring(0, 5) : ''),
                      content: c.comment
                    };
                  }),
                  rect: {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                  }
                });
              }
            }}
            onMouseLeave={() => setHoveredTooltip(null)}
          >
            {latestComm ? latestComm.comment : '-'}
          </div>
        );
      }
    },
    comments: {
      header: t('Memos / Internal Notes'),
      key: 'comments',
      className: 'min-w-[150px] max-w-[200px]',
      render: (vendor) => {
        const latestComment = vendor.comments && vendor.comments.length > 0 ? vendor.comments[0] : null;
        return (
          <div
            className="truncate max-w-full font-sans cursor-pointer"
            onMouseEnter={(e) => {
              if (vendor.comments && vendor.comments.length > 0) {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredTooltip({
                  items: vendor.comments.map(c => ({
                    key: c.id,
                    author: c.user_name || 'System',
                    date: new Date(c.date).toLocaleDateString(),
                    content: c.comment
                  })),
                  rect: {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                  }
                });
              }
            }}
            onMouseLeave={() => setHoveredTooltip(null)}
          >
            {latestComment ? latestComment.comment : '-'}
          </div>
        );
      }
    }
  };

  const columns: ColumnConfig<Vendor>[] = [];

  // Prepend multi-select checkbox column
  columns.push({
    header: '',
    key: 'select',
    className: 'w-12 text-center sticky left-0 z-30 bg-slate-50',
    render: (vendor) => {
      const isChecked = selectedVendors.includes(vendor.id);
      return (
        <div onClick={(e) => e.stopPropagation()} className="flex justify-center sticky left-0 z-30 bg-white">
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
          header: t(col.label),
          key: col.id,
          render: (v: any) => v[col.id] ?? '-'
        });
      }
    }
  });

  // Append action button column at the end
  columns.push({
    header: t('Actions'),
    key: 'actions',
    className: 'text-right',
    render: (vendor) => (
      <div onClick={(e) => e.stopPropagation()} className="flex justify-end gap-1 select-none">
        <button
          onClick={() => startEdit(vendor, false)}
          className="p-1 px-1.5 text-gray-400 hover:text-emerald-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-all"
          title={t("Edit")}
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
        emptyMessage={t("No supplier data matches current search criteria.")}
      />

      {hoveredTooltip && hoveredTooltip.items.length > 0 && hoveredTooltip.rect && (() => {
        const tooltipWidth = 320;
        const estimatedLeft = hoveredTooltip.rect.left + (hoveredTooltip.rect.width / 2) - (tooltipWidth / 2);
        const maxLeft = typeof window !== 'undefined' ? window.innerWidth - tooltipWidth - 16 : 800;
        const clampedLeft = Math.max(16, Math.min(estimatedLeft, maxLeft));

        return (
          <div 
            style={{
              position: 'fixed',
              top: hoveredTooltip.rect.top < 220 
                ? `${hoveredTooltip.rect.top + hoveredTooltip.rect.height + 8}px` 
                : `${hoveredTooltip.rect.top - 8}px`,
              left: `${clampedLeft}px`,
              ...(hoveredTooltip.rect.top >= 220 ? { transform: 'translateY(-100%)' } : {})
            }}
            className="w-80 bg-white border border-slate-200 text-slate-800 rounded-xl p-3.5 shadow-xl text-[12px] leading-relaxed z-50 space-y-2 pointer-events-none select-none transition-all duration-150"
          >
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1 select-text">
              {hoveredTooltip.items.map(item => (
                <div key={item.key} className="border-b border-gray-100 last:border-0 pb-1.5 last:pb-0 font-sans">
                  <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold mb-0.5 font-sans">
                    <span className="text-emerald-800 font-sans">{item.author}</span>
                    <span>{item.date}</span>
                  </div>
                  <p className="font-sans text-gray-750 break-words">{item.content}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </>
  );
}
