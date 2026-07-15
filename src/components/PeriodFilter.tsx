import React, { useState, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { t } from '../utils/lang';
import { FormInput } from './FormInput';

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

  // Formatting helpers
  const toDisplayFormat = (dateVal: string) => {
    if (!dateVal) return '';
    const clean = dateVal.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split('-');
      return `${d}/${m}/${y}`;
    }
    return dateVal;
  };

  const toStateFormat = (displayVal: string) => {
    if (!displayVal) return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(displayVal)) {
      const [d, m, y] = displayVal.split('/');
      return `${y}-${m}-${d}`;
    }
    return displayVal;
  };

  // Local display states for typing dd/mm/yyyy
  const [displayStart, setDisplayStart] = useState('');
  const [displayEnd, setDisplayEnd] = useState('');

  // Sync visual inputs when parent state changes
  useEffect(() => {
    setDisplayStart(toDisplayFormat(cleanStartDate));
  }, [cleanStartDate]);

  useEffect(() => {
    setDisplayEnd(toDisplayFormat(cleanEndDate));
  }, [cleanEndDate]);

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

    // Previous 12 months (force 'en-US' locale to output standard English month names translation-safe)
    for (let i = 1; i <= 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        presets.push({ label: d.toLocaleString('en-US', { month: 'long' }), start, end });
    }

    return presets;
  };

  const isPresetSelected = (pStart: Date, pEnd: Date) => {
    return cleanStartDate === formatDate(pStart) && cleanEndDate === formatDate(pEnd);
  };

  return (
    <div ref={containerRef} className="flex items-center gap-2 relative">
      <FormInput
        type="text"
        placeholder="DD/MM/YYYY"
        label={t("Start Date")}
        value={displayStart}
        onChange={(e) => {
          const val = e.target.value;
          setDisplayStart(val);
          if (!val) {
            setStartDate('');
          } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
            setStartDate(toStateFormat(val));
          }
        }}
        onBlur={() => {
          if (!displayStart) {
            setStartDate('');
          } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(displayStart)) {
            setStartDate(toStateFormat(displayStart));
          } else {
            // Attempt generic parse
            const d = new Date(displayStart);
            if (!isNaN(d.getTime())) {
              setStartDate(formatDate(d));
            }
          }
        }}
        containerClassName="w-full md:w-auto min-w-[140px]"
      />

      <button
        onClick={() => setShowPresets(!showPresets)}
        className={`p-2 rounded-lg transition flex items-center justify-center h-[38px] ${
          cleanStartDate || cleanEndDate
            ? 'text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 shadow-sm font-semibold'
            : 'text-emerald-800 hover:bg-emerald-50'
        }`}
      >
        <Calendar size={20} />
      </button>

      {showPresets && (
        <div className="absolute top-full left-12 mt-2 bg-white border border-gray-100 rounded-xl shadow-lg z-50 w-52 p-2.5 space-y-1.5">
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
          {getPresetDates().map(p => {
            const selected = isPresetSelected(p.start, p.end);
            return (
              <button
                key={p.label}
                onClick={() => handleApplyPreset(p.start, p.end)}
                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition ${
                  selected
                    ? 'font-bold bg-emerald-600 text-white'
                    : 'font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-850'
                }`}
              >
                {t(p.label)}
              </button>
            );
          })}
        </div>
      )}

      <FormInput
        type="text"
        placeholder="DD/MM/YYYY"
        label={t("End Date")}
        value={displayEnd}
        onChange={(e) => {
          const val = e.target.value;
          setDisplayEnd(val);
          if (!val) {
            setEndDate('');
          } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
            setEndDate(toStateFormat(val));
          }
        }}
        onBlur={() => {
          if (!displayEnd) {
            setEndDate('');
          } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(displayEnd)) {
            setEndDate(toStateFormat(displayEnd));
          } else {
            // Attempt generic parse
            const d = new Date(displayEnd);
            if (!isNaN(d.getTime())) {
              setEndDate(formatDate(d));
            }
          }
        }}
        containerClassName="w-full md:w-auto min-w-[140px]"
      />
    </div>
  );
}
