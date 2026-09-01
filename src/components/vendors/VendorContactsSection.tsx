import React, { useState } from 'react';
import { t } from '../../utils/lang';
import { VendorContact } from '../../types';
import AddButton from '../AddButton';
import { Plus, Phone, Star, Pencil, GripVertical } from 'lucide-react';

interface VendorContactsSectionProps {
  contacts: VendorContact[];
  onAddContact: () => void;
  onModifyContact: (c: VendorContact) => void;
  onTogglePrimaryContact: (id: string) => void;
  onReorderContacts: (startIndex: number, endIndex: number) => void;
  error?: string;
}

export default function VendorContactsSection({
  contacts,
  onAddContact,
  onModifyContact,
  onTogglePrimaryContact,
  onReorderContacts,
  error
}: VendorContactsSectionProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    onReorderContacts(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const formatPosition = (pos?: string) => {
    if (!pos) return '';
    if (pos === 'other' || pos === 'Other' || pos === 'Other Position') return t('Other Position');
    if (pos === 'director') return t('Director/Owner');
    if (pos === 'manager') return t('Manager');
    if (pos === 'object_number') return t('Object Number');
    if (pos === 'accountant') return t('Accountant');
    if (pos === 'cook') return t('Cook');
    return t(pos) || pos;
  };

  return (
    <div className={`bg-white p-5 border ${error ? 'border-red-500' : 'border-gray-100'} rounded-2xl flex flex-col justify-between`} id="vendor-extra-contacts">
      <div>
        <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
          <span className="text-xs font-bold uppercase text-gray-500 tracking-wider font-sans">
            {t("Contacts")}
          </span>
          <AddButton
            label="Add Contact"
            onClick={onAddContact}
          />
        </div>

        {error && (
          <p className="text-[10px] text-red-600 font-bold mb-3 px-1">{error}</p>
        )}

        <div className="space-y-2.5 max-h-[224px] overflow-y-auto pr-1">
          {contacts.map((c, index) => {
            const isDraggable = !c.is_default;
            const isInactive = c.is_active === false;
            return (
              <div
                key={c.id}
                draggable={isDraggable}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs text-left group transition-all duration-200 ${
                  draggedIndex === index ? 'opacity-40 border-dashed border-emerald-300 bg-emerald-50/20' : ''
                } ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                <div className="flex gap-2 items-center min-w-0 flex-1">
                  {isDraggable ? (
                    <div className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing p-0.5">
                      <GripVertical size={14} />
                    </div>
                  ) : (
                    <div className="w-[18px]" /> // Spacer to align
                  )}
                  <div className="flex gap-2 items-center min-w-0 flex-1 overflow-hidden">
                    <span className="font-extrabold text-gray-800 truncate flex-1 min-w-0">
                      {c.name}
                    </span>
                    <span className="text-[10px] text-gray-400 font-sans uppercase font-semibold truncate shrink min-w-[5ch]" title={formatPosition(c.position)}>
                      {formatPosition(c.position)}
                    </span>
                    {isInactive && (
                      <span className="text-[9.5px] bg-amber-50 text-amber-700 border border-amber-200/60 font-semibold px-1.5 py-0.5 rounded-md shrink-0">
                        {t("Inactive")}
                      </span>
                    )}
                    <span className="text-[10.5px] text-emerald-800 font-mono font-bold select-all inline-flex items-center gap-1 ml-1 shrink-0">
                      <Phone size={10} /> {c.phone}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 select-none text-right shrink-0">
                  {/* Star design toggle next to edit button */}
                  <button
                    type="button"
                    onClick={() => onTogglePrimaryContact(c.id)}
                    title={c.is_default ? t("Primary Contact") : t("Mark as Primary")}
                    className={`p-1.5 transition cursor-pointer rounded-lg hover:bg-slate-100 ${
                      c.is_default ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-500'
                    }`}
                  >
                    <Star size={13} fill={c.is_default ? "#fbbf24" : "none"} strokeWidth={2} />
                  </button>

                  {/* Sleek borderless pencil edit button */}
                  <button
                    type="button"
                    onClick={() => onModifyContact(c)}
                    className="p-1.5 text-gray-400 hover:text-emerald-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    title={t("Modify")}
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {contacts.length === 0 && !error && (
            <div className="text-center py-10 text-gray-400 text-xs italic font-sans">
              {t("No contacts recorded.")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
