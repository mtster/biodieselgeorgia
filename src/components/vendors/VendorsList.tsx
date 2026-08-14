import React, { useState } from 'react';
import { Vendor, User, VendorComment, Communication, Direction } from '../../types';
import { t, formatDate, formatDateTime } from '../../utils/lang';
import { Edit3, Check } from 'lucide-react';
import { StandardTable, ColumnConfig } from '../StandardTable';
import { ManagedColumn } from '../ColumnsManagerModal';
import VendorsTooltip from './VendorsTooltip';

interface Props {
  filteredVendors: Vendor[];
  users: User[];
  directions: Direction[];
  startEdit: (vendor: Vendor, readOnly?: boolean) => void;
  askDelete: (id: string, name: string) => void;
  selectedVendors: string[];
  setSelectedVendors: React.Dispatch<React.SetStateAction<string[]>>;
  managedCols: ManagedColumn[];
  communications: Communication[];
  serverTotalCount?: number;
  page?: number;
  onPageChange?: (newPage: number) => void;
  isLoading?: boolean;
}

export default function VendorsList({
  filteredVendors,
  users,
  directions = [],
  startEdit,
  selectedVendors = [],
  setSelectedVendors,
  managedCols = [],
  communications = [],
  serverTotalCount,
  page,
  onPageChange,
  isLoading
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
    company_name: {
      header: t('Legal Name'),
      key: 'company_name',
      className: 'min-w-[150px] max-w-[200px]',
      render: (vendor) => <div className="truncate" title={vendor.company_name}>{vendor.company_name}</div>
    },
    status: {
      header: t('Status'),
      key: 'status',
      render: (vendor) => {
        const stat = vendor.status || 'Active';
        const colorMap: Record<string, string> = {
          'Active': 'bg-emerald-50 text-emerald-700 border-emerald-200',
          'Under Negotiation': 'bg-amber-50 text-amber-700 border-amber-200',
          'Seasonal': 'bg-blue-50 text-blue-700 border-blue-200',
          'Closed': 'bg-rose-50 text-rose-700 border-rose-200',
          'Unclear': 'bg-slate-50 text-slate-700 border-slate-200'
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
      header: t('Address'),
      key: 'location',
      className: 'min-w-[220px]',
      render: (vendor) => {
        const text = `${vendor.city} (${vendor.district}), ${vendor.address}`;
        return <div className="truncate" title={text}>{text}</div>
      }
    },
    direction: {
      header: t('Direction'),
      key: 'direction_id',
      render: (vendor) => {
        const d = directions.find(dir => dir.id === vendor.direction_id);
        return d ? d.name : '-';
      }
    },
    overdue_threshold_days: {
      header: t('overdue_threshold_days'),
      key: 'overdue_threshold_days',
      render: (vendor) => vendor.overdue_threshold_days || '-'
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
                    const matchedUser = users.find(u => 
                      (c.created_by && (u.id === c.created_by || u.id?.toLowerCase() === c.created_by?.toLowerCase() || u.email?.toLowerCase() === c.created_by?.toLowerCase() || u.name?.toLowerCase() === c.created_by?.toLowerCase())) ||
                      (c.user_id && (u.id === c.user_id || u.id?.toLowerCase() === c.user_id?.toLowerCase()))
                    );
                    return {
                      key: c.id,
                      author: matchedUser?.name || c.user_name || (c.created_by && !c.created_by.includes('-') ? c.created_by : '') || t('System'),
                      date: formatDateTime(c.date_time),
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
                    date: formatDate(c.date),
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
    className: 'w-12 text-center',
    render: (vendor) => {
      const isChecked = selectedVendors.includes(vendor.id);
      return (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center w-full h-full bg-transparent">
          <button
            type="button"
            onClick={() => toggleSelect(vendor.id)}
            className={`w-4 h-4 rounded border flex items-center justify-center p-0 shrink-0 mx-auto cursor-pointer ${
              isChecked
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
          >
            {isChecked && <Check size={11} strokeWidth={3.5} className="shrink-0 leading-none" />}
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

  const rowClassName = (vendor: Vendor) => {
    const isChecked = selectedVendors.includes(vendor.id);
    return isChecked ? 'bg-emerald-50/70 hover:bg-emerald-100/70' : 'hover:bg-slate-50';
  };

  return (
    <>
      <StandardTable
        data={filteredVendors}
        columns={columns}
        onRowClick={handleRowClick}
        rowClassName={rowClassName}
        emptyMessage={t("No supplier data matches current search criteria.")}
        serverTotalCount={serverTotalCount}
        page={page}
        onPageChange={onPageChange}
        isLoading={isLoading}
      />

      {hoveredTooltip && (
        <VendorsTooltip
          items={hoveredTooltip.items}
          rect={hoveredTooltip.rect}
        />
      )}
    </>
  );
}
