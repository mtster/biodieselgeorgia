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

    const isValidTimePart = (part: string) => {
      // Check digit 0: h1 (0-2)
      if (part.length >= 1 && parseInt(part[0]) > 2) return false;
      // Check digit 1: h2
      if (part.length >= 2) {
        const h1 = parseInt(part[0]);
        const h2 = parseInt(part[1]);
        if (h1 === 2 && h2 > 3) return false;
      }
      // Check digit 2: m1 (0-5)
      if (part.length >= 3 && parseInt(part[2]) > 5) return false;
      return true;
    };

    // Filter disallowed characters
    let cleanVal = rawVal.replace(/[^0-9]/g, '');
    if (cleanVal.length > 8) cleanVal = cleanVal.slice(0, 8);
    
    // Strict validation
    if (!isValidTimePart(cleanVal.slice(0, 4)) || (cleanVal.length > 4 && !isValidTimePart(cleanVal.slice(4, 8)))) return;

    // Formatter which fills separators as digits are typed
    let formatted = '';
    for (let i = 0; i < cleanVal.length; i++) {
        formatted += cleanVal[i];
        if (i === 1) formatted += ':';
        if (i === 3) formatted += ' - ';
        if (i === 5) formatted += ':';
    }
    
    onChange(formatted);
  };

  return (
    <input
      ref={inputRef}
      id="working-hours-field"
      type="text"
      placeholder="10:00 - 19:00"
      value={value}
      onChange={handleChange}
      className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans transition-all"
    />
  );
}
