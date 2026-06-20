import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  backButtonId?: string;
}

export default function PageHeader({
  title,
  subtitle,
  onBack,
  actions,
  backButtonId
}: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-4 bg-[#f8fafc]/95 backdrop-blur-md border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none text-left shadow-xs">
      <div className="flex items-center">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 mr-3 hover:bg-slate-100 rounded-xl transition cursor-pointer text-gray-600 flex items-center justify-center border border-transparent hover:border-gray-200"
            title="Go Back"
            id={backButtonId}
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <h2 className="text-xl font-extrabold text-gray-800 font-sans tracking-tight flex items-center">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  );
}
