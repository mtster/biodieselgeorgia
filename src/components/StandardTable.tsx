import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface ColumnConfig<T> {
  header: React.ReactNode;
  key: string;
  className?: string;
  render?: (item: T) => React.ReactNode;
}

interface StandardTableProps<T> {
  data: T[];
  columns: ColumnConfig<T>[];
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;
  emptyMessage?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

export function StandardTable<T>({
  data,
  columns,
  onRowClick,
  rowClassName,
  emptyMessage = 'No records found.',
  isLoading = false
}: StandardTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Reset active page when data dependencies or filter results change
  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const displayedData = data.slice(startIndex, endIndex);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col relative">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="select-none">
              {columns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  className={`py-3 px-4 text-[11px] text-gray-400 uppercase font-mono bg-slate-50 z-20 border-b border-gray-200 whitespace-nowrap text-left ${
                    col.className || ''
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {displayedData.map((item, rowIdx) => {
              const isClickable = !!onRowClick;
              const customRowClass = rowClassName ? rowClassName(item) : '';
              return (
                <tr
                  key={rowIdx}
                  onClick={() => onRowClick && onRowClick(item)}
                  className={`transition-colors text-xs font-sans text-gray-700 ${
                    isClickable ? 'cursor-pointer hover:bg-slate-50/80' : ''
                  } ${customRowClass}`}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={col.key || colIdx}
                      className={`py-3.5 px-4 whitespace-nowrap text-xs font-sans text-gray-700 leading-normal ${
                        col.className || ''
                      }`}
                    >
                      {col.render ? col.render(item) : (item as any)[col.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isLoading && (
        <div className="py-4 text-center text-xs text-gray-400 italic bg-slate-50/40 select-none font-sans font-medium flex items-center justify-center gap-1.5 animate-pulse border-b border-gray-200">
          <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></span>
          Fetching older entries...
        </div>
      )}

      {totalItems === 0 && (
        <div className="text-center py-20 text-xs text-gray-400 italic select-none bg-white">
          {emptyMessage}
        </div>
      )}

      {/* Beautiful High-Contrast Pagination Footer */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-gray-150 bg-slate-50/60 px-4 py-3 select-none shrink-0 gap-3">
          <div className="text-xs text-gray-500 font-medium font-sans">
            Showing <span className="font-bold text-gray-800">{totalItems === 0 ? 0 : startIndex + 1}</span> to{' '}
            <span className="font-bold text-gray-800">{endIndex}</span> of{' '}
            <span className="font-bold text-gray-800">{totalItems}</span> entries
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="p-1 px-3 border border-gray-200 rounded-xl hover:bg-slate-100 text-xs font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 cursor-pointer bg-white shadow-3xs"
            >
              <ChevronLeft size={14} strokeWidth={2.5} />
              <span>Previous</span>
            </button>
            
            <div className="flex items-center gap-1 px-3">
              <span className="text-xs font-bold font-sans text-gray-500">
                Page <span className="text-gray-900 font-black">{currentPage}</span> of <span className="text-gray-900 font-black">{totalPages}</span>
              </span>
            </div>

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="p-1 px-3 border border-gray-200 rounded-xl hover:bg-slate-100 text-xs font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 cursor-pointer bg-white shadow-3xs"
            >
              <span>Next</span>
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

