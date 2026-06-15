import React, { useState } from 'react';
import { ChangeHistory } from '../../types';
import { History, ShieldAlert, BadgeInfo, RotateCcw, CheckCircle2 } from 'lucide-react';

interface Props {
  history: ChangeHistory[];
  onRevert: (log: ChangeHistory) => Promise<boolean>;
}

export default function HistoryView({ history, onRevert }: Props) {
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const handleRevertClick = async (log: ChangeHistory) => {
    if (revertingId) return;
    setRevertingId(log.id);
    const success = await onRevert(log);
    setRevertingId(null);
    if (success) {
      setSuccessId(log.id);
      setTimeout(() => setSuccessId(null), 3000);
    }
  };

  return (
    <div className="space-y-6 pt-4 md:pt-6">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-gray-800">Change History</h2>
        <p className="text-xs text-gray-500 mt-1">System audit logs - Full history of record additions, modifications, and deletions. Use the Revert action to roll back changes.</p>
      </div>

      <div className="bg-white border rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-700">
            <thead>
              <tr className="border-b text-[10px] text-gray-400 uppercase font-mono bg-gray-50">
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4 font-sans">User</th>
                <th className="py-3 px-4 font-sans">Operation</th>
                <th className="py-3 px-4">Field</th>
                <th className="py-3 px-4">Old Value</th>
                <th className="py-3 px-4">New Value</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-mono">
              {history.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/20 text-xs">
                  <td className="py-3 px-4 text-gray-550 font-mono">
                    {new Date(log.date_time).toLocaleString('en-US')}
                  </td>
                  <td className="py-3 px-4 font-sans font-bold text-gray-800">
                    {log.employee_name}
                  </td>
                  <td className="py-3 px-4 font-sans text-gray-650">
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 font-bold text-[10px]">
                      {log.operation}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-450">
                    {log.field_name || '-'}
                  </td>
                  <td className="py-3 px-4 text-gray-400 max-w-xs truncate">
                    {log.old_value || '-'}
                  </td>
                  <td className="py-3 px-4 text-emerald-800 font-bold max-w-xs truncate">
                    {log.new_value || '-'}
                  </td>
                  <td className="py-2 px-4 text-right">
                    {successId === log.id || log.is_reverted ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-sans font-bold py-1">
                        <CheckCircle2 size={13} className="text-emerald-600" /> Reverted
                      </span>
                    ) : (
                      <button
                        onClick={() => handleRevertClick(log)}
                        disabled={revertingId !== null}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold font-sans rounded-xl transition duration-150 border border-amber-200 select-none cursor-pointer disabled:opacity-50 text-[11px]`}
                      >
                        <RotateCcw size={11} className={revertingId === log.id ? "animate-spin" : ""} />
                        {revertingId === log.id ? "Reverting" : "Revert"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {history.length === 0 && (
          <div className="text-center py-16 text-xs text-gray-400 font-sans">
            No change logs exist in the system at the moment.
          </div>
        )}
      </div>

    </div>
  );
}
