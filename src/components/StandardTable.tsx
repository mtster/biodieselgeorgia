import React from 'react';

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
}

export function StandardTable<T>({
  data,
  columns,
  onRowClick,
  rowClassName,
  emptyMessage = 'No records found.'
}: StandardTableProps<T>) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs max-h-[600px] overflow-auto relative">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="select-none">
              {columns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  className={`py-3 px-4 text-[11px] text-gray-400 uppercase font-mono bg-slate-50 sticky top-0 z-20 border-b border-gray-200 whitespace-nowrap text-left ${
                    col.className || ''
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {data.map((item, rowIdx) => {
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

      {data.length === 0 && (
        <div className="text-center py-20 text-xs text-gray-400 italic select-none bg-white">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}
