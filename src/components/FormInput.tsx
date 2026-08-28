import React from 'react';
import { t } from '../utils/lang';

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  fontClass?: string;
  containerClassName?: string;
  labelBgClass?: string;
  children?: React.ReactNode;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(function FormInput({
  label,
  error,
  fontClass = 'font-sans',
  containerClassName = '',
  className = '',
  labelBgClass = 'bg-white',
  children,
  ...props
}, ref) {
  let finalValue = props.value;
  if (props.type === 'date' && typeof finalValue === 'string' && finalValue.includes('T')) {
    finalValue = finalValue.split('T')[0];
  }

  return (
    <div className={`relative ${containerClassName}`}>
      <span
        className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold select-none z-10 text-left transition-all ${labelBgClass} ${
          error ? 'text-red-500' : 'text-gray-400'
        }`}
      >
        {t(label)}
      </span>
      <input
        ref={ref}
        className={`block w-full px-3.5 py-4 md:py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 transition-all ${fontClass} ${
          error
            ? 'border-red-500 bg-red-50/10 focus:border-red-500 focus:ring-red-500 text-red-900'
            : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
        } ${className}`}
        {...props}
        value={finalValue}
      />
      {children}
      {error && (
        <p className="text-[10px] text-red-500 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
          {error}
        </p>
      )}
    </div>
  );
});

export interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  fontClass?: string;
  containerClassName?: string;
  labelBgClass?: string;
}

export function FormSelect({
  label,
  error,
  fontClass = 'font-sans',
  containerClassName = '',
  className = '',
  labelBgClass = 'bg-white',
  children,
  ...props
}: FormSelectProps) {
  return (
    <div className={`relative ${containerClassName}`}>
      <span
        className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold select-none z-10 text-left transition-all ${fontClass} ${labelBgClass} ${
          error ? 'text-red-500' : 'text-gray-400'
        }`}
      >
        {t(label)}
      </span>
      <select
        className={`block w-full px-3.5 py-4 md:py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 transition-all cursor-pointer relative ${fontClass} ${
          error
            ? 'border-red-500 bg-red-50/10 focus:border-red-500 focus:ring-red-500 text-red-900'
            : 'border-transparent bg-gray-50 focus:border-emerald-600 focus:ring-emerald-600 text-gray-900'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p className="text-[10px] text-red-500 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
          {error}
        </p>
      )}
    </div>
  );
}
