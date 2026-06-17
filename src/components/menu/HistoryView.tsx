import React, { useState } from 'react';
import { ChangeHistory } from '../../types';
import PageHeader from '../PageHeader';
import { StandardTable, ColumnConfig } from '../StandardTable';

interface Props {
  history: ChangeHistory[];
  loadMore: () => Promise<void>;
  isLoadingMore: boolean;
}

export default function HistoryView({ history, loadMore, isLoadingMore }: Props) {
  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedOperation, setSelectedOperation] = useState('');
  const [selectedField, setSelectedField] = useState('');

  // Extract unique options from the change log data dynamically
  const uniqueUsers = Array.from(new Set(history.map(h => h.employee_name).filter(Boolean))).sort();
  const uniqueOperations = Array.from(new Set(history.map(h => h.operation).filter(Boolean))).sort();
  const uniqueFields = Array.from(new Set(history.map(h => h.field_name).filter(Boolean))).sort();

  const filteredHistory = history.filter(log => {
    // 1. Period Filter
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const logDate = new Date(log.date_time);
      if (logDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const logDate = new Date(log.date_time);
      if (logDate > end) return false;
    }

    // 2. User Filter
    if (selectedUser && log.employee_name !== selectedUser) {
      return false;
    }

    // 3. Operation Filter
    if (selectedOperation && log.operation !== selectedOperation) {
      return false;
    }

    // 4. Field Filter
    if (selectedField && log.field_name !== selectedField) {
      return false;
    }

    return true;
  });

  const columns: ColumnConfig<ChangeHistory>[] = [
    {
      header: 'Date & Time',
      key: 'date_time',
      render: (log) => new Date(log.date_time).toLocaleString('en-US')
    },
    {
      header: 'User',
      key: 'employee_name',
      render: (log) => log.employee_name
    },
    {
      header: 'Operation',
      key: 'operation',
      render: (log) => log.operation
    },
    {
      header: 'Field',
      key: 'field_name',
      render: (log) => log.field_name || '-'
    },
    {
      header: 'Old Value',
      key: 'old_value',
      render: (log) => log.old_value || '-'
    },
    {
      header: 'New Value',
      key: 'new_value',
      render: (log) => log.new_value || '-'
    }
  ];

  return (
    <div className="space-y-6 text-left">
      
      {/* 1. Header */}
      <PageHeader title="Change History" />

      {/* 2. Premium Filters Bar */}
      <div className="bg-white p-4 border border-gray-100 rounded-2xl shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        
        {/* Period */}
        <div className="space-y-1.5 col-span-1 sm:col-span-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block select-none">Period</label>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-gray-55 border border-gray-200 focus:border-emerald-600 rounded-xl px-2.5 py-1.5 text-xs text-gray-700 outline-none w-full font-sans cursor-pointer transition-all focus:ring-1 focus:ring-emerald-600"
            />
            <span className="text-gray-300 text-xs select-none">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-gray-55 border border-gray-200 focus:border-emerald-600 rounded-xl px-2.5 py-1.5 text-xs text-gray-700 outline-none w-full font-sans cursor-pointer transition-all focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>

        {/* User filter */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block select-none">User</label>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full bg-gray-55 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-750 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none cursor-pointer"
          >
            <option value="">All Users</option>
            {uniqueUsers.map(user => (
              <option key={user} value={user}>{user}</option>
            ))}
          </select>
        </div>

        {/* Operation filter */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block select-none">Operation</label>
          <select
            value={selectedOperation}
            onChange={(e) => setSelectedOperation(e.target.value)}
            className="w-full bg-gray-55 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-750 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none cursor-pointer"
          >
            <option value="">All Operations</option>
            {uniqueOperations.map(op => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        </div>

        {/* Field filter */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block select-none">Field</label>
          <select
            value={selectedField}
            onChange={(e) => setSelectedField(e.target.value)}
            className="w-full bg-gray-55 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-750 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none cursor-pointer"
          >
            <option value="">All Fields</option>
            {uniqueFields.map(fd => (
              <option key={fd} value={fd}>{fd}</option>
            ))}
          </select>
        </div>

      </div>

      {/* 3. Table element */}
      <div className="space-y-4">
        <StandardTable
          data={filteredHistory}
          columns={columns}
          emptyMessage="No change history logs match current filters."
        />

        {/* Load More pagination button */}
        {filteredHistory.length > 0 && (
          <div className="flex justify-center py-2">
            <button
              onClick={loadMore}
              disabled={isLoadingMore}
              className="px-4 py-2 bg-white border border-gray-200 text-xs font-sans text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 cursor-pointer transition-all"
            >
              {isLoadingMore ? "Loading..." : "Load More"}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
