import React, { useState } from 'react';
import { Vendor, User, VendorComment } from '../../types';
import { Edit3, Trash2, MessageSquare } from 'lucide-react';

interface Props {
  filteredVendors: Vendor[];
  users: User[];
  startEdit: (vendor: Vendor) => void;
  askDelete: (id: string, name: string) => void;
}

export default function VendorsList({
  filteredVendors,
  users,
  startEdit,
  askDelete
}: Props) {
  // Hover state for comment tooltip to render nicely outside overflow boundaries
  const [hoveredComments, setHoveredComments] = useState<{
    comments: VendorComment[];
    rect: { top: number; left: number; width: number; height: number } | null;
  } | null>(null);

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-700">
            <thead>
              <tr className="border-b border-gray-200 text-[10px] text-gray-400 uppercase font-mono bg-slate-50 select-none">
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
            <tbody className="divide-y divide-gray-200">
              {filteredVendors.map((vendor) => {
                const manager = users.find(u => u.id === vendor.manager_id);
                const dispatcher = users.find(u => u.id === vendor.operator_id);
                const defaultContact = (vendor.contacts || []).find(c => c.is_default);
                const additionalContacts = (vendor.contacts || []).filter(c => !c.is_default);
                
                // Retrieve latest comments safely
                const latestComment = vendor.comments && vendor.comments.length > 0 
                  ? vendor.comments[0] 
                  : null;

                return (
                  <tr key={vendor.id} className="hover:bg-slate-50/50">
                    {/* Trade Name */}
                    <td className="py-3 px-4">
                      <span className="font-extrabold text-gray-900 block text-[13px]">{vendor.trade_name}</span>
                      <span className="text-[10px] text-gray-400 block truncate max-w-[150px]" title={vendor.company_name}>{vendor.company_name}</span>
                    </td>

                    {/* Taxation ID */}
                    <td className="py-3 px-4 font-mono font-bold text-gray-550 select-all">
                      {vendor.id_code}
                    </td>

                    {/* Rate */}
                    <td className="py-3 px-4 font-mono font-extrabold text-emerald-800 text-[12px]">
                      ₾ {vendor.price_per_liter.toFixed(2)}
                    </td>

                    {/* Working Hours */}
                    <td className="py-3 px-4 font-sans text-gray-550 font-semibold select-none">
                      {vendor.working_hours}
                    </td>

                    {/* Location */}
                    <td className="py-3 px-4 font-sans">
                      <span className="font-bold text-gray-700 block">{vendor.city} ({vendor.district})</span>
                      <span className="text-[10px] text-gray-400 block truncate max-w-[200px]" title={vendor.address}>{vendor.address}</span>
                    </td>

                    {/* Code Assigned by Us */}
                    <td className="py-3 px-4 font-mono text-gray-500">
                      {vendor.company_code || <span className="text-gray-300">-</span>}
                    </td>

                    {/* Primary Phone */}
                    <td className="py-3 px-4 font-sans text-[11px]">
                      {defaultContact ? (
                        <div>
                          <span className="font-extrabold text-gray-800 block">{defaultContact.name}</span>
                          <span className="text-emerald-800 font-mono font-bold block bg-emerald-50 px-1.5 py-0.5 rounded w-fit mt-0.5 select-all">{defaultContact.phone}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-semibold bg-gray-50 px-1 rounded">No Primary Contact</span>
                      )}
                    </td>

                    {/* Additional Phones */}
                    <td className="py-3 px-4 font-sans text-[10px]">
                      {additionalContacts.length > 0 ? (
                        <div className="space-y-1">
                          {additionalContacts.map(c => (
                            <div key={c.id} className="leading-tight">
                              <span className="font-bold text-gray-600 block">{c.name} ({c.position}):</span>
                              <span className="text-emerald-800 font-mono font-bold select-all">{c.phone}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* Acquisition Manager */}
                    <td className="py-3 px-4 text-gray-700 font-sans">
                      {manager?.name ? (
                        <span className="font-semibold">{manager.name}</span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* Systems Dispatcher */}
                    <td className="py-3 px-4 text-gray-700 font-sans">
                      {dispatcher?.name ? (
                        <span className="font-semibold">{dispatcher.name}</span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* Comment section */}
                    <td 
                      className="py-3 px-4 text-left relative select-none min-w-[160px] cursor-pointer"
                      onMouseEnter={(e) => {
                        if (latestComment && vendor.comments && vendor.comments.length > 0) {
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
                        <div className="max-w-[150px]">
                          <p className="truncate font-sans text-gray-650 inline-flex items-center gap-1">
                            <MessageSquare size={11} className="text-emerald-500 animate-pulse" />
                            {latestComment.comment}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic font-sans">No comments</span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1 select-none">
                        <button 
                          onClick={() => startEdit(vendor)}
                          className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                          title="Edit supplier properties"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button 
                          onClick={() => askDelete(vendor.id, vendor.trade_name)}
                          className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                          title="Soft delete supplier"
                        >
                          <Trash2 size={13} />
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
          <div className="text-center py-20 text-xs text-gray-400 italic">
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
          className="w-80 bg-slate-100/95 backdrop-blur-md border border-slate-200 text-slate-800 rounded-xl p-3.5 shadow-xl text-[11.5px] leading-relaxed z-50 space-y-2 pointer-events-none select-none transition-all duration-150"
        >
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1 select-text">
            {hoveredComments.comments.map(c => (
              <div key={c.id} className="border-b border-slate-200 last:border-0 pb-1.5 last:pb-0 font-sans">
                <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold mb-0.5 font-sans">
                  <span className="text-emerald-800 font-sans">{c.user_name}</span>
                  <span>{new Date(c.date).toLocaleString()}</span>
                </div>
                <p className="font-sans text-slate-700 break-words">{c.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
