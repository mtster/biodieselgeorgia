import React, { useState } from 'react';
import { ChangeHistory } from '../../types';
import PageHeader from '../PageHeader';
import { StandardTable, ColumnConfig } from '../StandardTable';
import CentralSearchBar from '../CentralSearchBar';
import PeriodFilter from '../PeriodFilter';
import { t, formatDateTime } from '../../utils/lang';

interface Props {
  history: ChangeHistory[];
  loadMore: () => Promise<void>;
  isLoadingMore: boolean;
}

export default function HistoryView({ history, loadMore, isLoadingMore }: Props) {
  // Filter States
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(endOfMonth.getDate())}`;
  });
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedOperation, setSelectedOperation] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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

    // 5. Search Bar Filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchUser = log.employee_name?.toLowerCase().includes(term);
      const matchOp = log.operation?.toLowerCase().includes(term);
      const matchField = log.field_name?.toLowerCase().includes(term);
      const matchOld = log.old_value?.toLowerCase().includes(term);
      const matchNew = log.new_value?.toLowerCase().includes(term);
      if (!matchUser && !matchOp && !matchField && !matchOld && !matchNew) {
        return false;
      }
    }

    return true;
  });

  const columns: ColumnConfig<ChangeHistory>[] = [
    {
      header: t('Date & Time'),
      key: 'date_time',
      render: (log) => formatDateTime(log.date_time)
    },
    {
      header: t('User'),
      key: 'employee_name',
      render: (log) => log.employee_name
    },
    {
      header: t('Operation'),
      key: 'operation',
      render: (log) => t(log.operation)
    },
    {
      header: t('Field'),
      key: 'field_name',
      render: (log) => log.field_name ? t(log.field_name) : '-'
    },
    {
      header: t('Old Value'),
      key: 'old_value',
      render: (log) => log.old_value ? t(log.old_value) : '-'
    },
    {
      header: t('New Value'),
      key: 'new_value',
      render: (log) => log.new_value ? t(log.new_value) : '-'
    }
  ];

  return (
    <div className="space-y-6 text-left">
      
      {/* 1. Header */}
      <PageHeader title={t("Change History")} />

      {/* 2. Seamless Filters Bar (CentralSearchBar + PeriodFilter) with No thick white outline */}
      <div className="flex flex-col md:flex-row items-center gap-4 w-full">
        <PeriodFilter 
          startDate={startDate} 
          setStartDate={setStartDate} 
          endDate={endDate} 
          setEndDate={setEndDate} 
        />

        <div className="flex-1 w-full">
          <CentralSearchBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            idPrefix="history-search"
            searchPlaceholder={t("Search change history logs...")}
            filters={[
              {
                label: t("User"),
                value: selectedUser,
                placeholder: t("All Users"),
                onChange: setSelectedUser,
                options: uniqueUsers.map(user => ({ value: user, label: user }))
              },
              {
                label: t("Operation"),
                value: selectedOperation,
                placeholder: t("All Operations"),
                onChange: setSelectedOperation,
                options: uniqueOperations.map(op => ({ value: op, label: t(op) }))
              },
              {
                label: t("Field"),
                value: selectedField,
                placeholder: t("All Fields"),
                onChange: setSelectedField,
                options: uniqueFields.map(fd => ({ value: fd, label: t(fd) }))
              }
            ]}
          />
        </div>
      </div>

      {/* 3. Table element */}
      <div className="space-y-4">
        <StandardTable
          data={filteredHistory}
          columns={columns}
          emptyMessage={t("No change history logs match current filters.")}
          onLoadMore={loadMore}
          hasMore={history.length > 0 && history.length % 50 === 0}
          isLoading={isLoadingMore}
        />
      </div>

    </div>
  );
}
