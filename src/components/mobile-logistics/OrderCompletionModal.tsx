import React, { useState } from 'react';
import { Order, Vendor, User } from '../../types';
import { FormInput } from '../FormInput';
import { ArrowLeft, CheckCircle2, AlertCircle, Check } from 'lucide-react';

interface Props {
  selectedOrder: Order;
  supplier?: Vendor;
  currentUser: User;
  vehiclePlateText: string;
  onClose: () => void;
  onSaveOrder: (updatedOrder: Order) => void;
}

export function OrderCompletionModal({
  selectedOrder,
  supplier,
  currentUser,
  vehiclePlateText,
  onClose,
  onSaveOrder,
}: Props) {
  const [qtyActual, setQtyActual] = useState<string>(
    selectedOrder.qty_requested ? selectedOrder.qty_requested.toString() : ''
  );
  const [tanksBringActual, setTanksBringActual] = useState<string>(
    selectedOrder.tanks_to_bring !== undefined ? selectedOrder.tanks_to_bring.toString() : '0'
  );
  const [tanksLeftActual, setTanksLeftActual] = useState<string>(
    selectedOrder.tanks_to_leave !== undefined ? selectedOrder.tanks_to_leave.toString() : '0'
  );
  const [note, setNote] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<'completed' | 'uncompleted'>('completed');
  const [formError, setFormError] = useState<string>('');

  const handleComplete = () => {
    const liters = parseFloat(qtyActual);
    const left = parseInt(tanksLeftActual, 10);
    const brought = parseInt(tanksBringActual, 10);

    if (isNaN(liters) || liters <= 0) {
      setFormError('გთხოვთ შეიყვანოთ ფაქტობრივი ლიტრების სწორი რაოდენობა');
      return;
    }
    if (isNaN(left) || left < 0 || isNaN(brought) || brought < 0) {
      setFormError('ტანკების რაოდენობა უნდა იყოს მთელი დადებითი რიცხვი');
      return;
    }

    const existingNotes = Array.isArray(selectedOrder.notes) ? selectedOrder.notes : [];
    let updatedNotes = [...existingNotes];

    if (note.trim()) {
      // Author name should be plate number or user name without "Vehicle" prefix
      const authorName = vehiclePlateText || currentUser.name || 'მძღოლი';
      const newComment = {
        id: 'c-' + Math.random().toString(36).substring(2, 9),
        comment: note.trim(),
        date: new Date().toISOString(),
        user_id: currentUser?.id,
        user_name: authorName,
      };
      updatedNotes = [newComment, ...updatedNotes];
    }

    const updatedOrder: Order = {
      ...selectedOrder,
      fact_qty: liters,
      fact_tank_dropoff: left,
      fact_tank_pickup: brought,
      pickup_date_time: new Date().toISOString(),
      notes: updatedNotes,
      status: selectedStatus,
    };

    onSaveOrder(updatedOrder);
    onClose();
  };

  const supplierName = supplier?.trade_name || selectedOrder.vendor_name || 'მიმწოდებელი';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
      {/* Header: Go back button on the LEFT with sleek back arrow, Supplier name on the RIGHT */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <button 
          onClick={onClose}
          title="უკან დაბრუნება"
          className="p-2 text-gray-600 hover:text-gray-900 rounded-xl bg-gray-100 hover:bg-gray-200 cursor-pointer transition flex items-center justify-center shadow-3xs"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="text-right min-w-0 pl-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
            შეკვეთის შესრულება
          </span>
          <h3 className="font-extrabold text-sm text-gray-800 mt-0.5 truncate" title={supplierName}>
            {supplierName}
          </h3>
        </div>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-700 text-xs font-semibold">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Inputs formatted using standard FormInput component */}
      <div className="space-y-4">
        {/* Fact Quantity */}
        <div>
          <FormInput
            label="ფაქტობრივი მოცულობა"
            type="number"
            value={qtyActual}
            onChange={(e) => setQtyActual(e.target.value)}
            fontClass="font-mono font-bold"
          />
          <p className="text-[10px] text-gray-500 font-medium font-mono mt-1 text-left select-none">
            გეგმიური მოცულობა: {selectedOrder.qty_requested || 0} ლ
          </p>
        </div>

        {/* Tanks Bring & Tanks Leave */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FormInput
              label="ფაქტ. წამოღება"
              type="number"
              value={tanksBringActual}
              onChange={(e) => setTanksBringActual(e.target.value)}
              fontClass="font-mono font-bold"
            />
            <p className="text-[10px] text-gray-500 font-medium font-mono mt-1 text-left select-none">
              მოსალოდნელი: {selectedOrder.tanks_to_bring ?? 0}
            </p>
          </div>

          <div>
            <FormInput
              label="ფაქტ. დატოვება"
              type="number"
              value={tanksLeftActual}
              onChange={(e) => setTanksLeftActual(e.target.value)}
              fontClass="font-mono font-bold"
            />
            <p className="text-[10px] text-gray-500 font-medium font-mono mt-1 text-left select-none">
              მოსალოდნელი: {selectedOrder.tanks_to_leave ?? 0}
            </p>
          </div>
        </div>

        {/* Comment Field using FormInput */}
        <div>
          <FormInput
            label="შენიშვნა"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* Status Selection Check Rows */}
        <div className="space-y-2 pt-1">
          <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase block select-none">
            შეკვეთის სტატუსი
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedStatus('uncompleted')}
              className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer select-none ${
                selectedStatus === 'uncompleted'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-2xs'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>დაუსრულებელი</span>
              {selectedStatus === 'uncompleted' && (
                <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center">
                  <Check size={10} strokeWidth={3} />
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSelectedStatus('completed')}
              className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer select-none ${
                selectedStatus === 'completed'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>დასრულებული</span>
              {selectedStatus === 'completed' && (
                <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <Check size={10} strokeWidth={3} />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleComplete}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer border-none"
        >
          <CheckCircle2 size={16} />
          მონაცემების შენახვა და გაგზავნა
        </button>
      </div>
    </div>
  );
}
