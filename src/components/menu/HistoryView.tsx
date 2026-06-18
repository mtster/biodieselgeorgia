import React, { useState } from 'react';
import { ChangeHistory } from '../../types';
import PageHeader from '../PageHeader';
import { StandardTable, ColumnConfig } from '../StandardTable';
import { FormSelect } from '../FormInput';

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
      <div className="bg-white p-4 border border-gray-100 rounded-2xl shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
        
        {/* Period (No label) */}
        <div className="col-span-1 sm:col-span-2">
          <div className="flex items-center gap-1.5 h-full">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white border border-gray-200 focus:border-emerald-600 rounded-xl px-2.5 py-3 text-xs text-gray-700 outline-none w-full font-sans cursor-pointer transition-all focus:ring-1 focus:ring-emerald-600"
            />
            <span className="text-gray-300 text-xs select-none font-bold">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white border border-gray-200 focus:border-emerald-600 rounded-xl px-2.5 py-3 text-xs text-gray-700 outline-none w-full font-sans cursor-pointer transition-all focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>

        {/* User filter */}
        <FormSelect
          label="User"
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
        >
          <option value="">All Users</option>
          {uniqueUsers.map(user => (
            <option key={user} value={user}>{user}</option>
          ))}
        </FormSelect>

        {/* Operation filter */}
        <FormSelect
          label="Operation"
          value={selectedOperation}
          onChange={(e) => setSelectedOperation(e.target.value)}
        >
          <option value="">All Operations</option>
          {uniqueOperations.map(op => (
            <option key={op} value={op}>{op}</option>
          ))}
        </FormSelect>

        {/* Field filter */}
        <FormSelect
          label="Field"
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}
        >
          <option value="">All Fields</option>
          {uniqueFields.map(fd => (
            <option key={fd} value={fd}>{fd}</option>
          ))}
        </FormSelect>

      </div>

      {/* 3. Table element */}
      <div className="space-y-4">
        <StandardTable
          data={filteredHistory}
          columns={columns}
          emptyMessage="No change history logs match current filters."
          onLoadMore={loadMore}
          hasMore={history.length > 0 && history.length % 50 === 0}
          isLoading={isLoadingMore}
        />
      </div>

    </div>
  );
}

