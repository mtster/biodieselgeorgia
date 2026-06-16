import React, { useState, useEffect, useRef } from 'react';

interface WorkingHoursInputProps {
  value: string;
  onChange: (val: string) => void;
}

export function WorkingHoursInput({ value, onChange }: WorkingHoursInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cursorPos, setCursorPos] = useState<number | null>(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (inputRef.current && cursorPos !== null) {
      inputRef.current.setSelectionRange(cursorPos, cursorPos);
      setCursorPos(null);
    }
  }, [cursorPos]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    let rawVal = input.value;

    // Filter disallowed characters: only allow 0-9, colon, hyphen, spaces
    let cleanVal = rawVal.replace(/[^0-9\s:-]/g, '');

    const digitsOnly = cleanVal.replace(/[^0-9]/g, '');
    const hasSpecialChars = /[:\-]/.test(cleanVal);

    let formatted = cleanVal;
    
    // Check if user is typing only numbers sequentially at the end
    const prevDigits = prevValueRef.current.replace(/[^0-9]/g, '');
    const isDeleting = cleanVal.length < prevValueRef.current.length;

    if (!isDeleting) {
      if (digitsOnly.length > 0 && !hasSpecialChars) {
        // User pasted or typed pure number string (e.g., "09001800")
        if (digitsOnly.length >= 8) {
          formatted = `${digitsOnly.slice(0, 2)}:${digitsOnly.slice(2, 4)} - ${digitsOnly.slice(4, 6)}:${digitsOnly.slice(6, 8)}`;
        } else if (digitsOnly.length >= 4) {
          formatted = `${digitsOnly.slice(0, 2)}:${digitsOnly.slice(2, 4)}`;
        }
      } else if (digitsOnly.length > prevDigits.length && digitsOnly.length <= 8) {
        // Incremental helper: user typing digits sequentially without manually adding separators
        const curDigits = digitsOnly;
        if (curDigits.length === 3) {
          formatted = `${curDigits.slice(0, 2)}:${curDigits.slice(2)}`;
        } else if (curDigits.length === 5) {
          formatted = `${curDigits.slice(0, 2)}:${curDigits.slice(2, 4)} - ${curDigits.slice(4)}`;
        } else if (curDigits.length === 7) {
          formatted = `${curDigits.slice(0, 2)}:${curDigits.slice(2, 4)} - ${curDigits.slice(4, 6)}:${curDigits.slice(6)}`;
        }
      }
    }

    // Determine if we need to set the cursor position explicitly
    if (formatted !== rawVal) {
      const selectionStart = input.selectionStart || 0;
      const diff = formatted.length - rawVal.length;
      setCursorPos(selectionStart + diff);
    } else {
      setCursorPos(null); // Let the browser place the cursor naturally
    }

    onChange(formatted);
  };

  return (
    <input
      ref={inputRef}
      id="working-hours-field"
      type="text"
      placeholder="e.g. 09:00 - 18:00"
      value={value}
      onChange={handleChange}
      className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans transition-all"
    />
  );
}
