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

    // Filter disallowed characters
    let cleanVal = rawVal.replace(/[^0-9]/g, '');

    // Formatter which fills separators as digits are typed
    let formatted = '';
    if (cleanVal.length > 0) {
      if (cleanVal.length <= 2) {
        formatted = cleanVal;
      } else if (cleanVal.length <= 4) {
        formatted = `${cleanVal.slice(0, 2)}:${cleanVal.slice(2)}`;
      } else if (cleanVal.length <= 6) {
        formatted = `${cleanVal.slice(0, 2)}:${cleanVal.slice(2, 4)} - ${cleanVal.slice(4)}`;
      } else {
        formatted = `${cleanVal.slice(0, 2)}:${cleanVal.slice(2, 4)} - ${cleanVal.slice(4, 6)}:${cleanVal.slice(6, 8)}`;
      }
    }

    // Basic Time Validation
    const parts = formatted.match(/(\d{2})(?::(\d{2}))?(?: - (\d{2})(?::(\d{2}))?)?/);
    if (parts) {
      let [_, h1, m1, h2, m2] = parts;
      if (h1 && parseInt(h1) > 23) h1 = "23";
      if (m1 && parseInt(m1) > 59) m1 = "59";
      if (h2 && parseInt(h2) > 23) h2 = "23";
      if (m2 && parseInt(m2) > 59) m2 = "59";
      formatted = `${h1}${m1 ? ':' + m1 : ''}${h2 ? ` - ${h2}${m2 ? ':' + m2 : ''}` : ''}`;
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
