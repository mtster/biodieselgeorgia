import React, { useState, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { t } from '../utils/lang';

interface PeriodFilterProps {
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
}

export default function PeriodFilter({ startDate, setStartDate, endDate, setEndDate }: PeriodFilterProps) {
  const [showPresets, setShowPresets] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanStartDate = startDate && startDate.includes('T') ? startDate.split('T')[0] : startDate;
  const cleanEndDate = endDate && endDate.includes('T') ? endDate.split('T')[0] : endDate;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPresets(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleApplyPreset = (start: Date, end: Date) => {
    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
    setShowPresets(false);
  };

  const getPresetDates = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    
    // Week calculations
    const day = today.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - diff);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const presets = [
        { label: 'Today', start: today, end: today },
        { label: 'Yesterday', start: yesterday, end: yesterday },
        { label: 'Tomorrow', start: tomorrow, end: tomorrow },
        { label: 'This Week', start: startOfWeek, end: endOfWeek },
        { label: 'Last Week', start: startOfLastWeek, end: endOfLastWeek },
        { label: 'This Month', start: startOfMonth, end: endOfMonth },
    ];

    // Previous 12 months
    for (let i = 1; i <= 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        presets.push({ label: d.toLocaleString('default', { month: 'long' }), start, end });
    }

    return presets;
  };

  return (
    <div ref={containerRef} className="flex items-center gap-2 relative">
      <div className="relative w-full md:w-auto min-w-[140px]">
        <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">{t("Start Date")}</span>
        <input type="date" value={cleanStartDate} onChange={(e) => setStartDate(e.target.value)} className="block w-full py-2 pl-3 pr-3 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 font-sans h-[38px]" />
      </div>

      <button
        onClick={() => setShowPresets(!showPresets)}
        className="p-2 text-emerald-800 hover:bg-emerald-50 rounded-lg transition"
      >
        <Calendar size={20} />
      </button>

      {showPresets && (
        <div className="absolute top-full left-12 mt-2 bg-white border border-gray-100 rounded-xl shadow-lg z-50 w-48 p-2 space-y-1">
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setShowPresets(false);
            }}
            className="w-full text-left px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            {t("Clear Dates")}
          </button>
          <div className="border-t border-gray-100 my-1"></div>
          {getPresetDates().map(p => (
            <button
              key={p.label}
              onClick={() => handleApplyPreset(p.start, p.end)}
              className="w-full text-left px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-emerald-50 rounded-lg transition hover:text-emerald-850"
            >
              {t(p.label)}
            </button>
          ))}
        </div>
      )}

      <div className="relative w-full md:w-auto min-w-[140px]">
        <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">{t("End Date")}</span>
        <input type="date" value={cleanEndDate} onChange={(e) => setEndDate(e.target.value)} className="block w-full py-2 pl-3 pr-3 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 font-sans h-[38px]" />
      </div>
    </div>
  );
}
