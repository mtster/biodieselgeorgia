import React, { useState, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { t } from '../utils/lang';
import { FormInput } from './FormInput';

interface PeriodFilterProps {
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  labelBgClass?: string;
}

interface DateValidationResult {
  isValid: boolean;
  isoDate: string | null;
  dayError: boolean;
  monthError: boolean;
  errorMessage: string | null;
}

export function validateDateString(val: string): DateValidationResult {
  const trimmed = val.trim();
  if (!trimmed) {
    return { isValid: false, isoDate: null, dayError: false, monthError: false, errorMessage: null };
  }

  const parts = trimmed.split('/');
  const dStr = parts[0] || '';
  const mStr = parts[1] || '';
  const yStr = parts[2] || '';

  let dayError = false;
  let monthError = false;
  let errorMsg: string | null = null;

  // Day validation (when 2 digits are entered)
  if (dStr.length === 2) {
    const dNum = parseInt(dStr, 10);
    if (isNaN(dNum) || dNum < 1 || dNum > 31) {
      dayError = true;
    }
  }

  // Month validation (when 2 digits are entered)
  if (mStr.length === 2) {
    const mNum = parseInt(mStr, 10);
    if (isNaN(mNum) || mNum < 1 || mNum > 12) {
      monthError = true;
    }
  }

  // Check days in specific month if both day and month are 2 digits
  if (!dayError && !monthError && dStr.length === 2 && mStr.length === 2) {
    const dNum = parseInt(dStr, 10);
    const mNum = parseInt(mStr, 10);
    const yNum = yStr.length === 4 ? parseInt(yStr, 10) : 2024;
    const daysInMonth = new Date(yNum, mNum, 0).getDate();
    if (dNum > daysInMonth) {
      dayError = true;
      errorMsg = `არასწორი დღე: ${dStr} (მაქს. ${daysInMonth})`;
    }
  }

  if (dayError && monthError) {
    errorMsg = `არასწორი დღე (${dStr}) და თვე (${mStr})`;
  } else if (dayError && !errorMsg) {
    errorMsg = `არასწორი დღე: ${dStr} (მაქს. 31)`;
  } else if (monthError && !errorMsg) {
    errorMsg = `არასწორი თვე: ${mStr} (მაქს. 12)`;
  }

  // Full date check (DD/MM/YYYY)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    const dNum = parseInt(d, 10);
    const mNum = parseInt(m, 10);
    const yNum = parseInt(y, 10);

    if (!dayError && !monthError && mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      const maxDays = new Date(yNum, mNum, 0).getDate();
      if (dNum <= maxDays) {
        return {
          isValid: true,
          isoDate: `${y}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`,
          dayError: false,
          monthError: false,
          errorMessage: null
        };
      } else {
        return {
          isValid: false,
          isoDate: null,
          dayError: true,
          monthError: false,
          errorMessage: `არასწორი დღე: ${d} (მაქს. ${maxDays})`
        };
      }
    }
  }

  return {
    isValid: false,
    isoDate: null,
    dayError,
    monthError,
    errorMessage: errorMsg
  };
}

export default function PeriodFilter({ startDate, setStartDate, endDate, setEndDate, labelBgClass = 'bg-[#f8fafc]' }: PeriodFilterProps) {
  const [showPresets, setShowPresets] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);
  const hiddenStartPickerRef = useRef<HTMLInputElement>(null);
  const hiddenEndPickerRef = useRef<HTMLInputElement>(null);

  const cleanStartDate = startDate && startDate.includes('T') ? startDate.split('T')[0] : startDate;
  const cleanEndDate = endDate && endDate.includes('T') ? endDate.split('T')[0] : endDate;

  // Formatting helper from ISO YYYY-MM-DD to DD/MM/YYYY
  const toDisplayFormat = (dateVal: string) => {
    if (!dateVal) return '';
    const clean = dateVal.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split('-');
      return `${d}/${m}/${y}`;
    }
    return dateVal;
  };

  // Local display states for typing dd/mm/yyyy
  const [displayStart, setDisplayStart] = useState(() => toDisplayFormat(cleanStartDate));
  const [displayEnd, setDisplayEnd] = useState(() => toDisplayFormat(cleanEndDate));

  // Error message states
  const [startError, setStartError] = useState<string | null>(null);
  const [endError, setEndError] = useState<string | null>(null);

  // Sync visual inputs when parent state changes externally (e.g. presets, reset)
  useEffect(() => {
    if (document.activeElement === startInputRef.current) {
      return;
    }
    const formatted = toDisplayFormat(cleanStartDate);
    setDisplayStart(formatted);
    if (cleanStartDate) {
      setStartError(null);
    }
  }, [cleanStartDate]);

  useEffect(() => {
    if (document.activeElement === endInputRef.current) {
      return;
    }
    const formatted = toDisplayFormat(cleanEndDate);
    setDisplayEnd(formatted);
    if (cleanEndDate) {
      setEndError(null);
    }
  }, [cleanEndDate]);

  // Handle special backspace on '/' to delete the preceding number seamlessly
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    displayVal: string,
    setDisplay: React.Dispatch<React.SetStateAction<string>>,
    setDate: (v: string) => void,
    setError: React.Dispatch<React.SetStateAction<string | null>>,
    inputEl: HTMLInputElement | null
  ) => {
    if (e.key === 'Backspace' && inputEl) {
      const start = inputEl.selectionStart || 0;
      const end = inputEl.selectionEnd || 0;
      // If cursor is right after a slash ('02/|...' or '02/11/|...') and no text selected
      if (start === end && (start === 3 || start === 6) && displayVal[start - 1] === '/') {
        e.preventDefault();
        // Remove the digit before the slash (e.g. at start - 2)
        const newVal = displayVal.slice(0, start - 2) + displayVal.slice(start - 1);
        const rawDigits = newVal.replace(/\D/g, '').slice(0, 8);
        const digitsBeforeCursor = Math.max(0, (displayVal.slice(0, start - 2).replace(/\D/g, '')).length);

        let formatted = '';
        if (rawDigits.length === 0) {
          formatted = '';
        } else if (rawDigits.length <= 2) {
          formatted = rawDigits;
        } else if (rawDigits.length <= 4) {
          formatted = `${rawDigits.slice(0, 2)}/${rawDigits.slice(2)}`;
        } else {
          formatted = `${rawDigits.slice(0, 2)}/${rawDigits.slice(2, 4)}/${rawDigits.slice(4)}`;
        }

        setDisplay(formatted);

        let newCursor = 0;
        let countedDigits = 0;
        for (let i = 0; i < formatted.length; i++) {
          if (countedDigits >= digitsBeforeCursor) {
            break;
          }
          if (/\d/.test(formatted[i])) {
            countedDigits++;
          }
          newCursor = i + 1;
        }

        requestAnimationFrame(() => {
          if (inputEl) {
            inputEl.setSelectionRange(newCursor, newCursor);
          }
        });

        if (!formatted) {
          setError(null);
          setDate('');
        } else {
          const valResult = validateDateString(formatted);
          if (valResult.isValid && valResult.isoDate) {
            setError(null);
            setDate(valResult.isoDate);
          } else if (valResult.errorMessage) {
            setError(valResult.errorMessage);
            setDate('');
          } else {
            setError(null);
            if (formatted.length < 10) {
              setDate('');
            }
          }
        }
      }
    }
  };

  // Robust date formatter with smart cursor position calculation & live validation
  const handleInputChangeWithCursor = (
    e: React.ChangeEvent<HTMLInputElement>,
    setDisplay: React.Dispatch<React.SetStateAction<string>>,
    setDate: (v: string) => void,
    setError: React.Dispatch<React.SetStateAction<string | null>>,
    inputEl: HTMLInputElement | null
  ) => {
    const rawValue = e.target.value;
    const oldCursor = e.target.selectionStart || 0;

    // Count how many digits existed before the cursor in the typed text
    const digitsBeforeCursor = rawValue.slice(0, oldCursor).replace(/\D/g, '').length;

    // Extract all digits (capped at 8 for DDMMYYYY)
    const digits = rawValue.replace(/\D/g, '').slice(0, 8);

    let formatted = '';
    if (digits.length === 0) {
      formatted = '';
    } else if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }

    setDisplay(formatted);

    // Calculate new cursor position based on digits before cursor
    let newCursor = 0;
    let countedDigits = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (countedDigits >= digitsBeforeCursor) {
        break;
      }
      if (/\d/.test(formatted[i])) {
        countedDigits++;
      }
      newCursor = i + 1;
    }

    // Preserve cursor accurately after React rerender
    requestAnimationFrame(() => {
      if (inputEl) {
        inputEl.setSelectionRange(newCursor, newCursor);
      }
    });

    // Instant validation check
    if (!formatted) {
      setError(null);
      setDate('');
      return;
    }

    const valResult = validateDateString(formatted);
    if (valResult.isValid && valResult.isoDate) {
      setError(null);
      setDate(valResult.isoDate);
    } else if (valResult.errorMessage) {
      setError(valResult.errorMessage);
      setDate('');
    } else {
      // Typing in progress, no error detected yet
      setError(null);
      if (formatted.length < 10) {
        setDate('');
      }
    }
  };

  const handleBlurValidation = (
    currentDisplay: string,
    setDate: (v: string) => void,
    setError: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    if (!currentDisplay.trim()) {
      setError(null);
      setDate('');
      return;
    }

    const valResult = validateDateString(currentDisplay);
    if (valResult.isValid && valResult.isoDate) {
      setError(null);
      setDate(valResult.isoDate);
    } else if (valResult.errorMessage) {
      setError(valResult.errorMessage);
      setDate('');
    } else if (currentDisplay.trim().length < 10) {
      setError('არასრული თარიღი');
      setDate('');
    }
  };

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
    setStartError(null);
    setEndError(null);
    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
    setShowPresets(false);
  };

  const getPresetDates = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    return [
      { label: 'Today', start: today, end: today },
      { label: 'Yesterday', start: yesterday, end: yesterday },
      { label: 'Tomorrow', start: tomorrow, end: tomorrow },
    ];
  };

  const isPresetSelected = (pStart: Date, pEnd: Date) => {
    return cleanStartDate === formatDate(pStart) && cleanEndDate === formatDate(pEnd);
  };

  const openNativePicker = (inputRef: React.RefObject<any>) => {
    const el = inputRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === 'function') {
        el.showPicker();
        return;
      }
    } catch {
      // ignore
    }
    try {
      el.focus();
      el.click();
    } catch {
      // ignore
    }
  };

  return (
    <div ref={containerRef} className="flex items-start gap-1.5 relative">
      <FormInput
        ref={startInputRef}
        type="text"
        placeholder="DD/MM/YYYY"
        label={t("Start Date")}
        value={displayStart}
        error={startError || undefined}
        labelBgClass={labelBgClass}
        onKeyDown={(e) => handleKeyDown(e, displayStart, setDisplayStart, setStartDate, setStartError, startInputRef.current)}
        onChange={(e) => handleInputChangeWithCursor(e, setDisplayStart, setStartDate, setStartError, startInputRef.current)}
        onBlur={() => handleBlurValidation(displayStart, setStartDate, setStartError)}
        containerClassName="w-[130px] flex-shrink-0"
        className="pr-8"
      >
        <div className="group absolute right-2 top-0 h-full flex items-center justify-center z-10">
          <input
            type="date"
            ref={hiddenStartPickerRef}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-20"
            tabIndex={-1}
            aria-label={t("Start Date")}
            value={cleanStartDate || ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                setStartDate(val);
                setDisplayStart(toDisplayFormat(val));
                setStartError(null);
              }
            }}
          />
          <div
            className="p-1 text-gray-400 group-hover:text-gray-700 transition-colors duration-150 flex items-center justify-center pointer-events-none"
            title={t("Select Date")}
          >
            <Calendar size={15} />
          </div>
        </div>
      </FormInput>

      <button
        type="button"
        onClick={() => setShowPresets(!showPresets)}
        className={`p-2 rounded-lg transition flex items-center justify-center h-[38px] mt-0.5 ${
          cleanStartDate || cleanEndDate
            ? 'text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 shadow-sm font-semibold'
            : 'text-emerald-800 hover:bg-emerald-50'
        }`}
        title={t("Presets")}
      >
        <Calendar size={20} />
      </button>

      {showPresets && (
        <div className="absolute top-full left-8 mt-2 bg-white border border-gray-100 rounded-xl shadow-lg z-50 w-52 p-2.5 space-y-1.5 max-h-80 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              setStartError(null);
              setEndError(null);
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
                type="button"
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
        ref={endInputRef}
        type="text"
        placeholder="DD/MM/YYYY"
        label={t("End Date")}
        value={displayEnd}
        error={endError || undefined}
        labelBgClass={labelBgClass}
        onKeyDown={(e) => handleKeyDown(e, displayEnd, setDisplayEnd, setEndDate, setEndError, endInputRef.current)}
        onChange={(e) => handleInputChangeWithCursor(e, setDisplayEnd, setEndDate, setEndError, endInputRef.current)}
        onBlur={() => handleBlurValidation(displayEnd, setEndDate, setEndError)}
        containerClassName="w-[130px] flex-shrink-0"
        className="pr-8"
      >
        <div className="group absolute right-2 top-0 h-full flex items-center justify-center z-10">
          <input
            type="date"
            ref={hiddenEndPickerRef}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-20"
            tabIndex={-1}
            aria-label={t("End Date")}
            value={cleanEndDate || ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                setEndDate(val);
                setDisplayEnd(toDisplayFormat(val));
                setEndError(null);
              }
            }}
          />
          <div
            className="p-1 text-gray-400 group-hover:text-gray-700 transition-colors duration-150 flex items-center justify-center pointer-events-none"
            title={t("Select Date")}
          >
            <Calendar size={15} />
          </div>
        </div>
      </FormInput>
    </div>
  );
}
