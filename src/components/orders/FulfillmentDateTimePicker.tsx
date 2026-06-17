import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface FulfillmentDateTimePickerProps {
  value?: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

export default function FulfillmentDateTimePicker({
  value,
  onChange,
  disabled = false
}: FulfillmentDateTimePickerProps) {
  // Internal states
  const [pickupHour, setPickupHour] = useState('12');
  const [pickupMin, setPickupMin] = useState('00');
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());

  // Parse ISO value when it changes
  useEffect(() => {
    if (value) {
      try {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
          setPickupHour(d.getHours().toString().padStart(2, '0'));
          setPickupMin(d.getMinutes().toString().padStart(2, '0'));
          setSelectedDay(d.getDate().toString());
          setSelectedMonth((d.getMonth() + 1).toString());

          const today = new Date();
          if (d.toDateString() !== today.toDateString()) {
            setUseCustomDate(true);
          } else {
            setUseCustomDate(false);
          }
        }
      } catch (e) {
        console.error('Error parsing fulfillment datetime:', e);
      }
    } else {
      setPickupHour('12');
      setPickupMin('00');
      setUseCustomDate(false);
      setSelectedDay(new Date().getDate().toString());
      setSelectedMonth((new Date().getMonth() + 1).toString());
    }
  }, [value]);

  // Propagate changes to the parent ISO string
  const updateParent = (h: string, m: string, custom: boolean, dayStr: string, monthStr: string) => {
    const year = new Date().getFullYear();
    const finalDate = new Date();
    if (custom) {
      finalDate.setFullYear(year, parseInt(monthStr) - 1, parseInt(dayStr));
    }
    finalDate.setHours(parseInt(h), parseInt(m), 0, 0);
    onChange(finalDate.toISOString());
  };

  const daysList = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  const monthsList = [
    { value: '1', name: 'January' },
    { value: '2', name: 'February' },
    { value: '3', name: 'March' },
    { value: '4', name: 'April' },
    { value: '5', name: 'May' },
    { value: '6', name: 'June' },
    { value: '7', name: 'July' },
    { value: '8', name: 'August' },
    { value: '9', name: 'September' },
    { value: '10', name: 'October' },
    { value: '11', name: 'November' },
    { value: '12', name: 'December' },
  ];

  return (
    <div className="bg-white border border-emerald-100 rounded-2xl p-6 space-y-5 animate-in slide-in-from-top-3 duration-150">
      <div className="border-b pb-2 flex items-center justify-between">
        <span className="text-xs font-black uppercase text-emerald-800 tracking-wider font-sans block">1. Fulfillment Clock & Calendar Details</span>
        <span className="text-[10px] bg-emerald-50 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded">PRIORITY UX</span>
      </div>

      <div className="space-y-4 font-sans">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
            <Clock size={12} className="text-emerald-700" /> Specify Pickup Time First *
          </label>
          <div className="flex gap-3 max-w-xs items-center font-mono">
            <select
              value={pickupHour}
              disabled={disabled}
              onChange={(e) => {
                const nextVal = e.target.value;
                setPickupHour(nextVal);
                updateParent(nextVal, pickupMin, useCustomDate, selectedDay, selectedMonth);
              }}
              className="flex-1 px-3 py-2 bg-slate-50 border border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl text-sm font-extrabold focus:outline-none select-none text-center disabled:opacity-50"
            >
              {Array.from({ length: 24 }).map((_, h) => {
                const val = h.toString().padStart(2, '0');
                return <option key={val} value={val}>{val} Hours</option>;
              })}
            </select>
            
            <span className="text-lg font-black text-emerald-800">:</span>
            
            <select
              value={pickupMin}
              disabled={disabled}
              onChange={(e) => {
                const nextVal = e.target.value;
                setPickupMin(nextVal);
                updateParent(pickupHour, nextVal, useCustomDate, selectedDay, selectedMonth);
              }}
              className="flex-1 px-3 py-2 bg-slate-50 border border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl text-sm font-extrabold focus:outline-none select-none text-center disabled:opacity-50"
            >
              {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(val => (
                <option key={val} value={val}>{val} Mins</option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-55 flex flex-col space-y-3.5">
          <div className="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-xl">
            <div className="text-left">
              <span className="text-xs font-bold text-gray-800 block">Override Standard Date Selection?</span>
              <span className="text-[10px] text-gray-400 font-sans block">By default, order registers today's date context.</span>
            </div>
            
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                const nextVal = !useCustomDate;
                setUseCustomDate(nextVal);
                updateParent(pickupHour, pickupMin, nextVal, selectedDay, selectedMonth);
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-155 ease-in-out focus:outline-none disabled:opacity-50 ${
                useCustomDate ? 'bg-emerald-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-155 ease-in-out ${
                  useCustomDate ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {useCustomDate && (
            <div className="grid grid-cols-2 gap-3.5 max-w-sm pt-2 p-3 bg-slate-50 rounded-xl animate-in slide-in-from-top-1.5">
              <div className="relative">
                <span className="absolute -top-1.5 left-2 px-1 text-[8.5px] font-black text-gray-400 bg-slate-50 uppercase tracking-widest">Day</span>
                <select
                  value={selectedDay}
                  disabled={disabled}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setSelectedDay(nextVal);
                    updateParent(pickupHour, pickupMin, useCustomDate, nextVal, selectedMonth);
                  }}
                  className="block w-full px-3 py-2 bg-white border border-gray-205 focus:border-emerald-500 rounded-xl text-xs font-bold focus:outline-none disabled:opacity-50"
                >
                  {daysList.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="relative">
                <span className="absolute -top-1.5 left-2 px-1 text-[8.5px] font-black text-gray-400 bg-slate-50 uppercase tracking-widest">Month</span>
                <select
                  value={selectedMonth}
                  disabled={disabled}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setSelectedMonth(nextVal);
                    updateParent(pickupHour, pickupMin, useCustomDate, selectedDay, nextVal);
                  }}
                  className="block w-full px-3 py-2 bg-white border border-gray-205 focus:border-emerald-500 rounded-xl text-xs font-bold focus:outline-none disabled:opacity-50"
                >
                  {monthsList.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
