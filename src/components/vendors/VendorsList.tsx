import React, { useState } from 'react';
import { Vendor, User, VendorComment } from '../../types';
import { Edit3, MessageSquare, Check } from 'lucide-react';

interface Props {
  filteredVendors: Vendor[];
  users: User[];
  startEdit: (vendor: Vendor, readOnly?: boolean) => void;
  askDelete: (id: string, name: string) => void;
  selectedVendors: string[];
  setSelectedVendors: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function VendorsList({
  filteredVendors,
  users,
  startEdit,
  askDelete,
  selectedVendors = [],
  setSelectedVendors
}: Props) {
  // Hover state for comment tooltip
  const [hoveredComments, setHoveredComments] = useState<{
    comments: VendorComment[];
    rect: { top: number; left: number; width: number; height: number } | null;
  } | null>(null);

  const toggleSelect = (vendorId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (selectedVendors.includes(vendorId)) {
      setSelectedVendors(selectedVendors.filter(id => id !== vendorId));
    } else {
      setSelectedVendors([...selectedVendors, vendorId]);
    }
  };

  const handleRowClick = (vendor: Vendor) => {
    // Row click opens edit mode directly with Save & Delete buttons available
    startEdit(vendor, false);
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-700">
            <thead>
              <tr className="border-b border-gray-200 text-[11px] text-gray-400 uppercase font-mono bg-slate-50 select-none">
                <th className="py-3 px-4 w-12 text-center">Sel</th>
                <th className="py-3 px-4">Trade Name</th>
                <th className="py-3 px-4">Taxation ID</th>
                <th className="py-3 px-4">Rate (₾)</th>
                <th className="py-3 px-4">Working Hours</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Assigned Code</th>
                <th className="py-3 px-4">Primary Contact</th>
                <th className="py-3 px-4">Additional Contacts</th>
                <th className="py-3 px-4">Acquisition Mgr</th>
                <th className="py-3 px-4">System Dispatch</th>
                <th className="py-3 px-4">Memos / Internal Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVendors.map((vendor) => {
                const manager = users.find(u => u.id === vendor.manager_id);
                const dispatcher = users.find(u => u.id === vendor.operator_id);
                const defaultContact = (vendor.contacts || []).find(c => c.is_default);
                const additionalContacts = (vendor.contacts || []).filter(c => !c.is_default);
                
                // Retrieve latest comments safely
                const latestComment = vendor.comments && vendor.comments.length > 0 
                  ? vendor.comments[0] 
                  : null;

                const isChecked = selectedVendors.includes(vendor.id);

                return (
                  <tr 
                    key={vendor.id} 
                    onClick={() => handleRowClick(vendor)}
                    className={`transition-colors cursor-pointer select-none ${
                      isChecked 
                        ? 'bg-emerald-50/30 hover:bg-emerald-50/50' 
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Biodiesel Green Styled Checkbox */}
                    <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => toggleSelect(vendor.id, e)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all mx-auto cursor-pointer ${
                          isChecked 
                            ? 'border-emerald-650 bg-emerald-600 text-white' 
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        {isChecked && <Check size={11} strokeWidth={3.5} />}
                      </button>
                    </td>

                    {/* Trade Name */}
                    <td className="py-4 px-4">
                      <span className="font-black text-gray-905 block text-[13.5px] leading-tight group-hover:text-emerald-900">{vendor.trade_name}</span>
                      <span className="text-[10.5px] text-gray-450 block truncate max-w-[170px] mt-0.5" title={vendor.company_name}>{vendor.company_name}</span>
                    </td>

                    {/* Taxation ID */}
                    <td className="py-4 px-4 font-mono font-bold text-gray-600 text-[12px] select-all">
                      {vendor.id_code}
                    </td>

                    {/* Rate */}
                    <td className="py-4 px-4 font-mono font-extrabold text-emerald-800 text-[13px]">
                      ₾ {vendor.price_per_liter.toFixed(2)}
                    </td>

                    {/* Working Hours */}
                    <td className="py-4 px-4 font-sans text-gray-600 font-bold text-[12px]">
                      {vendor.working_hours}
                    </td>

                    {/* Location */}
                    <td className="py-4 px-4 font-sans text-[12.5px]">
                      <span className="font-extrabold text-gray-800 block">{vendor.city} ({vendor.district})</span>
                      <span className="text-[10px] text-gray-450 block truncate max-w-[200px]" title={vendor.address}>{vendor.address}</span>
                    </td>

                    {/* Code Assigned by Us */}
                    <td className="py-4 px-4 font-mono text-gray-550 text-[12px]">
                      {vendor.company_code || <span className="text-gray-300">-</span>}
                    </td>

                    {/* Primary Contact */}
                    <td className="py-4 px-4 font-sans text-[11.5px]" onClick={(e) => e.stopPropagation()}>
                      {defaultContact ? (
                        <div>
                          <span className="font-extrabold text-gray-800 block">{defaultContact.name}</span>
                          <span className="text-emerald-800 font-mono font-bold block bg-emerald-50 px-1.5 py-0.5 rounded w-fit mt-1 select-all text-[11px]">{defaultContact.phone}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-405 font-bold bg-gray-50 px-1.5 py-0.5 rounded">No Contact</span>
                      )}
                    </td>

                    {/* Additional Contact */}
                    <td className="py-4 px-4 font-sans text-[11px]" onClick={(e) => e.stopPropagation()}>
                      {additionalContacts.length > 0 ? (
                        <div className="space-y-1">
                          {additionalContacts.map(c => (
                            <div key={c.id} className="leading-tight">
                              <span className="font-bold text-gray-600 block">{c.name} ({c.position}):</span>
                              <span className="text-emerald-850 font-mono font-bold select-all text-[10.5px]">{c.phone}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* Manager */}
                    <td className="py-4 px-4 text-gray-700 font-sans font-semibold text-[12px]">
                      {manager?.name ? manager.name : <span className="text-gray-300">-</span>}
                    </td>

                    {/* Dispatcher */}
                    <td className="py-4 px-4 text-gray-700 font-sans font-semibold text-[12px]">
                      {dispatcher?.name ? dispatcher.name : <span className="text-gray-300">-</span>}
                    </td>

                    {/* Memos / Comments */}
                    <td 
                      className="py-4 px-4 text-left relative select-none min-w-[150px] max-w-[170px]"
                      onClick={(e) => e.stopPropagation()}
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
                      {latestComment ? (
                        <div className="truncate">
                          <p className="font-sans text-gray-600 inline-flex items-center gap-1">
                            <MessageSquare size={12} className="text-emerald-500 shrink-0" />
                            {latestComment.comment}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[10.5px] text-gray-350 italic font-sans">No comments</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5 select-none animate-fade-in">
                        <button 
                          onClick={() => startEdit(vendor, false)}
                          className="p-1.5 text-gray-400 hover:text-emerald-800 hover:bg-slate-50 rounded-lg transition cursor-pointer border border-transparent hover:border-gray-200"
                          title="Edit supplier properties"
                        >
                          <Edit3 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredVendors.length === 0 && (
          <div className="text-center py-20 text-xs text-gray-400 italic select-none">
            No supplier data matches current search criteria.
          </div>
        )}
      </div>

      {hoveredComments && hoveredComments.comments.length > 0 && hoveredComments.rect && (
        <div 
          style={{
            position: 'fixed',
            top: hoveredComments.rect.top < 220 
              ? `${hoveredComments.rect.top + hoveredComments.rect.height + 8}px` 
              : `${hoveredComments.rect.top - 8}px`,
            left: `${Math.max(16, hoveredComments.rect.left + (hoveredComments.rect.width / 2) - 160)}px`,
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
                <p className="font-sans text-gray-700 break-words">{c.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
