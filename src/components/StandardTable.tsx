import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { t } from '../utils/lang';

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
  hidePagination?: boolean;
  serverTotalCount?: number;
  page?: number;
  onPageChange?: (newPage: number) => void;
  tableScrollClassName?: string;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

export function StandardTable<T>({
  data,
  columns,
  onRowClick,
  rowClassName,
  emptyMessage = 'No records found.',
  isLoading = false,
  hidePagination = false,
  serverTotalCount,
  page,
  onPageChange,
  tableScrollClassName,
  onScroll
}: StandardTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const isServer = serverTotalCount !== undefined;
  const activePage = isServer ? (page || 1) : currentPage;

  // Reset active client page when data length changes
  useEffect(() => {
    if (!isServer) {
      setCurrentPage(1);
    }
  }, [data.length, isServer]);

  const totalItems = isServer ? serverTotalCount : data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  const startIndex = (activePage - 1) * pageSize;
  const endIndex = isServer ? Math.min(startIndex + data.length, totalItems) : Math.min(startIndex + pageSize, totalItems);
  const displayedData = isServer ? data : data.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    if (isServer && onPageChange) {
      onPageChange(Math.max(activePage - 1, 1));
    } else {
      setCurrentPage(prev => Math.max(prev - 1, 1));
    }
  };

  const handleNextPage = () => {
    if (isServer && onPageChange) {
      onPageChange(Math.min(activePage + 1, totalPages));
    } else {
      setCurrentPage(prev => Math.min(prev + 1, totalPages));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col relative">
      <div 
        className={`overflow-x-auto ${tableScrollClassName || ''}`}
        onScroll={onScroll}
      >
        <table className="w-full text-left border-collapse">                
          <thead className="sticky top-0 z-20">
            <tr className="select-none">
              {columns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  className={`py-3 px-4 text-[11px] text-gray-400 uppercase font-mono bg-slate-50 z-20 border-b border-gray-200 whitespace-nowrap text-left ${
                    col.className || ''
                  }`}
                >
                  {typeof col.header === 'string' ? t(col.header) : col.header}
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
                  className={`text-xs font-sans text-gray-700 ${
                    isClickable ? 'cursor-pointer' : ''
                  } ${customRowClass || (isClickable ? 'hover:bg-slate-50' : '')}`}
                >
                  {columns.map((col, colIdx) => {
                    const isSelectCol = col.key === 'select';
                    return (
                      <td
                        key={col.key || colIdx}
                        onClick={(e) => {
                          if (isSelectCol) {
                            e.stopPropagation();
                          }
                        }}
                        className={`py-3.5 px-4 whitespace-nowrap text-xs font-sans text-gray-700 leading-normal ${
                          isSelectCol ? 'cursor-default' : ''
                        } ${col.className || ''}`}
                      >
                        {col.render ? col.render(item) : (item as any)[col.key] ?? '-'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isLoading && (
        <div className="py-12 text-center text-xs text-gray-500 bg-slate-50/60 select-none font-sans font-semibold flex items-center justify-center gap-2 border-b border-gray-200">
          <Loader2 className="animate-spin text-emerald-700" size={16} />
          <span>{t("Loading data...")}</span>
        </div>
      )}

      {!isLoading && totalItems === 0 && (
        <div className="text-center py-20 text-xs text-gray-400 italic select-none bg-white font-sans">
          {t(emptyMessage)}
        </div>
      )}

      {/* Beautiful High-Contrast Pagination Footer */}
      {!hidePagination && totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-gray-100 bg-slate-50/60 px-4 py-3 select-none shrink-0 gap-3">
          <div className="text-xs text-gray-500 font-medium font-sans">
            {t("Showing")} <span className="font-bold text-gray-800">{totalItems === 0 ? 0 : startIndex + 1}</span>-
            <span className="font-bold text-gray-800">{endIndex}</span>{' '}
            <span className="font-bold text-gray-800">{totalItems}</span> {t("records")}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={activePage === 1}
              onClick={handlePrevPage}
              className="p-1 px-3 border border-gray-200 rounded-xl hover:bg-slate-100 text-xs font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 cursor-pointer bg-white shadow-3xs"
            >
              <ChevronLeft size={14} strokeWidth={2.5} />
              <span>{t("Previous")}</span>
            </button>
            
            <div className="flex items-center gap-1 px-3">
              <span className="text-xs font-bold font-sans text-gray-500">
                Page <span className="text-gray-900 font-black">{activePage}</span> of <span className="text-gray-900 font-black">{totalPages}</span>
              </span>
            </div>

            <button
              type="button"
              disabled={activePage === totalPages}
              onClick={handleNextPage}
              className="p-1 px-3 border border-gray-200 rounded-xl hover:bg-slate-100 text-xs font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 cursor-pointer bg-white shadow-3xs"
            >
              <span>{t("Next")}</span>
              <ChevronRight size={14} strokeWidth={2.5} strokeLinecap={"round"} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

