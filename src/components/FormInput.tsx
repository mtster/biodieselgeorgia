import React from 'react';

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  fontClass?: string;
  containerClassName?: string;
}

export function FormInput({
  label,
  error,
  fontClass = 'font-sans',
  containerClassName = '',
  className = '',
  ...props
}: FormInputProps) {
  return (
    <div className={`relative ${containerClassName}`}>
      <span
        className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left transition-all ${
          error ? 'text-red-500' : 'text-gray-400'
        }`}
      >
        {label}
      </span>
      <input
        className={`block w-full px-3.5 py-4 md:py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 transition-all ${fontClass} ${
          error
            ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900'
            : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
        } ${className}`}
        {...props}
      />
      {error && (
        <p className="text-[10px] text-red-600 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
          {error}
        </p>
      )}
    </div>
  );
}

export interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  fontClass?: string;
  containerClassName?: string;
}

export function FormSelect({
  label,
  error,
  fontClass = 'font-sans',
  containerClassName = '',
  className = '',
  children,
  ...props
}: FormSelectProps) {
  return (
    <div className={`relative ${containerClassName}`}>
      <span
        className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left transition-all ${fontClass} ${
          error ? 'text-red-550' : 'text-gray-400'
        }`}
      >
        {label}
      </span>
      <select
        className={`block w-full px-3.5 py-4 md:py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 transition-all cursor-pointer relative ${fontClass} ${
          error
            ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900'
            : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p className="text-[10px] text-red-650 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
          {error}
        </p>
      )}
    </div>
  );
}
