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
    if (inputRef.current && cursorPos !== null) {
      inputRef.current.setSelectionRange(cursorPos, cursorPos);
      setCursorPos(null);
    }
  }, [value, cursorPos]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    let rawVal = input.value;
    const selectionStart = input.selectionStart || 0;

    // Filter disallowed characters: only allow 0-9, :, -, space
    let val = rawVal.replace(/[^0-9\s:-]/g, '');

    // Is deleting?
    const isDeleting = val.length < prevValueRef.current.length;

    // Smart auto format as they type only numbers:
    // If the input has only numbers or they pasted something like 09001800, format it!
    const digitsOnly = val.replace(/[^0-9]/g, '');
    const hasSpecialChars = /[:\-]/.test(val);

    let newVal = val;
    if (!isDeleting && (!hasSpecialChars || digitsOnly.length === val.length)) {
      if (digitsOnly.length > 0) {
        let res = digitsOnly.slice(0, 2);
        if (digitsOnly.length >= 3) res += ':' + digitsOnly.slice(2, 4);
        if (digitsOnly.length >= 5) res += ' - ' + digitsOnly.slice(4, 6);
        if (digitsOnly.length >= 7) res += ':' + digitsOnly.slice(6, 8);
        newVal = res;
      }
    }

    // Determine new cursor position
    let diff = newVal.length - rawVal.length;
    let newCursor = selectionStart + diff;

    // boundary check
    newCursor = Math.max(0, Math.min(newCursor, newVal.length));

    prevValueRef.current = newVal;
    setCursorPos(newCursor);
    onChange(newVal);
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
