import React from 'react';
import { ChangeHistory } from '../types';
import { History, ShieldAlert, BadgeInfo } from 'lucide-react';

interface Props {
  history: ChangeHistory[];
}

export default function HistoryView({ history }: Props) {
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-gray-800">ცვლილებების ისტორია</h2>
        <p className="text-xs text-gray-500 mt-1">საკონტროლო აუდიტორული ჩანაწერები - მონაცემების დამატების, რედაქტირების და წაშლის სრული ისტორია.</p>
      </div>

      <div className="bg-white border rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-700">
            <thead>
              <tr className="border-b text-[10px] text-gray-405 uppercase font-mono bg-gray-50">
                <th className="py-3 px-4">თარიღი და დრო</th>
                <th className="py-3 px-4 font-sans">თანამშრომელი</th>
                <th className="py-3 px-4 font-sans">ოპერაცია</th>
                <th className="py-3 px-4">ველი</th>
                <th className="py-3 px-4">ძველი მნიშვნელობა</th>
                <th className="py-3 px-4">ახალი მნიშვნელობა</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-mono">
              {history.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/20 text-xs">
                  <td className="py-3 px-4 text-gray-550 font-mono">
                    {new Date(log.date_time).toLocaleString('ka-GE')}
                  </td>
                  <td className="py-3 px-4 font-sans font-bold text-gray-800">
                    {log.employee_name}
                  </td>
                  <td className="py-3 px-4 font-sans text-gray-650">
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 font-bold">
                      {log.operation}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400">
                    {log.field_name || '-'}
                  </td>
                  <td className="py-3 px-4 text-gray-400 max-w-xs truncate">
                    {log.old_value || '-'}
                  </td>
                  <td className="py-3 px-4 text-emerald-800 font-bold max-w-xs truncate">
                    {log.new_value || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {history.length === 0 && (
          <div className="text-center py-16 text-xs text-gray-400 font-sans">
            ცვლილებების მაუწყებელი ისტორიული ჩანაწერები ამ დროისთვის არ არსებობს.
          </div>
        )}
      </div>

    </div>
  );
}
